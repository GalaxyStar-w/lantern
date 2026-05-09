// 聊天主入口
// 写入 user 消息 + 规则打标 + 危机落库 → 调用 LLM 获取回复 → 写入 assistant 消息
// 阶段 2：已接入真实 LLM（OpenAI-compatible）。若 LLM 未配置或调用失败，降级到 mock 回复。

import { db, now, randomId } from '../d1.js';
import { classifyMessage } from '../assessor/classify.js';
import { callChat } from '../llm.js';
import { buildSystemPrompt } from '../systemPrompt.js';
import { json } from '../utils.js';

const CONTEXT_WINDOW = 20; // 给 LLM 的近 N 条消息

async function getOrCreateConversation(env, userId) {
  const d = db(env);
  let conv = await d.first(
    'SELECT id FROM conversations WHERE user_id = ? ORDER BY last_msg_at DESC LIMIT 1',
    userId,
  );
  if (conv) return conv.id;
  const id = randomId();
  const t = now();
  await d.run(
    'INSERT INTO conversations (id, user_id, started_at, last_msg_at, title) VALUES (?, ?, ?, ?, ?)',
    id, userId, t, t, null,
  );
  return id;
}

// 降级回复（LLM 不可用时）
function mockReply(text, crisis) {
  if (crisis === 'high') {
    return '谢谢你愿意把这么重的话告诉我。我在这里。现在所在的地方安全吗？如果可以，先拨 400-161-9995，那边 24 小时都有人接。';
  }
  if (crisis === 'medium') return '听起来这阵子很难，不用急着讲明白，我慢慢听着。';
  if (text.includes('睡')) return '睡不好的时候人会变脆弱一点。昨晚是难入睡，还是睡着了又醒？';
  if (text.includes('累')) return '累，有时不是身体的，是心里一直绷着。';
  return '嗯，我在听，再多说一点也行。';
}

async function loadRecentContext(env, conversationId, limit) {
  const d = db(env);
  const rows = await d.all(
    'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
    conversationId, limit,
  );
  return rows.reverse().map((m) => ({ role: m.role, content: m.content }));
}

export async function handleChat(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const text = (body.text || '').toString().trim();
  if (!text) return json({ error: '说点什么都可以' }, 400);

  const d = db(env);
  const conversationId = await getOrCreateConversation(env, user.id);
  const t = now();

  const { rule_tags, crisis_level, matched } = classifyMessage(text);

  const userMsgId = randomId();
  await d.run(
    'INSERT INTO messages (id, conversation_id, user_id, role, content, created_at, rule_tags, crisis_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    userMsgId, conversationId, user.id, 'user', text, t, rule_tags, crisis_level,
  );

  if (crisis_level === 'high' || crisis_level === 'medium') {
    await d.run(
      'INSERT INTO crisis_events (id, user_id, message_id, level, matched_keywords, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      randomId(), user.id, userMsgId, crisis_level, JSON.stringify(matched), t,
    );
  }

  // 调用真实 LLM；失败则降级 mock
  let reply;
  let llmError = null;
  try {
    const history = await loadRecentContext(env, conversationId, CONTEXT_WINDOW);
    const systemPrompt = buildSystemPrompt({ crisisLevel: crisis_level });
    const messages = [{ role: 'system', content: systemPrompt }, ...history];
    reply = await callChat(env, user.id, messages);
  } catch (e) {
    llmError = e?.message || String(e);
    reply = mockReply(text, crisis_level);
  }

  const assistantMsgId = randomId();
  await d.run(
    'INSERT INTO messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    assistantMsgId, conversationId, user.id, 'assistant', reply, now(),
  );
  await d.run('UPDATE conversations SET last_msg_at = ? WHERE id = ?', now(), conversationId);

  return json({
    conversationId,
    userMessage: { id: userMsgId, role: 'user', content: text, created_at: t, crisis_level },
    reply: { id: assistantMsgId, role: 'assistant', content: reply, created_at: now() },
    llmError,
  });
}

export async function handleListMessages(_request, env, user) {
  const d = db(env);
  const conv = await d.first(
    'SELECT id FROM conversations WHERE user_id = ? ORDER BY last_msg_at DESC LIMIT 1',
    user.id,
  );
  if (!conv) return json({ conversationId: null, messages: [] });
  const rows = await d.all(
    'SELECT id, role, content, created_at, crisis_level FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200',
    conv.id,
  );
  return json({ conversationId: conv.id, messages: rows });
}
