// 用户设置（主题 + LLM 三件套 + 知情同意）
// LLM apiKey 用 AES-GCM 加密存 D1，读回只显示末 4 位
// 前端只在"新填"时传 apiKey 明文；传空字符串 = 清除；传 undefined = 保持不变

import { db, now } from '../d1.js';
import { json } from '../utils.js';
import { encryptKey, decryptKey, maskKey } from '../crypto.js';
import { testConnectivity, resolveConfig } from '../llm.js';

async function maskedLLMConfig(env, userId) {
  const d = db(env);
  const row = await d.first(
    `SELECT chat_endpoint, chat_model, chat_api_key,
            assess_endpoint, assess_model, assess_api_key, updated_at
     FROM user_llm_configs WHERE user_id = ?`,
    userId,
  );
  if (!row) return null;
  const out = {
    chat: {
      endpoint: row.chat_endpoint || '',
      model: row.chat_model || '',
      hasKey: !!row.chat_api_key,
      keyMask: '',
    },
    assess: {
      endpoint: row.assess_endpoint || '',
      model: row.assess_model || '',
      hasKey: !!row.assess_api_key,
      keyMask: '',
    },
    updated_at: row.updated_at,
  };
  if (row.chat_api_key) {
    try { out.chat.keyMask = maskKey(await decryptKey(env, row.chat_api_key)); } catch { out.chat.keyMask = '••••????'; }
  }
  if (row.assess_api_key) {
    try { out.assess.keyMask = maskKey(await decryptKey(env, row.assess_api_key)); } catch { out.assess.keyMask = '••••????'; }
  }
  return out;
}

export async function handleGetSettings(_request, env, user) {
  const llm = await maskedLLMConfig(env, user.id);
  return json({
    theme: user.theme || 'night-violet',
    consent_at: user.consent_at,
    llm,
    defaults: {
      chat: {
        endpoint: env.DEFAULT_CHAT_ENDPOINT || '',
        model: env.DEFAULT_CHAT_MODEL || '',
        hasKey: !!env.DEFAULT_CHAT_API_KEY,
      },
      assess: {
        endpoint: env.DEFAULT_ASSESS_ENDPOINT || '',
        model: env.DEFAULT_ASSESS_MODEL || '',
        hasKey: !!env.DEFAULT_ASSESS_API_KEY,
      },
    },
  });
}

export async function handleUpdateSettings(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const d = db(env);

  if (body.theme && (body.theme === 'night-violet' || body.theme === 'cream-warm')) {
    await d.run('UPDATE users SET theme = ? WHERE id = ?', body.theme, user.id);
  }
  if (body.consent === true && !user.consent_at) {
    await d.run('UPDATE users SET consent_at = ? WHERE id = ?', now(), user.id);
  }
  if (typeof body.address_as === 'string') {
    const v = body.address_as.trim().slice(0, 20);
    await d.run('UPDATE users SET address_as = ? WHERE id = ?', v || null, user.id);
  }
  if (body.tone_style && ['warm', 'professional', 'gentle', 'calm', 'quiet'].includes(body.tone_style)) {
    await d.run('UPDATE users SET tone_style = ? WHERE id = ?', body.tone_style, user.id);
  }
  if (body.background && ['weather', 'starry', 'seaside', 'dawn'].includes(body.background)) {
    await d.run('UPDATE users SET background = ? WHERE id = ?', body.background, user.id);
  }

  if (body.llm) {
    await upsertLLMConfig(env, user.id, body.llm);
  }

  return json({ ok: true, llm: await maskedLLMConfig(env, user.id) });
}

// patch 规则：
//   字段为 undefined：保持不变
//   字段为 ''（空字符串）：清除该字段
//   字段为其他字符串：更新
async function upsertLLMConfig(env, userId, patch) {
  const d = db(env);
  const existing = await d.first('SELECT * FROM user_llm_configs WHERE user_id = ?', userId);

  const next = {
    chat_endpoint: existing?.chat_endpoint ?? null,
    chat_model:    existing?.chat_model    ?? null,
    chat_api_key:  existing?.chat_api_key  ?? null,
    assess_endpoint: existing?.assess_endpoint ?? null,
    assess_model:    existing?.assess_model    ?? null,
    assess_api_key:  existing?.assess_api_key  ?? null,
  };

  const apply = async (kind) => {
    const src = patch[kind];
    if (!src) return;
    const endpointKey = `${kind}_endpoint`;
    const modelKey = `${kind}_model`;
    const keyKey = `${kind}_api_key`;
    if (typeof src.endpoint === 'string') next[endpointKey] = src.endpoint.trim() || null;
    if (typeof src.model === 'string')    next[modelKey]    = src.model.trim() || null;
    if (typeof src.apiKey === 'string') {
      const v = src.apiKey.trim();
      next[keyKey] = v ? await encryptKey(env, v) : null;
    }
  };
  await apply('chat');
  await apply('assess');

  if (existing) {
    await d.run(
      `UPDATE user_llm_configs SET chat_endpoint=?, chat_model=?, chat_api_key=?,
          assess_endpoint=?, assess_model=?, assess_api_key=?, updated_at=?
       WHERE user_id=?`,
      next.chat_endpoint, next.chat_model, next.chat_api_key,
      next.assess_endpoint, next.assess_model, next.assess_api_key, now(), userId,
    );
  } else {
    await d.run(
      `INSERT INTO user_llm_configs (user_id, chat_endpoint, chat_model, chat_api_key,
          assess_endpoint, assess_model, assess_api_key, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      userId, next.chat_endpoint, next.chat_model, next.chat_api_key,
      next.assess_endpoint, next.assess_model, next.assess_api_key, now(),
    );
  }
}

// 测试连通性：不落库，只用提交的三件套跑一次最小请求
export async function handleTestLLM(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === 'assess' ? 'assess' : 'chat';
  const inline = body.inline;

  let cfg;
  if (inline && inline.endpoint && inline.model && inline.apiKey) {
    cfg = { endpoint: inline.endpoint.trim(), model: inline.model.trim(), apiKey: inline.apiKey.trim() };
  } else {
    cfg = await resolveConfig(env, user.id, kind);
    if (!cfg) return json({ ok: false, error: '还没配置完整的 endpoint / model / key' });
  }
  const r = await testConnectivity(env, cfg);
  return json(r);
}
