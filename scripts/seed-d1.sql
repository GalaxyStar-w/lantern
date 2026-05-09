-- 首次部署后执行：插入一个管理员邀请码
-- 用法：
--   npx wrangler d1 execute lantern-db --remote --file=./scripts/seed-d1.sql
-- 然后用这个邀请码登录即可成为管理员

INSERT OR IGNORE INTO invite_codes (code, role, created_at)
VALUES ('ADMIN-LANTERN-001', 'admin', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
