// 收藏被抚慰的句子

import { db, now, randomId } from '../d1.js';
import { json } from '../utils.js';

export async function handleSaveMoment(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const messageId = body.messageId;
  if (!messageId) return json({ error: '缺少 messageId' }, 400);
  const d = db(env);
  const m = await d.first(
    'SELECT id, content, role FROM messages WHERE id = ? AND user_id = ?',
    messageId, user.id,
  );
  if (!m) return json({ error: '消息不存在' }, 404);

  // 幂等：同 message 已收藏过直接返回
  const exist = await d.first('SELECT id FROM saved_moments WHERE user_id = ? AND message_id = ?', user.id, messageId);
  if (exist) return json({ id: exist.id, duplicate: true });

  const id = randomId();
  await d.run(
    'INSERT INTO saved_moments (id, user_id, message_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
    id, user.id, messageId, m.content, now(),
  );
  return json({ id });
}

export async function handleListSaved(_request, env, user) {
  const d = db(env);
  const rows = await d.all(
    'SELECT id, message_id, content, created_at FROM saved_moments WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
    user.id,
  );
  return json({ saved: rows });
}

export async function handleDeleteSaved(_request, env, user, pathParams) {
  const { id } = pathParams;
  const d = db(env);
  await d.run('DELETE FROM saved_moments WHERE id = ? AND user_id = ?', id, user.id);
  return json({ ok: true });
}
