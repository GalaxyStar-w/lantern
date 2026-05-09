// 聊天主入口
// 流程：入库 user 消息（含规则打标 + 危机落库 + 重要时刻记录）
//      → 构建记忆上下文 + 个性化 + 危机
//      → 调 LLM（失败降级 mock）
//      → 入库 assistant 消息
//      → 更新 last_seen_at

import { db, now, randomId } from '../d1.js';
import { classifyMessage } from '../assessor/classify.js';
import { callChat } from '../llm.js';
import { buildSystemPrompt } from '../systemPrompt.js';
import { buildMemoryContext, getDaysSinceLastSeen, updateLastSeen } from '../memory/retriever.js';
import { maybeRecordMoment } from '../memory/momentDetector.js';
import { json } from '../utils.js';

const CONTEXT_WINDOW = 20;

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
    `SELECT role, content FROM messages
     WHERE conversation_id = ? AND (deleted IS NULL OR deleted = 0)
     ORDER BY created_at DESC LIMIT ?`,
    conversationId, limit,
  );
  return rows.reverse().map((m) => ({ role: m.role, content: m.content }));
}

export async function handleChat(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const text = (body.text || '').toString().trim();
  if (!text) return json({ error: '说点什么都可以' }, 400);

  const silent = body.silent === true;    // 日记模式：只写不回
  const ephemeral = body.ephemeral === true; // 临时模式：不入评估/记忆

  const d = db(env);
  const conversationId = await getOrCreateConversation(env, user.id);
  const t = now();

  const { rule_tags, crisis_level, matched } = classifyMessage(text);
  // 临时模式不打标
  const effectiveRuleTags = ephemeral ? null : rule_tags;
  const effectiveCrisis = ephemeral ? 'none' : crisis_level;

  const userMsgId = randomId();
  await d.run(
    `INSERT INTO messages
     (id, conversation_id, user_id, role, content, created_at, rule_tags, crisis_level, ephemeral, silent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userMsgId, conversationId, user.id, 'user', text, t,
    effectiveRuleTags, effectiveCrisis,
    ephemeral ? 1 : 0, silent ? 1 : 0,
  );

  if (!ephemeral && (crisis_level === 'high' || crisis_level === 'medium')) {
    await d.run(
      'INSERT INTO crisis_events (id, user_id, message_id, level, matched_keywords, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      randomId(), user.id, userMsgId, crisis_level, JSON.stringify(matched), t,
    );
  }

  if (!ephemeral) {
    await maybeRecordMoment(env, { userId: user.id, messageId: userMsgId, content: text, crisis_level });
  }

  // 日记模式：只落库，返回占位
  if (silent) {
    await d.run('UPDATE conversations SET last_msg_at = ? WHERE id = ?', now(), conversationId);
    await updateLastSeen(env, user.id);
    return json({
      conversationId,
      userMessage: { id: userMsgId, role: 'user', content: text, created_at: t, crisis_level: effectiveCrisis },
      reply: null,
      silent: true,
    });
  }

  // 调 LLM
  let reply;
  let llmError = null;
  try {
    const history = await loadRecentContext(env, conversationId, CONTEXT_WINDOW);
    const memoryCtx = ephemeral ? '' : await buildMemoryContext(env, user.id);
    const daysAway = await getDaysSinceLastSeen(env, user.id);

    const systemPrompt = buildSystemPrompt({
      crisisLevel: crisis_level,
      memoryContext: memoryCtx,
      addressAs: user.address_as,
      nickname: user.nickname,
      toneStyle: user.tone_style || 'warm',
      daysAway,
    });
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
  await updateLastSeen(env, user.id);

  return json({
    conversationId,
    userMessage: { id: userMsgId, role: 'user', content: text, created_at: t, crisis_level: effectiveCrisis },
    reply: { id: assistantMsgId, role: 'assistant', content: reply, created_at: now() },
    llmError,
  });
}

// 主动打招呼：会话空 or 距上次 >3 天，返回一个 opener（仅 AI 消息，不入库，由前端决定要不要显示）
export async function handleOpener(_request, env, user) {
  const d = db(env);
  const last = await d.first(
    'SELECT created_at, role FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    user.id,
  );
  const daysAway = await getDaysSinceLastSeen(env, user.id);

  let opener = null;
  if (!last) {
    // 全新用户
    const name = user.address_as || user.nickname || '';
    opener = name ? `${name}，慢慢来。今天是哪种天气呢？` : '慢慢来。今天是哪种天气呢？';
  } else if (daysAway != null && daysAway >= 3) {
    // 久别再见
    const memoryCtx = await buildMemoryContext(env, user.id);
    try {
      const systemPrompt = buildSystemPrompt({
        crisisLevel: 'none',
        memoryContext: memoryCtx,
        addressAs: user.address_as,
        nickname: user.nickname,
        toneStyle: user.tone_style || 'warm',
        daysAway,
        reunionMode: true,
      });
      opener = await callChat(env, user.id, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[系统] TA ${daysAway} 天没来过了，现在又回来了。你说一句自然的开场，不要问太多，2 句话内，让 TA 舒服地打开话匣子。` },
      ], { maxTokens: 120 });
    } catch {
      opener = `有一阵子没见到你了。${daysAway} 天。最近怎么样？`;
    }
  }

  if (opener) await updateLastSeen(env, user.id);
  return json({ opener, daysAway });
}

export async function handleListMessages(_request, env, user) {
  const d = db(env);
  const conv = await d.first(
    'SELECT id FROM conversations WHERE user_id = ? ORDER BY last_msg_at DESC LIMIT 1',
    user.id,
  );
  if (!conv) return json({ conversationId: null, messages: [] });
  const rows = await d.all(
    `SELECT id, role, content, created_at, crisis_level, silent
     FROM messages
     WHERE conversation_id = ? AND (deleted IS NULL OR deleted = 0)
     ORDER BY created_at ASC LIMIT 200`,
    conv.id,
  );
  return json({ conversationId: conv.id, messages: rows });
}

export async function handleDeleteMessage(_request, env, user, pathParams) {
  const { messageId } = pathParams;
  const d = db(env);
  // 软删：置 deleted = 1
  await d.run(
    'UPDATE messages SET deleted = 1 WHERE id = ? AND user_id = ?',
    messageId, user.id,
  );
  // 同步撤掉相关的 rule_tags / crisis 影响：不做，影响很小且会让代码复杂
  return json({ ok: true });
}
