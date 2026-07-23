# Quality Audit

Date: 2026-07-23

## Project Audit

- Frontend: Vite, React 19, React Router, TanStack Query, Zustand, Tailwind-style CSS, PWA manifest and service worker.
- Backend: Node HTTP server plus Vercel/Render-compatible RPC route at `/api/workspace`.
- Persistent storage today: Upstash Redis workspace snapshot in production backend when configured; local `.data/workspace-snapshot.json` fallback for long-running backend; browser IndexedDB fallback for web/offline workspace data; browser IndexedDB for authentication; Tauri SQLite migrations for desktop.
- SQL state: SQLite migrations exist for Tauri. A non-destructive PostgreSQL target schema was added in `backend/database/postgres/001_unified_schema.sql`, but runtime repositories are not yet fully cut over to PostgreSQL.
- Auth: local browser IndexedDB with PBKDF2 password hashes and session token hashes in sessionStorage. This is documented as local/internal rather than production-grade server auth.
- Authorization: frontend permission checks plus repository-level checks for selected sensitive operations. There is no complete backend-authenticated API boundary yet.
- Background jobs: reminder processing endpoint and monitoring collection endpoint exist. Jobs are persisted in workspace state, not yet SQL-backed.
- Real-time: chat is persisted through repository state; no WebSocket/Supabase/Socket.IO provider is present.
- PWA: manifest exists, service worker caches shell assets and explicitly avoids caching `/api/` requests.
- File storage: Vercel Blob upload endpoint exists.
- Testing: Vitest unit/service tests. No Playwright/Cypress E2E, API integration test harness, or SQL test database harness currently exists.

## Test Matrix Executed

| Area | Evidence | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Passed |
| Lint | `npm run lint` | Passed |
| Unit/service tests | `npm run test:run` | Passed, 7 files / 21 tests |
| Production build | `npm run build` | Passed |
| Backend build | included in `npm run build` | Passed |
| Backend startup smoke | built server on `PORT=3099`, `GET /health` | Passed: `{"ok":true}` |

## Bugs Found And Fixed

### QA-001: Render backend Node version mismatch

- Severity: High
- Module: Production deployment
- Reproduction: inspect `package.json` and `render.yaml`; root engine requires Node `24.x`, Render config requested Node `20`.
- Expected: production backend builds with the same major Node version declared by the application.
- Actual: Render could install/build with an unsupported major version.
- Root cause: deployment config drift.
- Fix: changed `render.yaml` `NODE_VERSION` from `20` to `24`.
- Regression: covered by production build locally; recommend adding CI config validation later.

## Verified Non-Issues

- Service worker does not cache API responses, reducing risk of stale private chat/auth data in offline caches.
- The existing unit suite includes Jalali date conversion tests, chat repository tests, reminder tests, report metric tests, and monitoring service tests.

## Blocked Or Not Present

- Dedicated SQL test database: not present. PostgreSQL schema exists as an additive target, but no runtime PostgreSQL repository or migration runner is wired.
- E2E/browser automation: no Playwright/Cypress dependency or tests are configured.
- Real-time reconnection testing: blocked because no real-time provider exists in the repo.
- Web Push delivery integration tests: blocked because no mock push provider test harness exists.
- API authorization tests: partially blocked by the current browser-local auth model; backend RPC does not authenticate sessions server-side.
- Production-like SQL migration check: blocked without a disposable PostgreSQL test database URL and migration runner.
- Cross-browser testing: not executed in this terminal-only environment.

## Recommended Next Step

Prioritize replacing browser-local auth and Redis/file workspace snapshots with the unified SQL backend access layer, then add API integration tests and a Playwright smoke suite for login, calendar, tasks, chat, reports, monitoring, and PWA shell behavior.
