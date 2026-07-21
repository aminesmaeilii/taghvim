PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  publication_time TEXT,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  platform_id TEXT,
  type_id TEXT,
  campaign_id TEXT,
  pillar_id TEXT,
  archived_at TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platforms (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, data_json TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS content_types (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, data_json TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS content_statuses (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, color TEXT NOT NULL, data_json TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS content_pillars (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, data_json TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, data_json TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS content_tags (content_id TEXT NOT NULL, tag_id TEXT NOT NULL, PRIMARY KEY (content_id, tag_id), FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS checklist_items (id TEXT PRIMARY KEY, content_id TEXT NOT NULL, title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, content_id TEXT NOT NULL, name TEXT NOT NULL, path TEXT NOT NULL, mime_type TEXT, size INTEGER, FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS performance_metrics (content_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS content_history (id TEXT PRIMARY KEY, content_id TEXT NOT NULL, action TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS application_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS backup_history (id TEXT PRIMARY KEY, path TEXT, created_at TEXT NOT NULL, record_count INTEGER NOT NULL DEFAULT 0);

CREATE INDEX IF NOT EXISTS idx_contents_publication_date ON contents(publication_date);
CREATE INDEX IF NOT EXISTS idx_contents_status ON contents(status);
CREATE INDEX IF NOT EXISTS idx_contents_platform ON contents(platform_id);
CREATE INDEX IF NOT EXISTS idx_contents_campaign ON contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contents_title ON contents(title);
CREATE INDEX IF NOT EXISTS idx_contents_archived ON contents(archived_at);
