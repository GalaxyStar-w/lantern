// PHQ-9 + GAD-7 + 危机关键词规则表
// 前端 src/core/crisis.ts 需手动同步此文件的 CRISIS 部分

// 每条 user 消息过一次匹配：命中强信号 += 0.6，弱信号 += 0.2，单维度上限 1.0。
// 后续窗口聚合时把单次得分累加并折算到 PHQ-9 的 0-3 分量表。

export const PHQ9 = {
  q1: {
    name: 'anhedonia',
    label: '兴趣减退',
    strong: ['什么都不想做', '没兴趣', '提不起劲', '没意思', '没劲', '毫无乐趣', '都不想碰'],
    weak: ['懒得', '算了', '无所谓', '都可以', '随便吧'],
  },
  q2: {
    name: 'depressed_mood',
    label: '情绪低落',
    strong: ['难过', '伤心', '想哭', '好丧', '低落', '压抑', '郁闷', '心情差', '绝望'],
    weak: ['心里堵', '闷闷', 'emo', '不太开心', '有点丧'],
  },
  q3: {
    name: 'sleep',
    label: '睡眠问题',
    strong: ['失眠', '睡不着', '入睡困难', '早醒', '凌晨醒', '嗜睡', '一直想睡', '睡太多'],
    weak: ['精神差', '很困', '睡不好', '醒了很多次'],
  },
  q4: {
    name: 'fatigue',
    label: '疲劳',
    strong: ['精疲力尽', '没力气', '疲惫', '起不来', '动不了', '累得不行', '浑身无力'],
    weak: ['累', '懒得动', '不想起床'],
  },
  q5: {
    name: 'appetite',
    label: '食欲',
    strong: ['吃不下', '没胃口', '暴饮暴食', '狂吃', '瘦了很多', '胖了很多'],
    weak: ['吃得少', '随便吃', '没什么食欲'],
  },
  q6: {
    name: 'worthlessness',
    label: '自我否定',
    strong: ['我没用', '我废物', '我是累赘', '都是我的错', '我不配', '讨厌自己', '恨自己', '我很失败', '自己没用', '没什么用'],
    weak: ['做不好', '搞砸', '又失败', '对不起别人'],
  },
  q7: {
    name: 'concentration',
    label: '注意力',
    strong: ['集中不了', '脑子一团浆糊', '什么都记不住', '看不进去', '思维混乱'],
    weak: ['走神', '发呆', '效率低', '脑子很乱'],
  },
  q8: {
    name: 'psychomotor',
    label: '精神运动',
    strong: ['坐不住', '话变少', '不想说话', '反应变慢', '动作变慢'],
    weak: ['烦躁', '静不下来', '有点呆'],
  },
  q9: {
    name: 'suicidal',
    label: '自杀/自伤',
    strong: ['想死', '不想活', '活着没意思', '活下去没意义', '自杀', '从楼上', '割腕', '消失就好', '结束自己', '自残'],
    weak: ['如果没有我', '这个世界没我', '睡过去就好了'],
  },
};

export const GAD7 = {
  g1: {
    name: 'nervous',
    label: '紧张焦虑',
    strong: ['焦虑', '紧张', '心慌', '发抖', '心悸'],
    weak: ['不安', '心里悬着'],
  },
  g2: {
    name: 'uncontrolled_worry',
    label: '停不下担心',
    strong: ['一直想', '反复想', '停不下来', '脑子里循环', '想个不停'],
    weak: ['担心', '挂念'],
  },
  g3: {
    name: 'over_worry',
    label: '过度担心',
    strong: ['害怕发生', '老是怕', '过度担心', '灾难性后果'],
    weak: ['怕', '担心会'],
  },
  g4: {
    name: 'restless_hard_to_relax',
    label: '难以放松',
    strong: ['放松不了', '静不下来', '绷着', '松不下来'],
    weak: ['紧绷'],
  },
  g5: {
    name: 'restless_motor',
    label: '坐立不安',
    strong: ['坐不住', '烦躁走来走去', '来回踱步'],
    weak: ['烦'],
  },
  g6: {
    name: 'irritable',
    label: '易激惹',
    strong: ['一点就炸', '发脾气', '想骂人', '忍不住发火', '一碰就爆'],
    weak: ['不耐烦', '烦躁'],
  },
  g7: {
    name: 'afraid',
    label: '害怕恐惧',
    strong: ['害怕', '恐惧', '恐慌', 'panic', '惊恐'],
    weak: ['有点怕', '害怕怕的'],
  },
};

// 危机分层：high 必须 UI 干预 + 落库；medium 仅落库并暗示 LLM；monitor 仅落标签
export const CRISIS = {
  high: [
    '想死', '不想活', '不想活了', '活着没意思', '活着没意义',
    '自杀', '从楼上跳', '跳楼', '割腕', '烧炭',
    '结束生命', '结束自己', '消失就好', '自残', '服药过量', '吃一瓶药',
  ],
  medium: [
    '没救了', '看不到希望', '没有希望', '没意义', '活着干嘛',
    '撑不住', '撑不下去', '消失', '不存在就好',
  ],
  monitor: [
    '孤独', '没人懂', '好累', '累死了', '撑着', '没有人在乎',
  ],
};

// 规则打分：给单条消息打标
// 返回 { phq: {q1..q9:0-1}, gad: {g1..g7:0-1}, crisis: 'none'|'monitor'|'medium'|'high', matched: string[] }
export function scoreMessage(text) {
  if (!text || typeof text !== 'string') {
    return { phq: {}, gad: {}, crisis: 'none', matched: [] };
  }
  const phq = {};
  const gad = {};

  for (const [key, dim] of Object.entries(PHQ9)) {
    let s = 0;
    for (const kw of dim.strong) if (text.includes(kw)) s += 0.6;
    for (const kw of dim.weak) if (text.includes(kw)) s += 0.2;
    if (s > 0) phq[key] = Math.min(1, s);
  }
  for (const [key, dim] of Object.entries(GAD7)) {
    let s = 0;
    for (const kw of dim.strong) if (text.includes(kw)) s += 0.6;
    for (const kw of dim.weak) if (text.includes(kw)) s += 0.2;
    if (s > 0) gad[key] = Math.min(1, s);
  }

  const matched = [];
  let crisis = 'none';
  for (const kw of CRISIS.high) if (text.includes(kw)) { matched.push(kw); crisis = 'high'; }
  if (crisis !== 'high') {
    for (const kw of CRISIS.medium) if (text.includes(kw)) { matched.push(kw); crisis = 'medium'; }
  }
  if (crisis === 'none') {
    for (const kw of CRISIS.monitor) if (text.includes(kw)) { matched.push(kw); crisis = 'monitor'; }
  }

  return { phq, gad, crisis, matched };
}
