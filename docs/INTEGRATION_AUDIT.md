# Integration Audit

Date: 2026-07-23

## Active Blocker

The requested full integration cannot be completed safely yet because the unified SQL migration is not runtime-complete.

What exists:

- Additive PostgreSQL target schema: `database/postgres/001_unified_schema.sql`
- Tauri SQLite migrations: `src-tauri/migrations/*.sql`
- Shared domain/repository interfaces

What is missing:

- PostgreSQL database client and connection pooling
- Migration runner and migration metadata table
- Runtime SQL repository implementation
- Server-side authentication/session store
- Backend authorization middleware tied to authenticated sessions
- API endpoints/contracts beyond the current generic workspace RPC
- Test database configuration and migration checks
- SQL-backed background job claiming/worker process

Because of that, connecting every frontend module to SQL now would require inventing a large new runtime layer in one pass and would risk damaging existing behavior and data. The safe next phase is to add the SQL access layer and migrate one repository boundary at a time behind the existing `ContentRepository` contract.

## Architecture Audit

- Frontend framework: React 19, Vite, React Router hash routes.
- State/data fetching: TanStack Query for server/cache data, Zustand for UI preferences/toasts.
- Forms/validation: React Hook Form and Zod are available; validation is mixed between UI and shared services.
- Backend framework: lightweight Node HTTP server plus Vercel function proxy.
- Current backend API: generic RPC at `/api/workspace` invoking `MemoryRepository` methods.
- Current production persistence: Upstash Redis snapshot when configured; local JSON fallback on long-running backend.
- Current browser persistence: IndexedDB `rooznegar-offline` for workspace data when no remote API is configured.
- Current auth: browser IndexedDB `zambil-auth-v2` and sessionStorage token handle.
- Real-time provider: none present.
- Background jobs: HTTP-triggered reminder and monitoring endpoints; no SQL queue/worker.
- File storage: Vercel Blob upload endpoint.
- PWA: manifest plus service worker shell cache; API responses are not cached.

## Frontend Data Sources

- `frontend/src/services/content-repository.ts`: production data facade. Uses remote API when configured; otherwise browser IndexedDB or in-memory repository.
- `frontend/src/services/auth-service.ts`: browser IndexedDB users/sessions/audit logs. Production-grade backend auth is not integrated.
- `frontend/src/stores/ui-store.ts`: valid localStorage usage for sidebar/theme UI preferences.
- `frontend/src/services/notification-service.ts`: localStorage notification de-duplication log; acceptable as client delivery bookkeeping, not source of truth.
- `sessionStorage`: report filters and chat pinned state; valid temporary UI state.
- `shared/constants/defaults.ts`: default reference data and initial monitoring sources; acceptable as idempotent seed defaults but not fake metrics.

## Backend Coverage

Current backend RPC covers many repository methods for:

- Content/calendar
- Campaigns, ideas, templates, references
- Profiles
- Tasks
- Chat conversations/messages
- Reminders
- Push subscriptions
- Notifications
- Reports
- Monitoring sources/platforms/jobs
- Settings/import/export/backup

Missing or incomplete for production:

- Authenticated HTTP endpoint protection
- Server-side role/session verification
- Teams and invitations as first-class backend APIs
- SQL-backed repositories and transactions
- Real-time gateway
- Cursor-paginated dedicated endpoints
- Structured API contract with consistent `{ success, data, error, meta }`

## Safe Changes Applied

- `api/workspace.js` now requires `BACKEND_URL` instead of silently defaulting to the live Render URL.
- `frontend/src/services/api-config.ts` now treats production without explicit API configuration as remote/API mode instead of silently using IndexedDB for business data.
- `.env.example` documents the required `BACKEND_URL` and production API behavior.
- `render.yaml` now matches the repo Node engine (`24.x`).

## Contract Direction

Keep the existing repository facade short-term, but replace its implementation behind the boundary:

```text
Frontend feature
  -> contentRepository/authRepository typed client
  -> authenticated HTTP API
  -> backend service
  -> PostgreSQL repository
  -> database transaction
```

Target API response shape for new endpoints:

```ts
type ApiSuccess<T> = { success: true; data: T; meta?: { nextCursor?: string | null; page?: number; pageSize?: number; total?: number } };
type ApiError = { success: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string } };
```

Do not expose SQL errors, stack traces, password hashes, session token hashes, push secrets, or connector secrets.

## Required Next Implementation Sequence

1. Add `pg` or a selected query layer plus server-only database client.
2. Add migration runner for `database/postgres`.
3. Add test database guard that refuses destructive cleanup unless `NODE_ENV=test` and database name/URL is marked test.
4. Implement server-side auth sessions and migrate browser auth data through an explicit user-approved flow.
5. Replace generic unauthenticated workspace RPC with authenticated module endpoints.
6. Implement SQL-backed repository methods for content/calendar/tasks/campaigns first.
7. Add chat/message SQL persistence with idempotency and membership checks.
8. Add reminders/notifications/background jobs with atomic SQL job claiming.
9. Add reports/monitoring SQL reads and snapshot writes.
10. Disable IndexedDB business-data fallback in production after migration verification.

## Current Verification

See `docs/QUALITY_AUDIT.md` for executed commands and results.
