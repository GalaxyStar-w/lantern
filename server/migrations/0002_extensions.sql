-- lantern migration v2
-- 新增：个性化（address_as / tone_style）、背景主题、静默模式、收藏、未来信件

-- 用户扩展字段
ALTER TABLE users ADD COLUMN address_as TEXT;               -- AI 怎么称呼你（空 = 不特别叫）
ALTER TABLE users ADD COLUMN tone_style TEXT DEFAULT 'warm'; -- warm | calm | quiet
ALTER TABLE users ADD COLUMN background TEXT DEFAULT 'weather'; -- weather | starry | seaside | dawn
ALTER TABLE users ADD COLUMN last_seen_at INTEGER;          -- 上次打开的时间，久别再见用

-- 消息新增：ephemeral（临时模式，不计评估/记忆）、deleted（软删）、silent（写信模式，不触发 AI 回复）
ALTER TABLE messages ADD COLUMN ephemeral INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN silent INTEGER DEFAULT 0;

-- 收藏被抚慰的句子
CREATE TABLE IF NOT EXISTS saved_moments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  message_id    TEXT NOT NULL,
  content       TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_user_time ON saved_moments(user_id, created_at);

-- 给未来的自己写信
CREATE TABLE IF NOT EXISTS future_letters (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  content       TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  deliver_at    INTEGER NOT NULL,
  delivered     INTEGER DEFAULT 0,
  read_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_letters_user_deliver ON future_letters(user_id, deliver_at);
