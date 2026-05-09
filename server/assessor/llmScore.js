// LLM 综合评估 + 画像更新
// 一次调用同时输出：PHQ-9 各项 / GAD-7 各项 / notes / profile 更新
// 触发条件：满足"至少 20 条新 user 消息"或"距上次评估 >24h 且期间 >=5 条"，24h 内最多 3 次

import { db, now, randomId } from '../d1.js';
import { callChat } from '../llm.js';
import { aggregateWindow } from './aggregate.js';

const MIN_MSGS_BY_COUNT = 20;
const MIN_MSGS_BY_TIME = 5;
const TIME_WINDOW_MS = 24 * 3600 * 1000;
const MAX_PER_DAY = 3;
const CONTEXT_MESSAGE_LIMIT = 60;
const PROMPT_TEXT_LIMIT = 4000;

export async function shouldTriggerLLMAssessment(env, userId) {
  const d = db(env);
  const recentAssess = await d.first(
    `SELECT created_at FROM assessments
     WHERE user_id = ? AND source = 'llm_combined'
     ORDER BY created_at DESC LIMIT 1`,
    userId,
  );
  const todayCount = await d.first(
    `SELECT COUNT(*) AS n FROM assessments
     WHERE user_id = ? AND source = 'llm_combined' AND created_at >= ?`,
    userId, Date.now() - TIME_WINDOW_MS,
  );
  if ((todayCount?.n || 0) >= MAX_PER_DAY) return false;

  const since = recentAssess?.created_at || 0;
  const newMsgs = await d.first(
    `SELECT COUNT(*) AS n FROM messages
     WHERE user_id = ? AND role = 'user' AND created_at > ?
       AND (ephemeral IS NULL OR ephemeral = 0)
       AND (deleted IS NULL OR deleted = 0)`,
    userId, since,
  );
  const n = newMsgs?.n || 0;
  if (n >= MIN_MSGS_BY_COUNT) return true;
  if (n >= MIN_MSGS_BY_TIME && (Date.now() - since) >= TIME_WINDOW_MS) return true;
  return false;
}

function truncate(s, max) {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max) + '…';
}

