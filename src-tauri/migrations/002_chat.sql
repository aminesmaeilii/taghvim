PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('DIRECT', 'GROUP')),
  title TEXT,
  avatar_url TEXT,
  created_by TEXT NOT NULL,
  direct_key TEXT UNIQUE,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_conversation_members (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  joined_at TEXT NOT NULL,
  last_read_at TEXT,
  muted_at TEXT,
  data_json TEXT NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'TEXT',
  body TEXT NOT NULL,
  context_type TEXT,
  context_id TEXT,
  context_metadata_json TEXT,
  client_message_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  deleted_at TEXT,
  data_json TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  UNIQUE (conversation_id, sender_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_conversation_members(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_activity ON chat_conversations(last_message_at DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time ON chat_messages(conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(conversation_id, sender_id, created_at);
