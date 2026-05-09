// 危机判定封装（目前直接复用 rules.js 的 scoreMessage 结果）
// 独立为模块是为了后续扩展（如上下文串联判断、反问识别等）

import { CRISIS } from './rules.js';

export function detectCrisis(text) {
  if (!text) return { level: 'none', matched: [] };
  const matched = [];
  for (const kw of CRISIS.high) if (text.includes(kw)) matched.push(kw);
  if (matched.length > 0) return { level: 'high', matched };

  for (const kw of CRISIS.medium) if (text.includes(kw)) matched.push(kw);
  if (matched.length > 0) return { level: 'medium', matched };

  for (const kw of CRISIS.monitor) if (text.includes(kw)) matched.push(kw);
  if (matched.length > 0) return { level: 'monitor', matched };

  return { level: 'none', matched: [] };
}

export { CRISIS };
