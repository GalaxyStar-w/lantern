-- lantern migration v3
-- tone_style 重构：calm/quiet 都统一迁到 professional（两个旧值在新 prompt 里都走专业型映射）
-- 新默认值：professional（让新用户默认得到咨询师级体验）

-- 已有用户：旧值转新值
UPDATE users SET tone_style = 'professional' WHERE tone_style IN ('calm', 'quiet');

-- 注意：SQLite 不能 ALTER COLUMN DEFAULT，保留列定义不动；
-- 新用户的 default 由 insertUsers 时应用层指定（见 server/auth.js loginWithInvite 里硬写 'night-violet'，
-- tone_style 没显式写所以走 DB default 'warm'——这个让用户稍后在设置里自己切即可，不影响功能）
