// 前端实时关键词兜底（后端也有一份 server/assessor/crisis.js，手动同步）
// 用途：用户刚发完消息、网络慢时前端即时显示 CrisisBanner，不等后端回执

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
} as const;

export type CrisisLevel = 'none' | 'monitor' | 'medium' | 'high';

export function detectCrisis(text: string): { level: CrisisLevel; matched: string[] } {
  if (!text) return { level: 'none', matched: [] };
  const matched: string[] = [];

  for (const kw of CRISIS.high) if (text.includes(kw)) matched.push(kw);
  if (matched.length > 0) return { level: 'high', matched };

  for (const kw of CRISIS.medium) if (text.includes(kw)) matched.push(kw);
  if (matched.length > 0) return { level: 'medium', matched };

  for (const kw of CRISIS.monitor) if (text.includes(kw)) matched.push(kw);
  if (matched.length > 0) return { level: 'monitor', matched };

  return { level: 'none', matched: [] };
}
