-- Taghvim unified PostgreSQL schema.
-- Non-destructive initial target schema. Apply to a fresh PostgreSQL database or a reviewed staging database.
-- Timestamps are UTC timestamptz. Jalali dates belong in presentation/input only.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE account_status AS ENUM ('PENDING','ACTIVE','INACTIVE','LOCKED','SUSPENDED','DELETED');
CREATE TYPE data_scope AS ENUM ('ALL','ORGANIZATION','DEPARTMENT','TEAM','ASSIGNED','OWN','NONE');
CREATE TYPE conversation_type AS ENUM ('DIRECT','GROUP');
CREATE TYPE conversation_role AS ENUM ('OWNER','ADMIN','MEMBER');
CREATE TYPE task_status AS ENUM ('todo','in_progress','done');
CREATE TYPE priority_level AS ENUM ('low','normal','high','urgent');
CREATE TYPE reminder_status AS ENUM ('SCHEDULED','SENT','PARTIALLY_SENT','FAILED','CANCELLED','SNOOZED');
CREATE TYPE delivery_status AS ENUM ('PENDING','SENT','FAILED','SKIPPED','RETRYING');
CREATE TYPE job_status AS ENUM ('QUEUED','CLAIMED','RUNNING','SUCCESS','PARTIAL','FAILED','RATE_LIMITED','CANCELLED');
CREATE TYPE monitoring_quality AS ENUM ('COMPLETE','PARTIAL','INCOMPLETE','STALE','INVALID');
CREATE TYPE monitoring_support_level AS ENUM ('AVAILABLE','UNAVAILABLE','RESTRICTED','TEMPORARILY_FAILED','STALE','ESTIMATED');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  timezone text NOT NULL DEFAULT 'Asia/Tehran',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, slug)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext UNIQUE,
  email citext UNIQUE,
  password_hash text,
  password_algorithm text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  avatar_url text,
  job_title text,
  department text,
  status account_status NOT NULL DEFAULT 'PENDING',
  data_scope data_scope NOT NULL DEFAULT 'OWN',
  must_change_password boolean NOT NULL DEFAULT false,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  password_updated_at timestamptz,
  last_login_at timestamptz,
  last_activity_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (email IS NOT NULL OR username IS NOT NULL)
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE TABLE permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status account_status NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE member_roles (
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, role_id),
  FOREIGN KEY (workspace_id, user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, name)
);

CREATE TABLE team_members (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'MEMBER',
  joined_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','REVOKED')),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  icon text NOT NULL,
  character_limit integer CHECK (character_limit IS NULL OR character_limit > 0),
  preferred_type_ids uuid[] NOT NULL DEFAULT '{}',
  default_publishing_time time,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, name)
);

CREATE TABLE content_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  icon text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, name)
);

CREATE TABLE content_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  wip_limit integer CHECK (wip_limit IS NULL OR wip_limit >= 0),
  terminal boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, key)
);

CREATE TABLE content_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, name)
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  status text NOT NULL CHECK (status IN ('draft','active','paused','completed','archived')),
  goal text,
  start_date date,
  end_date date,
  budget numeric(14,2) CHECK (budget IS NULL OR budget >= 0),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  body text,
  publication_date date NOT NULL,
  publication_time time,
  status_id uuid NOT NULL REFERENCES content_statuses(id) ON DELETE RESTRICT,
  priority priority_level NOT NULL DEFAULT 'normal',
  platform_id uuid REFERENCES content_platforms(id) ON DELETE SET NULL,
  type_id uuid REFERENCES content_types(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  pillar_id uuid REFERENCES content_pillars(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deadline_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, name)
);

CREATE TABLE content_item_tags (
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_item_id, tag_id)
);

CREATE TABLE content_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  from_status_id uuid REFERENCES content_statuses(id) ON DELETE SET NULL,
  to_status_id uuid NOT NULL REFERENCES content_statuses(id) ON DELETE RESTRICT,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  notes text,
  status task_status NOT NULL DEFAULT 'todo',
  priority priority_level NOT NULL DEFAULT 'normal',
  due_at timestamptz,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  content_item_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE task_assignments (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE task_dependencies (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status task_status,
  to_status task_status NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type conversation_type NOT NULL,
  title text,
  avatar_url text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  direct_key text,
  last_message_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, direct_key)
);

CREATE TABLE conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role conversation_role NOT NULL DEFAULT 'MEMBER',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  muted_at timestamptz,
  archived_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message_type text NOT NULL DEFAULT 'TEXT',
  body text NOT NULL,
  context_type text CHECK (context_type IS NULL OR context_type IN ('content','task','campaign','calendar','monitoring_source')),
  context_id uuid,
  context_metadata jsonb,
  client_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  UNIQUE (conversation_id, sender_id, client_message_id)
);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  related_entity_type text NOT NULL CHECK (related_entity_type IN ('task','content','campaign','calendar','monitoring_source','custom')),
  related_entity_id uuid,
  title text NOT NULL,
  body text,
  scheduled_for_utc timestamptz NOT NULL,
  original_timezone text NOT NULL DEFAULT 'Asia/Tehran',
  status reminder_status NOT NULL DEFAULT 'SCHEDULED',
  priority priority_level NOT NULL DEFAULT 'normal',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deduplication_key text NOT NULL,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  sent_at timestamptz,
  UNIQUE (workspace_id, deduplication_key)
);

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  device_name text NOT NULL,
  browser_info text,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  related_entity_type text,
  related_entity_id uuid,
  action_url text,
  priority priority_level NOT NULL DEFAULT 'normal',
  deduplication_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (workspace_id, user_id, deduplication_key)
);

