import { db, now, randomId } from '../d1.js';
import { json } from '../utils.js';
import { aggregateWindow } from '../assessor/aggregate.js';
import { runLLMAssessment } from '../assessor/llmScore.js';

export async function handleAdminUsers(_request, env, _admin) {
  const d = db(env);
  const users = await d.all(
    `SELECT u.id, u.nickname, u.role, u.created_at, u.consent_at,
            (SELECT phq9_total FROM assessments a WHERE a.user_id = u.id ORDER BY a.created_at DESC LIMIT 1) AS latest_phq9,
            (SELECT gad7_total FROM assessments a WHERE a.user_id = u.id ORDER BY a.created_at DESC LIMIT 1) AS latest_gad7,
            (SELECT COUNT(*) FROM crisis_events c WHERE c.user_id = u.id AND c.handled = 0) AS unread_crisis
     FROM users u ORDER BY u.created_at DESC`,
  );
  return json({ users });
}

export async function handleAdminUserDetail(_request, env, _admin, pathParams) {
  const { userId } = pathParams;
  const d = db(env);
  const user = await d.first('SELECT id, nickname, role, created_at, consent_at FROM users WHERE id = ?', userId);
  if (!user) return json({ error: 'not found' }, 404);

  const messages = await d.all(
    'SELECT id, role, content, created_at, rule_tags, crisis_level FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
    userId,
  );
  const assessments = await d.all(
    'SELECT id, created_at, source, phq9_total, phq9_items, gad7_total, gad7_items, notes FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    userId,
  );
  const crises = await d.all(
    'SELECT id, message_id, level, matched_keywords, created_at, handled FROM crisis_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    userId,
  );
  const profile = await d.first('SELECT summary, entities, preferences, updated_at FROM user_profile WHERE user_id = ?', userId);
  const moments = await d.all(
    'SELECT id, message_id, tag, summary, created_at FROM memorable_moments WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
    userId,
  );
  return json({ user, messages, assessments, crises, profile, moments });
}

export async function handleAdminInviteList(_request, env, _admin) {
  const d = db(env);
  const codes = await d.all(
    `SELECT c.code, c.role, c.created_at, c.used_at, c.used_by, u.nickname AS used_by_name
     FROM invite_codes c LEFT JOIN users u ON c.used_by = u.id
     ORDER BY c.created_at DESC`,
  );
  return json({ codes });
}

export async function handleAdminInviteCreate(request, env, _admin) {
  const body = await request.json().catch(() => ({}));
  const role = body.role === 'admin' ? 'admin' : 'user';
  const code = body.code || generateInviteCode();
  const d = db(env);
  try {
    await d.run(
      'INSERT INTO invite_codes (code, role, created_at) VALUES (?, ?, ?)',
      code, role, now(),
    );
  } catch {
    return json({ error: '邀请码已存在，换一个' }, 409);
  }
  return json({ code, role });
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// 手动触发评估：优先 LLM 综合打分；LLM 失败时降级规则聚合
export async function handleAdminRunAssessment(_request, env, _admin, pathParams) {
  const { userId } = pathParams;
  try {
    const r = await runLLMAssessment(env, userId, { manual: true });
    if (r) return json({ source: 'llm_combined', ...r });
  } catch (e) {
    console.error('manual LLM assessment failed:', e?.message);
  }

  // 降级：规则聚合
  const d = db(env);
  const windowStart = now() - 7 * 24 * 3600 * 1000;
  const msgs = await d.all(
    `SELECT rule_tags, role FROM messages
     WHERE user_id = ? AND created_at >= ?
       AND (ephemeral IS NULL OR ephemeral = 0)
       AND (deleted IS NULL OR deleted = 0)
     ORDER BY created_at ASC`,
    userId, windowStart,
  );
  const agg = aggregateWindow(msgs);
  const id = randomId();
  await d.run(
    `INSERT INTO assessments (id, user_id, created_at, source, window_start, window_end, msg_count, phq9_total, phq9_items, gad7_total, gad7_items, notes)
     VALUES (?, ?, ?, 'rule_aggregate', ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, userId, now(), windowStart, now(), agg.msg_count,
    agg.phq9_total, JSON.stringify(agg.phq9_items),
    agg.gad7_total, JSON.stringify(agg.gad7_items),
    null,
  );
  return json({ id, source: 'rule_aggregate', ...agg });
}
