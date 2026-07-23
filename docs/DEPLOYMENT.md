# Deployment Architecture

Date: 2026-07-23

## Deployment Audit

- Monorepo: root npm workspaces for `frontend` and `backend`, shared TypeScript under `shared`.
- Frontend: Vite/React PWA, production output `frontend/dist`.
- Backend: Node HTTP server, built by `npm --workspace backend run build`, started by `npm --workspace backend run start`.
- API proxy: Vercel functions under `api/` forward selected requests to the persistent backend.
- Database state: PostgreSQL target schema exists in `database/postgres/001_unified_schema.sql`, but runtime SQL integration is not complete. Current backend persistence is Upstash Redis workspace snapshot, with local file fallback for non-production long-running processes.
- Background jobs: reminder and monitoring HTTP scheduler endpoints exist. A separate SQL-backed worker/queue does not exist yet.
- Real-time: no WebSocket/managed real-time provider is currently implemented.
- File storage: Vercel Blob client upload endpoint exists; production upload now requires `BLOB_UPLOAD_SECRET`.
- PWA: manifest and service worker are present; API responses are not cached by the service worker.

## Selected Production Pattern

Use a split deployment until the SQL and real-time layers are implemented:

```text
User Browser / Installed PWA
        -> HTTPS
Vercel Frontend + API Proxy
        -> HTTPS
Render Backend API
        -> Upstash Redis snapshot today
        -> PostgreSQL after SQL repository cutover

Provider Scheduler
        -> authenticated Vercel scheduler endpoints
        -> Render Backend RPC today
        -> SQL-backed queue/worker after cutover

Vercel Blob
        -> persistent file storage
```

This reuses existing infrastructure and keeps the backend on a persistent host. It does not yet satisfy production-grade SQL, worker, or real-time requirements; those are documented blockers.

## Rejected Alternatives

- All-in Vercel serverless: rejected for persistent workers and future WebSocket requirements.
- SQLite production database: rejected for multi-user production and ephemeral filesystem risk.
- New paid infrastructure: not created because no explicit approval/credentials were provided.

## Required Services

### Frontend

- Host: Vercel or equivalent static hosting.
- Build command: `npm --workspace frontend run build`
- Output directory: `frontend/dist`
- Required frontend public env:
  - `VITE_APP_NAME`
  - `VITE_APP_ENV`
  - `VITE_FRONTEND_URL`
  - `VITE_API_URL` when not using same-origin Vercel rewrites

### Backend

- Host: Render web service or equivalent persistent Node service.
- Runtime: Node 24.
- Build: `npm install && npm --workspace backend run build`
- Start: `npm --workspace backend run start`
- Health:
  - `GET /health/live`
  - `GET /health/ready`
- Required backend env:
  - `NODE_ENV=production`
  - `PORT` supplied by host
  - `FRONTEND_URL`
  - `ALLOWED_ORIGINS`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

### Scheduler

- Current endpoints:
  - `POST /api/reminders-process`
  - `POST /api/monitoring-collect`
- Required secret:
  - `CRON_SECRET`
- Production behavior: endpoints fail closed if `CRON_SECRET` is missing.

### File Storage

- Provider: Vercel Blob.
- Required secret while direct upload endpoint is used:
  - `BLOB_UPLOAD_SECRET`
- Limitation: production upload client must be updated to use server-authenticated upload sessions before enabling broad user uploads.

### SQL Database

Target provider: managed PostgreSQL such as Neon, Supabase Postgres, Render Postgres, Railway Postgres, or Fly Postgres.

Required future env:

- `DATABASE_URL`
- `DATABASE_SSL=true`
- `DATABASE_POOL_MAX`
- `DATABASE_MIGRATION_URL` or a separate privileged migration credential

Current blocker: runtime repositories do not use PostgreSQL yet.

### Real-Time

Current blocker: no real-time gateway exists. Recommended future options:

- Persistent backend WebSocket service on Render/Railway/Fly with Redis pub/sub adapter.
- Managed provider with signed channel authorization.

Do not deploy real-time chat claims until a provider/gateway exists and membership checks are enforced.

## Environment Separation

Use separate resources for:

- Local
- Test
- Staging
- Production

Never share databases, cron secrets, push credentials, blob buckets, or monitoring connector credentials across staging and production.

## Health And Readiness

- `/health/live` returns process liveness and no expensive dependency checks.
- `/health/ready` checks whether persistent storage is configured in production.
- Readiness intentionally fails in production if Upstash Redis is missing, because local file fallback is not production-safe.

## Migration Strategy

Current status:

- PostgreSQL schema is additive and not applied automatically.
- No production migration runner exists.

Safe future rollout:

1. Create managed PostgreSQL staging database.
2. Add migration runner and schema version table.
3. Run `database/postgres/001_unified_schema.sql` in staging.
4. Implement SQL repository behind existing service contracts.
5. Migrate snapshot data with id mapping and verification.
6. Back up production data.
7. Apply migrations.
8. Deploy backward-compatible backend.
9. Verify readiness and smoke tests.
10. Switch frontend to API-only production mode.

## Rollback

- Frontend: roll back Vercel deployment to previous immutable build.
- Backend: roll back Render service to previous commit/deploy.
- Config: restore previous environment variable set from protected provider history.
- Database: do not run destructive reverse migrations automatically. Prefer forward fixes after backup/verification.

## Production Smoke Checklist

Run only after credentials/services exist:

1. Frontend loads over HTTPS.
2. Direct route refresh works, including `/monitoring/sources/:sourceId` in hash routing.
3. `GET /health/live` returns 200.
4. `GET /health/ready` returns 200.
5. Backend CORS accepts only configured frontend origins.
6. Login works through the production auth strategy.
7. Calendar, tasks, reports, and monitoring load via backend API.
8. Scheduler endpoints reject missing/wrong cron secret.
9. Scheduler endpoints accept correct cron secret.
10. PWA manifest and service worker load over HTTPS.
11. Blob upload is denied without upload authorization.
12. No secrets are visible in frontend bundle or logs.

## Current Deployment Blockers

- No production PostgreSQL runtime integration.
- No server-side authentication.
- No real-time provider.
- No separate worker process.
- No SQL-backed job queue.
- No production database credentials or deployment access provided in this workspace.
- No connected CI/CD provider credentials.

## Local Verification Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test:run`: passed, 8 files / 26 tests.
- `npm run build`: passed.
- Built backend smoke test:
  - `GET /health/live`: passed.
  - `GET /health/ready` with `NODE_ENV=development`: passed, reports `local-file` persistence.

## Cost And Quota Notes

- Render free web services may sleep; this can delay reminders and scheduled jobs. Use a paid always-on instance for reliable background timing.
- Upstash Redis snapshot storage is a temporary persistence layer, not the final SQL database.
- Vercel serverless functions are suitable as lightweight proxies/scheduler endpoints, not long-running workers.
- Managed PostgreSQL connection limits require pooling, especially if serverless APIs are used.
