// 用户/管理员拉取评估数据
// 用户视角：只返回心情天气 + 色带，不返回分数
// admin 视角：原始 phq9/gad7 分项

import { db, now } from '../d1.js';
import { aggregateWindow } from '../assessor/aggregate.js';
import { phqToWeather, gadWindIntensity, trendPhrase } from '../assessor/moodWeather.js';
import { json } from '../utils.js';

const DAY_MS = 24 * 3600 * 1000;

async function dailyWeatherBand(env, userId, days) {
  const d = db(env);
  const end = now();
  const start = end - days * DAY_MS;
  const rows = await d.all(
    'SELECT created_at, rule_tags, role FROM messages WHERE user_id = ? AND created_at >= ? ORDER BY created_at ASC',
    userId, start,
  );

  const buckets = Array.from({ length: days }, (_, i) => {
    const dayStart = start + i * DAY_MS;
    return { dayStart, msgs: [] };
  });
  for (const m of rows) {
    if (m.role !== 'user') continue;
    const idx = Math.min(days - 1, Math.floor((m.created_at - start) / DAY_MS));
    if (idx >= 0) buckets[idx].msgs.push(m);
  }

  return buckets.map(({ dayStart, msgs }) => {
    if (msgs.length === 0) return { dayStart, weather: null };
    const agg = aggregateWindow(msgs);
    const w = phqToWeather(agg.phq9_total);
    return {
      dayStart,
      weather: w.key,
      wind: gadWindIntensity(agg.gad7_total),
    };
  });
}

export async function handleUserMood(_request, env, user) {
  const days = 30;
  const band = await dailyWeatherBand(env, user.id, days);

  // 当前天气 = 最近有消息的那一天 + 近 3 天的消息再聚合一次
  const d = db(env);
  const since = now() - 3 * DAY_MS;
  const recent = await d.all(
    'SELECT rule_tags, role FROM messages WHERE user_id = ? AND created_at >= ? ORDER BY created_at ASC',
    user.id, since,
  );
  const agg3d = aggregateWindow(recent);
  const currentWeather = phqToWeather(agg3d.phq9_total);
  const windIntensity = gadWindIntensity(agg3d.gad7_total);

  const recentKeys = band.slice(-7).filter((b) => b.weather).map((b) => b.weather);
  const phrase = trendPhrase(recentKeys.length > 0 ? recentKeys : [currentWeather.key]);

  return json({
    current: { weather: currentWeather.key, label: currentWeather.label, emoji: currentWeather.emoji, phrase: currentWeather.phrase, wind: windIntensity },
    band,
    narrative: phrase,
  });
}

// admin 视角：返回真实分数 + 近 30 天每日聚合
export async function handleAdminAssessment(_request, env, _user, pathParams) {
  const targetUserId = pathParams?.userId;
  if (!targetUserId) return json({ error: '缺少 userId' }, 400);
  const d = db(env);
  const latest = await d.first(
    'SELECT * FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    targetUserId,
  );
  const timeline = await d.all(
    'SELECT id, created_at, source, phq9_total, gad7_total, notes FROM assessments WHERE user_id = ? ORDER BY created_at ASC LIMIT 100',
    targetUserId,
  );
  return json({ latest, timeline });
}
