PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  related_entity_type TEXT NOT NULL,
  related_entity_id TEXT,
  task_id TEXT,
  event_id TEXT,
  campaign_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  scheduled_for_utc TEXT NOT NULL,
  original_timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_by TEXT NOT NULL,
  deduplication_key TEXT NOT NULL UNIQUE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_json TEXT NOT NULL,
  device_name TEXT NOT NULL,
  browser_info TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  action_url TEXT,
  priority TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, scheduled_for_utc);
CREATE INDEX IF NOT EXISTS idx_reminders_user_entity ON reminders(user_id, related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id, revoked_at);
