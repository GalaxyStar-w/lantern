// 用户查看和删除 AI 记得的关于 TA 的事

import { db, now } from '../d1.js';
import { json } from '../utils.js';

export async function handleMyMemory(_request, env, user) {
  const d = db(env);
  const profile = await d.first(
    'SELECT summary, entities, preferences, updated_at FROM user_profile WHERE user_id = ?',
    user.id,
  );
  const moments = await d.all(
    `SELECT id, tag, summary, created_at FROM memorable_moments
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    user.id,
  );
  return json({ profile, moments });
}

export async function handleDeleteMoment(_request, env, user, pathParams) {
  const { id } = pathParams;
  const d = db(env);
  await d.run('DELETE FROM memorable_moments WHERE id = ? AND user_id = ?', id, user.id);
  return json({ ok: true });
}

export async function handleForgetProfile(_request, env, user) {
  const d = db(env);
  await d.run('UPDATE user_profile SET summary = NULL, entities = NULL, preferences = NULL, updated_at = ? WHERE user_id = ?', now(), user.id);
  return json({ ok: true });
}