CREATE TABLE background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  deduplication_key text NOT NULL,
  status job_status NOT NULL DEFAULT 'QUEUED',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  claimed_by text,
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries integer NOT NULL DEFAULT 5 CHECK (max_retries >= 0),
  next_retry_at timestamptz,
  safe_error_message text,
  technical_error jsonb,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, job_type, deduplication_key)
);

CREATE TABLE metric_definitions (
  key text PRIMARY KEY,
  label text NOT NULL,
  formula text NOT NULL,
  source_table text NOT NULL,
  unit text NOT NULL,
  required_permission text NOT NULL REFERENCES permissions(key) ON DELETE RESTRICT,
  observed_status text NOT NULL CHECK (observed_status IN ('observed','estimated','derived')),
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE daily_metric_snapshots (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  metric_key text NOT NULL REFERENCES metric_definitions(key) ON DELETE RESTRICT,
  numeric_value numeric,
  text_value text,
  quality monitoring_quality NOT NULL DEFAULT 'COMPLETE',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, date, metric_key)
);

CREATE TABLE monitoring_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  display_name_fa text NOT NULL,
  display_name_en text NOT NULL,
  icon text NOT NULL,
  accent_color text NOT NULL,
  connector_key text NOT NULL,
  connector_version text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  supported_source_types text[] NOT NULL,
  default_collection_interval_minutes integer NOT NULL CHECK (default_collection_interval_minutes > 0),
  minimum_collection_interval_minutes integer NOT NULL CHECK (minimum_collection_interval_minutes > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','DISABLED','BETA')),
  health_status text NOT NULL CHECK (health_status IN ('HEALTHY','LIMITED','NEEDS_REVIEW','DOWN','DISABLED')),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE monitoring_platform_domains (
  platform_id uuid NOT NULL REFERENCES monitoring_platforms(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform_id, hostname)
);

CREATE TABLE monitoring_capabilities (
  key text PRIMARY KEY,
  metric_type text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('number','text','date','boolean')),
  unit text,
  aggregation_method text NOT NULL CHECK (aggregation_method IN ('latest','sum','avg','min','max','count')),
  display_format text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE monitoring_platform_capabilities (
  platform_id uuid NOT NULL REFERENCES monitoring_platforms(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES monitoring_capabilities(key) ON DELETE CASCADE,
  supported boolean NOT NULL,
  support_level monitoring_support_level NOT NULL,
  limitation_reason text,
  last_verified_at timestamptz,
  PRIMARY KEY (platform_id, capability_key)
);

CREATE TABLE monitoring_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES monitoring_platforms(id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  source_type text NOT NULL,
  source_url text NOT NULL,
  normalized_url text NOT NULL,
  handle text,
  external_id text,
  avatar_url text,
  enabled boolean NOT NULL DEFAULT true,
  collection_enabled boolean NOT NULL DEFAULT true,
  collection_interval_minutes integer NOT NULL CHECK (collection_interval_minutes > 0),
  daily_collection_time time NOT NULL DEFAULT '06:00',
  freshness_threshold_hours integer NOT NULL DEFAULT 30 CHECK (freshness_threshold_hours > 0),
  timezone text NOT NULL DEFAULT 'Asia/Tehran',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  identity_changed_at timestamptz,
  identity_change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (workspace_id, platform_id, normalized_url)
);

CREATE TABLE monitoring_source_capabilities (
  source_id uuid NOT NULL REFERENCES monitoring_sources(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES monitoring_capabilities(key) ON DELETE CASCADE,
  supported boolean NOT NULL,
  support_level monitoring_support_level NOT NULL,
  limitation_reason text,
  last_detected_at timestamptz,
  PRIMARY KEY (source_id, capability_key)
);

CREATE TABLE monitoring_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES monitoring_platforms(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES monitoring_sources(id) ON DELETE CASCADE,
  batch_id text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('DAILY','SCHEDULED','LOGIN_RECOVERY','MANUAL','RETRY')),
  deduplication_key text NOT NULL,
  status job_status NOT NULL DEFAULT 'QUEUED',
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  records_collected integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  error_code text,
  safe_error_message text,
  technical_error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, deduplication_key)
);

CREATE TABLE monitoring_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES monitoring_sources(id) ON DELETE RESTRICT,
  collected_at timestamptz NOT NULL,
  snapshot_date date NOT NULL,
  collection_job_id uuid NOT NULL REFERENCES monitoring_jobs(id) ON DELETE RESTRICT,
  data_quality monitoring_quality NOT NULL,
  collection_method text NOT NULL CHECK (collection_method IN ('OFFICIAL_API','PUBLIC_ENDPOINT','PUBLIC_PAGE','CONNECTOR_LIMITATION')),
  normalized_metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, snapshot_date)
);

