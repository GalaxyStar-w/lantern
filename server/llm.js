// OpenAI-compatible LLM 客户端
// 支持所有走 OpenAI 兼容协议的厂商：DeepSeek / SiliconFlow / OpenAI / one-api 自建等
//
// 配置优先级：user_llm_configs（用户覆盖，阶段 2 后半接入）> env.DEFAULT_*（后端兜底）

import { db } from './d1.js';
import { decryptKey } from './crypto.js';

/**
 * 解析某个用户某种用途（chat | assess）的最终配置
 * 返回 { endpoint, model, apiKey } 或 null（缺任一就 null）
 */
export async function resolveConfig(env, userId, kind) {
  const d = db(env);
  const row = await d.first(
    'SELECT chat_endpoint, chat_model, chat_api_key, assess_endpoint, assess_model, assess_api_key FROM user_llm_configs WHERE user_id = ?',
    userId,
  );

  const userEndpoint = kind === 'chat' ? row?.chat_endpoint : row?.assess_endpoint;
  const userModel    = kind === 'chat' ? row?.chat_model    : row?.assess_model;
  const userKey      = kind === 'chat' ? row?.chat_api_key  : row?.assess_api_key;

  const envEndpoint = kind === 'chat' ? env.DEFAULT_CHAT_ENDPOINT : env.DEFAULT_ASSESS_ENDPOINT;
  const envModel    = kind === 'chat' ? env.DEFAULT_CHAT_MODEL    : env.DEFAULT_ASSESS_MODEL;
  const envKey      = kind === 'chat' ? env.DEFAULT_CHAT_API_KEY  : env.DEFAULT_ASSESS_API_KEY;

  const endpoint = userEndpoint || envEndpoint;
  const model    = userModel    || envModel;
  let apiKey     = null;
  if (userKey) {
    apiKey = await decryptKey(env, userKey);
  } else if (envKey) {
    apiKey = envKey;
  }

  if (!endpoint || !model || !apiKey) return null;
  return { endpoint: endpoint.replace(/\/$/, ''), model, apiKey };
}

/**
 * 非流式聊天调用
 * messages: [{role, content}, ...]
 * 返回助手消息文本；失败抛错
 */
export async function callChat(env, userId, messages, { temperature = 0.4, maxTokens = 800 } = {}) {
  const cfg = await resolveConfig(env, userId, 'chat');
  if (!cfg) throw new Error('NO_LLM_CONFIG');

  const res = await fetch(`${cfg.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM_HTTP_${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM_EMPTY_RESPONSE');
  return content.trim();
}

/**
 * 流式聊天：返回一个 async generator 吐出文本增量
 * 失败时抛错（和 callChat 一致），调用方自己 fallback
 */
export async function* callChatStream(env, userId, messages, { temperature = 0.4, maxTokens = 800 } = {}) {
  const cfg = await resolveConfig(env, userId, 'chat');
  if (!cfg) throw new Error('NO_LLM_CONFIG');

  const res = await fetch(`${cfg.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM_HTTP_${res.status}: ${body.slice(0, 200)}`);
  }
  if (!res.body) throw new Error('LLM_NO_BODY');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let yielded = 0;
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    totalBytes += chunk.length;
    buf += chunk;
    // 统一换行：有些服务发 \r\n\r\n
    buf = buf.replace(/\r\n/g, '\n');

    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const event = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of event.split('\n')) {
        // 忽略 SSE 注释（以 `:` 开头、或空行）
        if (!line || line.startsWith(':')) continue;
        // 兼容 "data:xxx" 和 "data: xxx"
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          if (yielded === 0) {
            console.warn('[llm stream] DONE with 0 chunks; totalBytes=', totalBytes);
          }
          return;
        }
        if (!payload) continue;
        try {
          const obj = JSON.parse(payload);
          // 兼容多种 payload 结构：
          //   OpenAI 风: choices[0].delta.content
          //   部分魔改: choices[0].message.content
          //   Anthropic 风: delta.text
          //   一些供应商首 chunk 有 role 但无 content，我们跳过
          const delta =
            obj?.choices?.[0]?.delta?.content ??
            obj?.choices?.[0]?.message?.content ??
            obj?.delta?.text ??
            obj?.content ??
            null;
          if (typeof delta === 'string' && delta.length > 0) {
            yielded += 1;
            yield delta;
          }
        } catch (parseErr) {
          console.warn('[llm stream] JSON parse failed, payload head:', payload.slice(0, 120));
          void parseErr;
        }
      }
    }
  }

  // 流正常结束但从未 yield 过：打 raw buffer 头帮调试
  if (yielded === 0) {
    console.warn('[llm stream] no content yielded. totalBytes=', totalBytes,
      'leftover buf head:', buf.slice(0, 300));
  }
}

/**
 * 轻量连通性测试：用最小消息请求一次，检测 endpoint/key/model 是否都对
 * 返回 { ok: true, model } 或 { ok: false, error }
 */
export async function testConnectivity(env, cfg) {
  try {
    const res = await fetch(`${cfg.endpoint.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 120)}` };
    }
    const data = await res.json();
    const got = data?.choices?.[0]?.message?.content;
    if (!got) return { ok: false, error: '返回无内容' };
    return { ok: true, model: cfg.model };
  } catch (e) {
    return { ok: false, error: e?.message || '未知错误' };
  }
}
