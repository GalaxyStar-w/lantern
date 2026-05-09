// scripts/smoke-assessor.mjs
// 快速验证 PHQ-9 / GAD-7 / 危机 的规则打标是否符合预期
// 运行：npm run smoke

import { scoreMessage } from '../server/assessor/rules.js';
import { aggregateWindow } from '../server/assessor/aggregate.js';
import { phqToWeather } from '../server/assessor/moodWeather.js';

const CASES = [
  { text: '今天过得还行，午饭吃了个面。', expectCrisis: 'none' },
  { text: '最近总是睡不着，凌晨三点就醒了。', expectCrisis: 'none', expectPhq: ['q3'] },
  { text: '提不起劲做任何事，以前喜欢的游戏也不想玩。', expectCrisis: 'none', expectPhq: ['q1'] },
  { text: '我觉得自己很废物，做什么都搞砸。', expectCrisis: 'none', expectPhq: ['q6'] },
  { text: '一直紧张得心慌，脑子里停不下来一直想工作的事。', expectCrisis: 'none', expectGad: ['g1', 'g2'] },
  { text: '没胃口，已经两天没好好吃饭了。', expectPhq: ['q5'] },
  { text: '很累，起不来床。', expectPhq: ['q4'] },
  { text: '压抑死了，郁闷得想哭。', expectPhq: ['q2'] },
  { text: '害怕坐地铁，恐慌发作了几次。', expectGad: ['g7'] },
  { text: '同事一点就炸，我都快想骂人了。', expectGad: ['g6'] },
  { text: '注意力完全集中不了，脑子一团浆糊。', expectPhq: ['q7'] },

  // 危机触发
  { text: '我活着真的没什么意思，想死。', expectCrisis: 'high', expectPhq: ['q9'] },
  { text: '割腕的念头又冒出来了。', expectCrisis: 'high', expectPhq: ['q9'] },
  { text: '没救了，看不到希望。', expectCrisis: 'medium' },
  { text: '撑不下去了。', expectCrisis: 'medium' },
  { text: '太孤独了，没人懂我。', expectCrisis: 'monitor' },
  { text: '好累，真的累死了。', expectCrisis: 'monitor', expectPhq: ['q4'] },

  // 复合信号
  { text: '失眠、没胃口、什么都不想做，感觉自己没用。', expectPhq: ['q1', 'q3', 'q5', 'q6'] },
  { text: '一直想一件事，焦虑到坐不住。', expectGad: ['g2'] }, // g2 命中"一直想"；g5 "坐不住"
  { text: '想消失就好了。', expectCrisis: 'high' },
];

let passed = 0;
let failed = 0;
const failures = [];

function fail(msg) {
  failed += 1;
  failures.push(msg);
  console.error('  ✗', msg);
}

function ok(msg) {
  passed += 1;
  console.log('  ✓', msg);
}

console.log('=== lantern assessor smoke ===\n');

for (const c of CASES) {
  console.log(`· 「${c.text}」`);
  const r = scoreMessage(c.text);

  if (c.expectCrisis) {
    if (r.crisis === c.expectCrisis) ok(`crisis = ${r.crisis}`);
    else fail(`crisis 期望 ${c.expectCrisis}，实际 ${r.crisis}`);
  }
  if (c.expectPhq) {
    for (const q of c.expectPhq) {
      if ((r.phq[q] ?? 0) > 0) ok(`PHQ ${q} 命中 (${r.phq[q].toFixed(1)})`);
      else fail(`PHQ ${q} 应命中但未命中`);
    }
  }
  if (c.expectGad) {
    for (const g of c.expectGad) {
      if ((r.gad[g] ?? 0) > 0) ok(`GAD ${g} 命中 (${r.gad[g].toFixed(1)})`);
      else fail(`GAD ${g} 应命中但未命中`);
    }
  }
  console.log('');
}

// 窗口聚合 + 天气映射
console.log('=== 窗口聚合 ===');
const winMsgs = CASES.map((c) => ({
  role: 'user',
  rule_tags: JSON.stringify({ phq: scoreMessage(c.text).phq, gad: scoreMessage(c.text).gad }),
}));
const agg = aggregateWindow(winMsgs);
console.log(`  PHQ-9 总分: ${agg.phq9_total}  GAD-7 总分: ${agg.gad7_total}  消息: ${agg.msg_count}`);
console.log(`  心情天气: ${phqToWeather(agg.phq9_total).label} (${phqToWeather(agg.phq9_total).emoji})`);
if (agg.phq9_total >= 10) ok('抑郁向消息堆叠聚合出的 PHQ-9 >= 10（偏阴/雨）');
else fail(`PHQ-9 总分 ${agg.phq9_total} 低于预期 10`);

console.log(`\n=== 结果 ===`);
console.log(`通过 ${passed} · 失败 ${failed}`);
if (failed > 0) {
  console.error('\n失败详情:');
  for (const f of failures) console.error('  -', f);
  process.exit(1);
}
