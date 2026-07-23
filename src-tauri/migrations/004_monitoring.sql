CREATE TABLE IF NOT EXISTS monitoring_platforms (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  display_name_fa TEXT NOT NULL,
  display_name_en TEXT NOT NULL,
  connector_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitoring_sources (
  id TEXT PRIMARY KEY,
  platform_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  handle TEXT,
  external_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  collection_enabled INTEGER NOT NULL DEFAULT 1,
  collection_interval_minutes INTEGER NOT NULL DEFAULT 1440,
  daily_collection_time TEXT NOT NULL DEFAULT '06:00',
  freshness_threshold_hours INTEGER NOT NULL DEFAULT 30,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitoring_snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  collection_job_id TEXT NOT NULL,
  data_quality TEXT NOT NULL,
  collection_method TEXT NOT NULL,
  normalized_metrics TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(source_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS monitoring_jobs (
  id TEXT PRIMARY KEY,
  platform_key TEXT NOT NULL,
  source_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  records_collected INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  safe_error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitoring_daily_aggregates (
  source_id TEXT NOT NULL,
  date TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  opening_value REAL,
  closing_value REAL,
  change_value REAL,
  change_percentage REAL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  data_completeness TEXT NOT NULL,
  PRIMARY KEY(source_id, date, metric_key)
);

CREATE TABLE IF NOT EXISTS monitoring_events (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  platform_key TEXT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  metadata TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_sources_due ON monitoring_sources(enabled, collection_enabled, archived_at, daily_collection_time);
CREATE INDEX IF NOT EXISTS idx_monitoring_snapshots_source_date ON monitoring_snapshots(source_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_status_time ON monitoring_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_time ON monitoring_events(occurred_at);
