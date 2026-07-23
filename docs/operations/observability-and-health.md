# Observability And Health

Audience: operators and technical administrators  
Last verified version: `0.1.1` / commit `8842877`

## Structured Logs

`shared/services/observability.ts` defines structured log entries with timestamp, level, environment, service, version, commit, event, request/correlation IDs, route, method, status, duration, job IDs, connector/source IDs, error code, retry count, and metadata.

Sensitive keys matching password/token/secret/cookie/authorization/private/credential/VAPID/database URL patterns are redacted.

## Health Endpoints

- `/health` and `/health/live`: backend process is alive.
- `/health/ready`: production readiness requires Upstash Redis configuration; non-production allows local fallback.
- `/health/version`: version, commit SHA, build timestamp, environment.

## Technical Dashboard

`/technical-health` is gated by `technical_health.read`. It reports frontend, backend, database, realtime, worker, scheduler, Web Push, file storage, social Monitoring, notifications, and backup status. Missing integrations are not shown as healthy.

## Backup Status

Runtime backup health uses:

- `BACKUP_LAST_SUCCESS_AT`
- `BACKUP_LAST_RESTORE_TEST_AT`
- `BACKUP_RPO_HOURS`
- `BACKUP_RESTORE_DRILL_DAYS`

## Tracing A User Error

1. Capture visible request/tracking code if shown.
2. Search logs by `x-request-id` / correlation ID.
3. Follow route/method and status.
4. Inspect backend logs and repository method.
5. For jobs, inspect job ID/batch/source ID.
6. Do not expose stack traces or secrets to end users.
