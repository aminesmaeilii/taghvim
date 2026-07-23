-- Run against an isolated performance database with EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT).
-- Never run load/profiling against production without explicit authorization.

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, publication_date, publication_time, status_id
FROM content_items
WHERE workspace_id = :'workspace_id'
  AND archived_at IS NULL
  AND publication_date BETWEEN :'from_date' AND :'to_date'
ORDER BY publication_date, publication_time NULLS LAST
LIMIT 500;

EXPLAIN (ANALYZE, BUFFERS)
SELECT m.id, m.body, m.created_at
FROM messages m
JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
WHERE cm.user_id = :'user_id'
  AND m.conversation_id = :'conversation_id'
  AND m.deleted_at IS NULL
ORDER BY m.created_at DESC, m.id DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, scheduled_for_utc
FROM reminders
WHERE status IN ('SCHEDULED','SNOOZED','FAILED')
  AND scheduled_for_utc <= now()
ORDER BY scheduled_for_utc
LIMIT 100;
