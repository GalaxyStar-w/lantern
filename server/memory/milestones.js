// 小小仪式感：连续说话天数、累计消息数、首次谈到某类话题等
// 命中新里程碑时：
//   1. 写入 memorable_moments (tag=milestone)，避免重复
//   2. 返回一句温和的提示文本给前端（不推送，只在首页有个淡入提示）

import { db, now, randomId } from '../d1.js';

const DAY_MS = 24 * 3600 * 1000;

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const TOTAL_MILESTONES = [10, 50, 100, 365, 1000];

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function computeStreakDays(env, userId) {
  const d = db(env);
  const rows = await d.all(
    `SELECT created_at FROM messages
     WHERE user_id = ? AND role = 'user'
       AND (deleted IS NULL OR deleted = 0)
     ORDER BY created_at DESC LIMIT 500`,
    userId,
  );
  if (rows.length === 0) return 0;
  const days = new Set(rows.map((r) => dayKey(r.created_at)));
  let streak = 0;
  let cursor = Date.now();
  // 今天必须有才从 1 起算
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

async function countUserMessages(env, userId) {
  const d = db(env);
  const r = await d.first(
    `SELECT COUNT(*) AS n FROM messages
     WHERE user_id = ? AND role = 'user'
       AND (deleted IS NULL OR deleted = 0)`,
    userId,
  );
  return r?.n || 0;
}

async function alreadyAwarded(env, userId, tag) {
  const d = db(env);
  const r = await d.first(
    `SELECT id FROM memorable_moments
     WHERE user_id = ? AND tag = 'milestone' AND summary LIKE ?`,
    userId, `${tag}%`,
  );
  return !!r;
}

async function award(env, userId, key, phrase) {
  const d = db(env);
  await d.run(
    'INSERT INTO memorable_moments (id, user_id, message_id, tag, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    randomId(), userId, '', 'milestone', `${key}::${phrase}`, now(),
  );
}

export async function checkMilestones(env, userId) {
  const hit = [];
  try {
    const streak = await computeStreakDays(env, userId);
    for (const n of STREAK_MILESTONES) {
      if (streak === n) {
        const key = `streak_${n}`;
        if (!(await alreadyAwarded(env, userId, key))) {
          const phrase = streakPhrase(n);
          await award(env, userId, key, phrase);
          hit.push({ type: 'streak', n, phrase });
          break;
        }
      }
    }

    const total = await countUserMessages(env, userId);
    for (const n of TOTAL_MILESTONES) {
      if (total === n) {
        const key = `total_${n}`;
        if (!(await alreadyAwarded(env, userId, key))) {
          const phrase = totalPhrase(n);
          await award(env, userId, key, phrase);
          hit.push({ type: 'total', n, phrase });
          break;
        }
      }
    }
  } catch (e) {
    console.error('checkMilestones error:', e?.message);
  }
  return hit;
}

function streakPhrase(n) {
  if (n === 3) return '悄悄说一声：你已经连续 3 天来了。';
  if (n === 7) return '一周了，谢谢你没放下自己。';
  if (n === 14) return '两周了。你在慢慢地走着。';
  if (n === 30) return '一个月，这不是小事。';
  if (n === 60) return '两个月了，你比自己以为的更稳。';
  if (n === 100) return '一百天。把这盏灯收进口袋吧。';
  return `${n} 天了。`;
}

function totalPhrase(n) {
  if (n === 10) return '已经说了十次了。多说一点也没关系。';
  if (n === 50) return '五十次对话。你愿意说话这件事本身就很珍贵。';
  if (n === 100) return '一百条消息。你真的在慢慢把自己打开。';
  if (n === 365) return '累计 365 句。一年的轮廓。';
  if (n === 1000) return '一千句。这是很厚的一本册子了。';
  return `已经说了 ${n} 次话。`;
}

export async function getLatestUnreadMilestone(env, userId) {
  const d = db(env);
  const row = await d.first(
    `SELECT id, summary, created_at FROM memorable_moments
     WHERE user_id = ? AND tag = 'milestone'
     ORDER BY created_at DESC LIMIT 1`,
    userId,
  );
  if (!row) return null;
  // 24h 内的视为"未消化"
  if (Date.now() - row.created_at > DAY_MS) return null;
  const sep = row.summary.indexOf('::');
  const phrase = sep >= 0 ? row.summary.slice(sep + 2) : row.summary;
  return { id: row.id, phrase, created_at: row.created_at };
}
