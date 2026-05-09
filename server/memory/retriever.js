// 组装记忆上下文：profile 摘要 + 重要时刻召回
// 每次聊天前调用，返回附加到 system prompt 的字符串

import { db } from '../d1.js';

const MAX_MOMENTS = 5;
const MAX_DAYS = 90;

export async function buildMemoryContext(env, userId) {
  const d = db(env);
  const profile = await d.first(
    'SELECT summary, entities, preferences FROM user_profile WHERE user_id = ?',
    userId,
  );
  const since = Date.now() - MAX_DAYS * 24 * 3600 * 1000;

  // 取最近 + 不同 tag 的重要时刻，混合召回
  const recent = await d.all(
    `SELECT tag, summary, created_at FROM memorable_moments
     WHERE user_id = ? AND created_at >= ?
     ORDER BY created_at DESC LIMIT ?`,
    userId, since, MAX_MOMENTS * 3,
  );

  // 按 tag 多样化
  const byTag = {};
  const picked = [];
  for (const m of recent) {
    const t = m.tag || 'other';
    if (!byTag[t] || byTag[t] < 2) {
      byTag[t] = (byTag[t] || 0) + 1;
      picked.push(m);
      if (picked.length >= MAX_MOMENTS) break;
    }
  }

  const lines = [];
  if (profile?.summary) {
    lines.push(`【关于这个人】\n${profile.summary}`);
  }
  if (profile?.entities) {
    try {
      const e = JSON.parse(profile.entities);
      const bits = [];
      if (e.people?.length) bits.push('重要的人：' + e.people.slice(0, 3).map((p) => `${p.name}（${p.relation || '?'}）`).join('、'));
      if (e.pets?.length)   bits.push('宠物：'   + e.pets.map((p) => p.name || p).join('、'));
      if (e.recurring_events?.length) bits.push('一直在发生的事：' + e.recurring_events.slice(0, 3).join('、'));
      if (bits.length) lines.push(bits.join('\n'));
    } catch {
      // 静默
    }
  }
  if (picked.length) {
    const formatted = picked.map((m) => {
      const daysAgo = Math.floor((Date.now() - m.created_at) / (24 * 3600 * 1000));
      const when = daysAgo === 0 ? '今天' : daysAgo === 1 ? '昨天' : daysAgo < 7 ? `${daysAgo} 天前` : daysAgo < 30 ? `${Math.floor(daysAgo / 7)} 周前` : `约 ${Math.floor(daysAgo / 30)} 月前`;
      return `- ${when}：${m.summary}`;
    }).join('\n');
    lines.push(`【TA 曾经说过的一些事】\n${formatted}\n\n（在自然处可以轻轻提起，但不要生硬复读；如果对方没主动谈，也别硬往上凑）`);
  }

  return lines.join('\n\n');
}

export async function getDaysSinceLastSeen(env, userId) {
  const d = db(env);
  const row = await d.first(
    'SELECT last_seen_at FROM users WHERE id = ?',
    userId,
  );
  if (!row?.last_seen_at) return null;
  return Math.floor((Date.now() - row.last_seen_at) / (24 * 3600 * 1000));
}

export async function updateLastSeen(env, userId) {
  const d = db(env);
  await d.run('UPDATE users SET last_seen_at = ? WHERE id = ?', Date.now(), userId);
}