CREATE TABLE monitoring_metric_values (
  snapshot_id uuid NOT NULL REFERENCES monitoring_snapshots(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES monitoring_capabilities(key) ON DELETE RESTRICT,
  numeric_value numeric,
  text_value text,
  unit text,
  observed boolean NOT NULL,
  estimated boolean NOT NULL DEFAULT false,
  quality_status monitoring_support_level NOT NULL,
  PRIMARY KEY (snapshot_id, capability_key),
  CHECK (numeric_value IS NOT NULL OR text_value IS NOT NULL OR observed = false)
);

CREATE TABLE monitored_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES monitoring_sources(id) ON DELETE RESTRICT,
  platform_content_id text NOT NULL,
  canonical_url text,
  published_at timestamptz,
  text_preview text,
  media_type text,
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, platform_content_id)
);

CREATE TABLE monitored_content_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_content_id uuid NOT NULL REFERENCES monitored_contents(id) ON DELETE CASCADE,
  collected_at timestamptz NOT NULL,
  normalized_metrics jsonb NOT NULL DEFAULT '{}',
  data_quality monitoring_quality NOT NULL
);

CREATE TABLE monitoring_daily_aggregates (
  source_id uuid NOT NULL REFERENCES monitoring_sources(id) ON DELETE RESTRICT,
  date date NOT NULL,
  metric_key text NOT NULL REFERENCES monitoring_capabilities(key) ON DELETE RESTRICT,
  opening_value numeric,
  closing_value numeric,
  minimum_value numeric,
  maximum_value numeric,
  change_value numeric,
  change_percentage numeric,
  sample_count integer NOT NULL DEFAULT 0,
  data_completeness monitoring_quality NOT NULL,
  PRIMARY KEY (source_id, date, metric_key)
);

CREATE TABLE monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id uuid REFERENCES monitoring_sources(id) ON DELETE SET NULL,
  platform_id uuid REFERENCES monitoring_platforms(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE monitoring_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id uuid REFERENCES monitoring_sources(id) ON DELETE CASCADE,
  platform_id uuid REFERENCES monitoring_platforms(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  threshold jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE application_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','workspace','user')),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string','number','boolean','object','array')),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, workspace_id, user_id, key)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  result text NOT NULL CHECK (result IN ('success','failure','denied')),
  entity_type text,
  entity_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id, workspace_id);
CREATE INDEX idx_team_members_user ON team_members(user_id, team_id);
CREATE INDEX idx_auth_sessions_user_active ON auth_sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_content_items_calendar ON content_items(workspace_id, publication_date, publication_time) WHERE archived_at IS NULL;
CREATE INDEX idx_content_items_status ON content_items(workspace_id, status_id, publication_date) WHERE archived_at IS NULL;
CREATE INDEX idx_content_items_campaign ON content_items(workspace_id, campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_content_items_search ON content_items USING gin(search_vector);
CREATE INDEX idx_campaigns_range ON campaigns(workspace_id, start_date, end_date) WHERE archived_at IS NULL;
CREATE INDEX idx_tasks_assignee_due ON task_assignments(user_id, task_id);
CREATE INDEX idx_tasks_status_due ON tasks(workspace_id, status, due_at) WHERE archived_at IS NULL;
CREATE INDEX idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);
CREATE INDEX idx_conversation_members_user ON conversation_members(user_id, conversation_id);
CREATE INDEX idx_conversations_activity ON conversations(workspace_id, last_message_at DESC NULLS LAST, updated_at DESC);
CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_reminders_due ON reminders(status, scheduled_for_utc) WHERE status IN ('SCHEDULED','SNOOZED','FAILED');
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_background_jobs_claim ON background_jobs(status, scheduled_for, next_retry_at);
CREATE INDEX idx_daily_metric_snapshots_range ON daily_metric_snapshots(workspace_id, metric_key, date);
CREATE INDEX idx_monitoring_sources_due ON monitoring_sources(workspace_id, enabled, collection_enabled, daily_collection_time) WHERE archived_at IS NULL;
CREATE INDEX idx_monitoring_snapshots_latest ON monitoring_snapshots(source_id, snapshot_date DESC, collected_at DESC);
CREATE INDEX idx_monitoring_metric_values_lookup ON monitoring_metric_values(capability_key, quality_status);
CREATE INDEX idx_monitored_content_source_time ON monitored_contents(source_id, published_at DESC NULLS LAST, last_observed_at DESC);
CREATE INDEX idx_monitoring_jobs_claim ON monitoring_jobs(status, scheduled_for, platform_id);
CREATE INDEX idx_monitoring_events_timeline ON monitoring_events(workspace_id, occurred_at DESC);
CREATE INDEX idx_audit_logs_workspace_time ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs(actor_user_id, created_at DESC);

COMMIT;
