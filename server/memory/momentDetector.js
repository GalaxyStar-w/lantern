// 重要时刻识别
// 策略：基于消息内容的轻量规则 + crisis_level 命中，不调 LLM（便宜）
// LLM 综合评估时（阶段 3 自动触发）会再做一次精细提取

import { db, randomId, now } from '../d1.js';

const RELATION_WORDS = ['妈', '母亲', '爸', '父亲', '男朋友', '女朋友', '前任', '对象', '老公', '老婆', '伴侣', '朋友', '同事', '老板', '导师', '医生'];
const PET_WORDS = ['猫', '狗', '鸟', '兔子', '乌龟', '鱼', '宠物', '仓鼠'];
const WORK_WORDS = ['工作', '项目', '加班', '汇报', '论文', '答辩', '考试', '面试', 'deadline', '老板'];
const HEALTH_WORDS = ['生病', '住院', '手术', '吃药', '检查', '医院', '发烧', '疼', '痛'];
const LOSS_WORDS = ['分手', '离婚', '去世', '走了', '失去', '没了'];
const JOY_WORDS = ['开心', '高兴', '太好了', '终于', '成功', '通过了'];

export async function maybeRecordMoment(env, { userId, messageId, content, crisis_level }) {
  const tags = [];
  const texts = [];

  if (crisis_level === 'high' || crisis_level === 'medium') {
    tags.push('anxiety');
    texts.push(content.slice(0, 80));
  }

  for (const w of RELATION_WORDS) if (content.includes(w)) { tags.push('relationship'); break; }
  for (const w of PET_WORDS)      if (content.includes(w)) { tags.push('pet'); break; }
  for (const w of WORK_WORDS)     if (content.includes(w)) { tags.push('work'); break; }
  for (const w of HEALTH_WORDS)   if (content.includes(w)) { tags.push('health'); break; }
  for (const w of LOSS_WORDS)     if (content.includes(w)) { tags.push('loss'); break; }
  for (const w of JOY_WORDS)      if (content.includes(w)) { tags.push('joy'); break; }

  if (tags.length === 0) return;

  const d = db(env);
  // 去重：同 tag 在 24h 内不重复记
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const tag of tags) {
    const exist = await d.first(
      'SELECT id FROM memorable_moments WHERE user_id = ? AND tag = ? AND created_at >= ? LIMIT 1',
      userId, tag, cutoff,
    );
    if (exist) continue;
    const summary = content.length > 60 ? content.slice(0, 60) + '…' : content;
    await d.run(
      'INSERT INTO memorable_moments (id, user_id, message_id, tag, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      randomId(), userId, messageId, tag, summary, now(),
    );
  }
}
