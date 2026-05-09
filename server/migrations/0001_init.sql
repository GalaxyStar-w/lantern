-- lantern D1 schema (v1)
-- 心情陪伴聊天应用 · PHQ-9/GAD-7 后台评估 + 危机干预 + 陪伴记忆

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  nickname      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',      -- user | admin
  created_at    INTEGER NOT NULL,
  invite_code   TEXT,
  theme         TEXT DEFAULT 'night-violet',
  consent_at    INTEGER
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code          TEXT PRIMARY KEY,
  role          TEXT NOT NULL DEFAULT 'user',
  used_by       TEXT,
  created_at    INTEGER NOT NULL,
  used_at       INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_llm_configs (
  user_id       TEXT PRIMARY KEY,
  chat_endpoint TEXT,
  chat_model    TEXT,
  chat_api_key  TEXT,
  assess_endpoint TEXT,
  assess_model  TEXT,
  assess_api_key TEXT,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  started_at    INTEGER NOT NULL,
  last_msg_at   INTEGER NOT NULL,
  title         TEXT
);
CREATE INDEX IF NOT EXISTS idx_conv_user_time ON conversations(user_id, last_msg_at);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  role          TEXT NOT NULL,                      -- user | assistant
  content       TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  rule_tags     TEXT,                               -- JSON {phq:{q1:0.4,...},gad:{...}}
  crisis_level  TEXT                                -- none | monitor | medium | high
);
CREATE INDEX IF NOT EXISTS idx_messages_user_time ON messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_crisis ON messages(crisis_level) WHERE crisis_level IS NOT NULL;

CREATE TABLE IF NOT EXISTS assessments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  source        TEXT NOT NULL,                     -- rule_aggregate | llm_combined
  window_start  INTEGER NOT NULL,
  window_end    INTEGER NOT NULL,
  msg_count     INTEGER NOT NULL,
  phq9_total    INTEGER,
  phq9_items    TEXT,                              -- JSON {q1..q9}
  gad7_total    INTEGER,
  gad7_items    TEXT,                              -- JSON {g1..g7}
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_assess_user_time ON assessments(user_id, created_at);

CREATE TABLE IF NOT EXISTS crisis_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  message_id    TEXT NOT NULL,
  level         TEXT NOT NULL,                     -- medium | high
  matched_keywords TEXT,
  created_at    INTEGER NOT NULL,
  handled       INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_crisis_user_time ON crisis_events(user_id, created_at);

-- 用户画像：让 AI 越来越懂你
CREATE TABLE IF NOT EXISTS user_profile (
  user_id       TEXT PRIMARY KEY,
  summary       TEXT,
  entities      TEXT,
  preferences   TEXT,
  updated_at    INTEGER NOT NULL
);

-- 重要时刻：情感权重高的消息单独索引，供记忆召回
CREATE TABLE IF NOT EXISTS memorable_moments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  message_id    TEXT NOT NULL,
  tag           TEXT,                              -- milestone | relationship | pet | anxiety | joy | loss | work | health
  summary       TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moments_user_time ON memorable_moments(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_moments_tag ON memorable_moments(user_id, tag);
