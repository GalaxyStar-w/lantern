# lantern · 心理陪伴聊天应用

一个以「陪伴安抚」为核心的聊天小应用。用户只是在聊天，后台通过算法悄悄把对话内容映射成 PHQ-9 / GAD-7 等量表得分，给管理者一个观测窗口。用户端**不出现**任何分数、量表名、诊断词——只有「心情天气」的比喻和柔和的动态背景。

## 当前状态（阶段 1）

- [x] 骨架：Vite + React 19 + TS 前端，Cloudflare Pages + 独立 Worker + D1 后端
- [x] 邀请码登录（邀请码 = 账号）
- [x] 聊天（mock echo 回复）
- [x] 消息级规则打标：PHQ-9 / GAD-7 / 危机三级
- [x] 心情天气可视化：5 档天气 + CSS 动态背景 + 30 天色带
- [x] 管理后台：用户列表、详情页（含专业模式）、邀请码管理
- [x] smoke-assessor 烟雾测试

## 下一步（阶段 2+）

- 接真实 LLM（OpenAI-compatible，SSE 流式）
- LLM 综合评估 + 用户画像 + 重要时刻（陪伴记忆）
- 雨/风雨天气的 Canvas 粒子版
- 知情同意弹窗
- 更多危机资源

## 本地开发

```bash
npm install
npx wrangler d1 create lantern-db     # 拿到 database_id 填 server/wrangler.toml
npm run d1:migrate:local              # 初始化本地 D1
cd server && npx wrangler dev --port 8787   # 后端
# 另一个终端
npm run dev                           # 前端（已配置 /api 代理到 :8787）
npm run smoke                         # 跑评估器烟雾测试
```

## 部署

```bash
# 首次
npx wrangler d1 create lantern-db     # 记 database_id 填 server/wrangler.toml
npm run d1:migrate                    # 初始化远程 D1
npx wrangler d1 execute lantern-db --remote --file=./scripts/seed-d1.sql

# 每次发布
npm run deploy:all                    # 先 Worker 再 Pages
```

访问 `https://lantern.pages.dev`，用 seed 插入的邀请码 `ADMIN-LANTERN-001` 登录为管理员。

## 架构

```
lantern.pages.dev (Pages)
  └─ _worker.js  /api/* → env.SERVER.fetch
                 其他   → env.ASSETS.fetch

lantern-server (独立 Worker)
  ├─ D1: lantern-db
  └─ /api/auth/login, /api/chat, /api/me/mood, /api/admin/*
```

前端文件在 `src/`，沿用 dinner-score 的 `core/modules/state/ui` 四层分层。
后端文件在 `server/`，router 在 `worker.js`，handler 分在 `handlers/`。

详细计划见 `~/.claude/plans/playful-chasing-pumpkin.md`。
