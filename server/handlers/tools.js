// 可插拔小工具：课题分离 + 未来信件
// 课题分离独立于主聊天，不入 messages 也不入评估

import { db, now, randomId } from '../d1.js';
import { json } from '../utils.js';
import { callChat } from '../llm.js';

const DECOUPLE_SYSTEM = `你在帮一个正在焦虑的人做"课题分离"（阿德勒心理学方法），缓解 ta 的焦虑。

课题分离的核心：**这件事最终的后果由谁来承担，就是谁的课题。**你只能对自己的课题负责，不该干涉别人的课题，也不该让别人的课题把自己困住。

你要引导 ta 走 4 步，一次只走一步：

第 1 步：温和共情，让 ta 把焦虑的事说完整。"听起来这件事让你很不安。"
第 2 步：帮 ta 分辨 —— 这件事最终的后果是谁承担？（如果是对方承担，那这是对方的课题，ta 可以放手）
第 3 步：在 ta 自己的课题部分，问 ta：**ta 能掌控什么？ta 打算怎么做？**（让 ta 聚焦在自己能动的地方）
第 4 步：总结 ta 的课题，轻轻告别 —— "别人的反应是别人的课题。你已经做了你能做的。"

规则：
- 每次只推进一步，不要一口气把 4 步全说完
- 每步的回复在 80 字内
- 语气温和，不说教
- 不说"你想多了""别想了"这类话
- ta 走完第 4 步后，说一句送别话："现在可以把这份焦虑放下一会儿了。"

当前步骤由系统告诉你，你按那一步的风格回复。`;

export async function handleDecouple(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const step = Math.max(1, Math.min(4, Number(body.step) || 1));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ error: '说点什么吧' }, 400);

  const sys = `${DECOUPLE_SYSTEM}\n\n【当前第 ${step} 步】`;
  const llmMessages = [
    { role: 'system', content: sys },
    ...messages,
  ];

  try {
    const reply = await callChat(env, user.id, llmMessages, { maxTokens: 200 });
    return json({ reply, step, finished: step >= 4 });
  } catch (e) {
    return json({ error: (e && e.message) || '暂时说不出话', reply: null }, 503);
  }
}

// 给未来的自己写信
export async function handleListLetters(_request, env, user) {
  const d = db(env);
  const letters = await d.all(
    'SELECT id, content, created_at, deliver_at, delivered, read_at FROM future_letters WHERE user_id = ? ORDER BY created_at DESC',
    user.id,
  );
  return json({ letters });
}

export async function handleCreateLetter(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const content = (body.content || '').toString().trim();
  const deliverAt = Number(body.deliverAt);
  if (!content) return json({ error: '写点什么吧' }, 400);
  if (!deliverAt || deliverAt < Date.now() + 60 * 60 * 1000) {
    return json({ error: '送达时间至少在 1 小时后' }, 400);
  }
  const d = db(env);
  const id = randomId();
  await d.run(
    'INSERT INTO future_letters (id, user_id, content, created_at, deliver_at) VALUES (?, ?, ?, ?, ?)',
    id, user.id, content, now(), deliverAt,
  );
  return json({ id });
}

export async function handleReadLetter(_request, env, user, pathParams) {
  const { id } = pathParams;
  const d = db(env);
  const letter = await d.first('SELECT * FROM future_letters WHERE id = ? AND user_id = ?', id, user.id);
  if (!letter) return json({ error: 'not found' }, 404);
  if (letter.deliver_at > now()) return json({ error: '还没到送达时间' }, 403);
  if (!letter.read_at) {
    await d.run('UPDATE future_letters SET read_at = ?, delivered = 1 WHERE id = ?', now(), id);
  }
  return json({ letter });
}

// 在首页 / 列表查询时用：最近有没有到期未读的信
export async function handlePendingLetter(_request, env, user) {
  const d = db(env);
  const letter = await d.first(
    'SELECT id FROM future_letters WHERE user_id = ? AND deliver_at <= ? AND (read_at IS NULL OR read_at = 0) ORDER BY deliver_at ASC LIMIT 1',
    user.id, now(),
  );
  return json({ pendingLetterId: letter?.id || null });
}

export async function handleDeleteLetter(_request, env, user, pathParams) {
  const { id } = pathParams;
  const d = db(env);
  await d.run('DELETE FROM future_letters WHERE id = ? AND user_id = ?', id, user.id);
  return json({ ok: true });
}