export async function runLLMAssessment(env, userId, { manual = false } = {}) {
  const d = db(env);
  const last = await d.first(
    `SELECT created_at FROM assessments WHERE user_id = ? AND source = 'llm_combined' ORDER BY created_at DESC LIMIT 1`,
    userId,
  );
  const since = last?.created_at || Date.now() - 14 * 24 * 3600 * 1000;

  const rows = await d.all(
    `SELECT id, role, content, rule_tags, crisis_level, created_at
     FROM messages
     WHERE user_id = ? AND role = 'user' AND created_at > ?
       AND (ephemeral IS NULL OR ephemeral = 0)
       AND (deleted IS NULL OR deleted = 0)
     ORDER BY created_at ASC LIMIT ?`,
    userId, since, CONTEXT_MESSAGE_LIMIT,
  );

  if (rows.length === 0 && !manual) return null;

  // 当前画像
  const currentProfile = await d.first(
    'SELECT summary, entities, preferences FROM user_profile WHERE user_id = ?',
    userId,
  );

  const ruleAgg = aggregateWindow(rows);

  const msgDump = truncate(
    rows.map((m, i) => `${i + 1}. ${m.content}`).join('\n'),
    PROMPT_TEXT_LIMIT,
  );

  const sys = `你是一个临床心理评估助手。你不诊断、不给治疗建议。你要基于给定的用户消息窗口，严格输出 JSON。

任务 A：按 DSM-5 语义对窗口内用户消息整体打 PHQ-9 与 GAD-7 分（每项 0-3 分）。
  - 证据不足的项必须给 0，不猜测
  - 不被单条极端语言带偏；看整体频率和强度
  - 规则预打分只是参考，不必机械套用

任务 B：更新用户画像，用于下次聊天让 AI "更懂这个人"。
  - summary：200 字以内自然语言，描述这个人最近的状态、在意的事、表达风格
  - entities：{people:[{name,relation,notes}], pets:[{name,notes}], recurring_events:["..."]}，只记稳定出现的
  - preferences：{comforting_topics:[], avoid_topics:[]}
  - 合并当前已有画像（保留还成立的部分，更新/增补新信息，删掉明显过时的）

任务 C：notes 50 字以内，客观陈述（供管理员/咨询师看）

严格按如下 JSON 输出，不写多余文字：
{
  "phq9_items": {"q1":0,"q2":0,"q3":0,"q4":0,"q5":0,"q6":0,"q7":0,"q8":0,"q9":0},
  "gad7_items": {"g1":0,"g2":0,"g3":0,"g4":0,"g5":0,"g6":0,"g7":0},
  "notes": "...",
  "profile": {
    "summary": "...",
    "entities": {"people":[],"pets":[],"recurring_events":[]},
    "preferences": {"comforting_topics":[],"avoid_topics":[]}
  }
}`;

  const userMsg = `【规则预打分参考】
PHQ-9 初步总分: ${ruleAgg.phq9_total} / 27
GAD-7 初步总分: ${ruleAgg.gad7_total} / 21
分项: ${JSON.stringify(ruleAgg.phq9_items)} | ${JSON.stringify(ruleAgg.gad7_items)}

【当前画像（如果有）】
${currentProfile?.summary ? 'summary: ' + currentProfile.summary : '（暂无）'}
${currentProfile?.entities ? 'entities: ' + currentProfile.entities : ''}
${currentProfile?.preferences ? 'preferences: ' + currentProfile.preferences : ''}

【最近 ${rows.length} 条用户消息】
${msgDump}

现在请输出 JSON。`;

  let parsed = null;
  try {
    const raw = await callChat(env, userId, [
      { role: 'system', content: sys },
      { role: 'user', content: userMsg },
    ], { temperature: 0.2, maxTokens: 1200 });

    // 宽松 JSON 抽取
    const jsonText = extractJSON(raw);
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error('LLM assessment failed:', e?.message);
    return null;
  }

  // 校验 & 限幅
  const phq9 = sanitizeItems(parsed.phq9_items, 9, 'q');
  const gad7 = sanitizeItems(parsed.gad7_items, 7, 'g');
  const phq9_total = Object.values(phq9).reduce((a, b) => a + b, 0);
  const gad7_total = Object.values(gad7).reduce((a, b) => a + b, 0);

  const assessId = randomId();
  await d.run(
    `INSERT INTO assessments
     (id, user_id, created_at, source, window_start, window_end, msg_count, phq9_total, phq9_items, gad7_total, gad7_items, notes)
     VALUES (?, ?, ?, 'llm_combined', ?, ?, ?, ?, ?, ?, ?, ?)`,
    assessId, userId, now(),
    rows[0]?.created_at || since, rows[rows.length - 1]?.created_at || now(), rows.length,
    phq9_total, JSON.stringify(phq9),
    gad7_total, JSON.stringify(gad7),
    (parsed.notes || '').toString().slice(0, 200),
  );

  // 画像更新
  if (parsed.profile && typeof parsed.profile === 'object') {
    const p = parsed.profile;
    const summary = (p.summary || '').toString().slice(0, 400);
    const entities = safeJSON(p.entities);
    const preferences = safeJSON(p.preferences);
    const exists = await d.first('SELECT user_id FROM user_profile WHERE user_id = ?', userId);
    if (exists) {
      await d.run(
        'UPDATE user_profile SET summary = ?, entities = ?, preferences = ?, updated_at = ? WHERE user_id = ?',
        summary || null, entities, preferences, now(), userId,
      );
    } else {
      await d.run(
        'INSERT INTO user_profile (user_id, summary, entities, preferences, updated_at) VALUES (?, ?, ?, ?, ?)',
        userId, summary || null, entities, preferences, now(),
      );
    }
  }

  return { assessId, phq9_total, gad7_total };
}

function sanitizeItems(obj, n, prefix) {
  const out = {};
  for (let i = 1; i <= n; i++) {
    const k = `${prefix}${i}`;
    let v = Number(obj?.[k]);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, Math.min(3, Math.round(v)));
    out[k] = v;
  }
  return out;
}

function safeJSON(val) {
  if (val == null) return null;
  try { return JSON.stringify(val); } catch { return null; }
}

function extractJSON(raw) {
  if (!raw) throw new Error('空回复');
  // 去 markdown code fence
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  }
  // 定位第一个 { 到最后一个 }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('无 JSON');
  return t.slice(first, last + 1);
}

// fire-and-forget 包装
export async function maybeRunLLMAssessment(env, userId) {
  try {
    if (!(await shouldTriggerLLMAssessment(env, userId))) return;
    await runLLMAssessment(env, userId);
  } catch (e) {
    console.error('maybeRunLLMAssessment error:', e?.message);
  }
}
