# Technical Observability

Date: 2026-07-23

This document covers technical health monitoring for the application itself. It is separate from the social media `مانیتورینگ` module.

## Selected Stack

The project now uses a lightweight built-in observability layer:

- Structured JSON logs in the backend.
- Central redaction helpers in shared code.
- Request/correlation IDs for API requests.
- Liveness, readiness, and version endpoints.
- In-app technical dashboard: `سلامت سامانه`.
- Repository-derived health metrics for currently available runtime data.

No paid external provider was configured because no credentials or approval were available. The built-in layer is intentionally provider-neutral and can later feed Sentry, OpenTelemetry, Prometheus, Grafana, or hosting-provider log drains.

## Structured Log Schema

Core fields:

- `timestamp`
- `level`
- `environment`
- `service`
- `applicationVersion`
- `commitSha`
- `event`
- `requestId`
- `correlationId`
- `route`
- `method`
- `statusCode`
- `durationMs`
- `jobId`
- `batchId`
- `connectorKey`
- `sourceId`
- `errorCode`
- `retryCount`
- `metadata`

Sensitive fields are centrally redacted by key pattern. Redacted examples include password, token, cookie, authorization, secret, database URL, VAPID/private keys, and push auth keys.

## Request And Correlation Flow

- Frontend API calls generate `x-request-id`.
- Vercel proxy forwards `X-Request-Id`.
- Backend validates or creates a safe request ID.
- Backend returns `x-request-id` in the response.
- Unexpected API errors include a safe request ID in the JSON response.
- Backend request completion/failure is logged as structured JSON.

## Health Endpoints

- `GET /health/live`: process liveness only.
- `GET /health/ready`: readiness with production persistent-storage check.
- `GET /health/version`: safe version metadata.

Readiness does not expose secrets or connection strings.

## Technical Dashboard

Route:

- `/#/technical-health`

Title:

- `سلامت سامانه`

Permission:

- `technical_health.read`

The dashboard displays:

- Overall status
- Environment/version/commit
- Frontend/PWA
- Backend
- Database
- Realtime
- Worker
- Scheduler
- Web Push
- File storage
- Social Monitoring engine
- Notifications
- Active alerts
- Recent safe technical errors

Unavailable integrations are shown as `نامشخص` and not as healthy.

## Current Metrics

Implemented from current repository/runtime state:

- `jobs_failed_total`
- `reminders_due`
- `push_subscriptions_active`
- `monitoring_sources_stale`
- `monitoring_jobs_failed_total`
- `notifications_unread`

Missing because the runtime does not yet exist:

- PostgreSQL pool/query metrics
- Real-time connection metrics
- Dedicated worker queue metrics
- Web Push provider delivery metrics
- File-storage provider latency

## Alerts

Implemented lightweight in-app alert records for:

- Stale social monitoring source
- Failed monitoring/background job

Alerts include stable deduplication keys. External alert delivery is not configured.

## Retention Policy

Current built-in structured logs are emitted to the hosting provider logs. Retention is therefore controlled by the host. Recommended defaults once a log store exists:

- Debug logs: 7 days
- General operational logs: 30 days
- Error logs: 90 days
- Technical alert records: 180 days
- Audit logs: 1 year or organization policy
- Aggregated metrics: 13 months

Never retain raw request bodies, private chat content, tokens, or secrets in operational logs.

## Known Limitations

- No external error tracker is configured.
- No OpenTelemetry exporter is configured.
- No SQL database runtime metrics exist because PostgreSQL is not wired into production runtime yet.
- No real-time gateway exists to instrument.
- No separate worker process exists to instrument.
- Technical dashboard reads through the current repository facade and is not yet backed by SQL observability tables.

## Verification Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test:run`: passed, 9 files / 30 tests.
- `npm run build`: passed.
- Built backend smoke:
  - `GET /health/live`: passed.
  - `GET /health/ready`: passed in development mode.
  - `GET /health/version`: passed and returned safe version fields.

## Recommended Next Step

After SQL/server-auth integration, add:

1. Server-authenticated `/api/technical-health` endpoint.
2. SQL tables for operational incidents and alert states.
3. OpenTelemetry spans for API, database, worker, and connector operations.
4. Prometheus-compatible metrics endpoint protected for administrators or infrastructure.
5. External error tracking with private source-map upload.
