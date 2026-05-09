// 窗口聚合：把消息级规则打标聚合成 PHQ-9/GAD-7 的 0-3 分
//
// 思路：同一维度在窗口内多次出现 = 更频繁/更强烈。用"频率 + 最大强度"混合策略：
//   raw = 0.5 * max(scores) + 0.5 * (hit_count / msg_count)
//   item = floor(raw * 4)，再 clamp 到 [0, 3]
// 这个映射是启发式的，LLM 综合打分会覆盖它作为最终存档分。

import { PHQ9, GAD7 } from './rules.js';

function aggregateDim(scoresByMsg, msgCount) {
  if (msgCount === 0) return 0;
  let max = 0;
  let hits = 0;
  for (const s of scoresByMsg) {
    if (s > 0) hits += 1;
    if (s > max) max = s;
  }
  const raw = 0.5 * max + 0.5 * (hits / msgCount);
  const item = Math.max(0, Math.min(3, Math.floor(raw * 4)));
  return item;
}

// messages: [{ rule_tags: JSON string, ... }]
export function aggregateWindow(messages) {
  const phqByDim = Object.fromEntries(Object.keys(PHQ9).map(k => [k, []]));
  const gadByDim = Object.fromEntries(Object.keys(GAD7).map(k => [k, []]));

  let considered = 0;
  for (const m of messages) {
    if (m.role !== 'user' || !m.rule_tags) continue;
    let tags;
    try { tags = JSON.parse(m.rule_tags); } catch { continue; }
    considered += 1;
    for (const k of Object.keys(PHQ9)) phqByDim[k].push(tags.phq?.[k] || 0);
    for (const k of Object.keys(GAD7)) gadByDim[k].push(tags.gad?.[k] || 0);
  }

  const phq9_items = {};
  let phq9_total = 0;
  for (const k of Object.keys(PHQ9)) {
    const v = aggregateDim(phqByDim[k], considered);
    phq9_items[k] = v;
    phq9_total += v;
  }
  const gad7_items = {};
  let gad7_total = 0;
  for (const k of Object.keys(GAD7)) {
    const v = aggregateDim(gadByDim[k], considered);
    gad7_items[k] = v;
    gad7_total += v;
  }

  return { phq9_items, phq9_total, gad7_items, gad7_total, msg_count: considered };
}
