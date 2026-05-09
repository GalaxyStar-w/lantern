// 一键导出用户全部数据（JSON）
// 给用户"我拥有自己的数据"的踏实感

import { db } from '../d1.js';
import { json } from '../utils.js';

export async function handleExport(_request, env, user) {
  const d = db(env);
  const [messages, assessments, moments, saved, letters, profile] = await Promise.all([
    d.all('SELECT id, role, content, created_at, crisis_level, silent, ephemeral FROM messages WHERE user_id = ? ORDER BY created_at ASC', user.id),
    d.all('SELECT * FROM assessments WHERE user_id = ? ORDER BY created_at ASC', user.id),
    d.all('SELECT id, tag, summary, created_at FROM memorable_moments WHERE user_id = ? ORDER BY created_at ASC', user.id),
    d.all('SELECT id, content, created_at FROM saved_moments WHERE user_id = ? ORDER BY created_at ASC', user.id),
    d.all('SELECT id, content, created_at, deliver_at, read_at FROM future_letters WHERE user_id = ? ORDER BY created_at ASC', user.id),
    d.first('SELECT summary, entities, preferences FROM user_profile WHERE user_id = ?', user.id),
  ]);

  const data = {
    exported_at: Date.now(),
    user: { id: user.id, nickname: user.nickname, role: user.role, consent_at: user.consent_at },
    profile,
    messages,
    assessments,
    moments,
    saved,
    letters,
  };
  return json(data, 200, {
    'Content-Disposition': `attachment; filename="lantern-${user.nickname || user.id}-${new Date().toISOString().slice(0, 10)}.json"`,
  });
}
