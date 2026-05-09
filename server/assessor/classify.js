// 消息级规则打标：把 scoreMessage 结果序列化成 DB 字段

import { scoreMessage } from './rules.js';

export function classifyMessage(text) {
  const r = scoreMessage(text);
  const rule_tags = JSON.stringify({ phq: r.phq, gad: r.gad });
  const crisis_level = r.crisis;
  const matched = r.matched;
  return { rule_tags, crisis_level, matched };
}
