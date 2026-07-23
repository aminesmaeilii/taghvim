\echo Running Taghvim restore verification
SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS workspaces_count FROM workspaces;
SELECT COUNT(*) AS team_membership_count FROM team_members;
SELECT COUNT(*) AS task_count FROM tasks;
SELECT COUNT(*) AS content_count FROM content_items;
SELECT COUNT(*) AS campaign_count FROM campaigns;
SELECT COUNT(*) AS conversation_count FROM conversations;
SELECT COUNT(*) AS message_count FROM messages;
SELECT COUNT(*) AS reminder_count FROM reminders;
SELECT COUNT(*) AS notification_count FROM notifications;
SELECT COUNT(*) AS monitoring_source_count FROM monitoring_sources;
SELECT COUNT(*) AS monitoring_snapshot_count FROM monitoring_snapshots;
SELECT COUNT(*) AS audit_log_count FROM audit_logs;
SELECT conname FROM pg_constraint WHERE contype = 'f' AND NOT convalidated;
