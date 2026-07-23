# Security And Access-Control Audit

Date: 2026-07-23

## Threat Model

Protected assets:

- User identities, password hashes, sessions, permissions, profiles, workspace data, content calendar, tasks, campaigns, chat messages, reminders, notifications, push endpoints, reports, exports, monitoring sources, monitoring history, and uploaded files.

User types:

- Super admin, admin, manager, regular user, viewer, disabled/suspended/deleted users, unauthenticated visitors, scheduled job callers, and future background workers.

Trust boundaries:

- Browser/PWA to API, Vercel proxy to backend, backend to Redis/file snapshot storage, future backend to PostgreSQL, service worker to browser notification APIs, scheduled functions to backend RPC, and monitoring connectors to external public platforms.

High-risk abuse scenarios:

- Calling public scheduler endpoints without authorization.
- Uploading files through an unauthenticated blob endpoint.
- Calling generic workspace RPC methods directly.
- Manipulating `viewer` arguments in client-supplied RPC calls.
- Using browser-local auth as if it were server-trusted auth.
- Cross-user or cross-workspace data access once multi-tenancy is added.
- Malicious monitoring URLs attempting SSRF.
- Stale or over-broad production config silently falling back to local persistence.

Existing mitigations:

- Passwords are PBKDF2 hashed in browser-local auth.
- Sensitive safe-user objects omit password hash and salt.
- Service worker does not cache `/api/` responses.
- Monitoring URL validation rejects non-HTTPS and unregistered domains.
- Repository methods enforce permissions for reports and monitoring admin actions when a viewer is supplied.
- Cron endpoints can be protected by `CRON_SECRET`.

Remaining critical risk:

- The current production API is not backed by a server-authenticated session model. Full backend authorization cannot be guaranteed until the SQL/runtime auth layer is implemented.

## Fixes Applied

### SEC-001: Permission catalog drift

- Severity: High
- Root cause: permissions and role mappings lived in frontend auth code while shared/backend-adjacent services performed their own raw permission checks.
- Fix: added `shared/services/authorization.ts` with `ALL_PERMISSIONS`, `ROLES`, `DATA_SCOPES`, `effectivePermissions`, `hasPermission`, and `requirePermission`.
- Regression tests: `shared/services/authorization.test.ts`.

### SEC-002: Scheduled endpoints executable when `CRON_SECRET` is missing

- Severity: High
- Root cause: `api/reminders-process.js` and `api/monitoring-collect.js` allowed execution if `CRON_SECRET` was unset.
- Fix: in production, both endpoints now fail closed with a configuration error when `CRON_SECRET` is missing.
- Regression approach: static code review plus production build; add API-function tests when an API test harness exists.

### SEC-003: Unauthenticated blob upload endpoint

- Severity: High
- Root cause: `api/blob-upload.js` generated Vercel Blob client upload tokens for any POST request.
- Fix: in production, uploads require `BLOB_UPLOAD_SECRET`; otherwise the endpoint fails closed. This preserves development behavior while preventing accidental unauthenticated production uploads.
- Limitation: current frontend upload client does not yet send an authenticated server session token. Production uploads remain intentionally blocked until server-authenticated upload flow is implemented.

### SEC-004: Monitoring manual refresh authorization regression

- Severity: Medium
- Root cause: monitoring refresh depends on repository permission checks when a viewer is supplied.
- Fix: repository checks now use shared `requirePermission`.
- Regression test: low-privilege viewer cannot trigger manual monitoring collection.

## Central Permission Model

The shared catalog in `shared/services/authorization.ts` is now the source of truth for:

- Permission list
- Role-to-permission mapping
- Data scopes
- Effective permission derivation
- Permission checks used by shared services

Frontend checks remain UX-only. Backend/server authorization still needs a trusted authenticated principal once the SQL auth layer exists.

## Security Blockers

- No server-side authentication middleware.
- No trusted session cookie/header validation on `/api/workspace`.
- Generic RPC accepts method names and client-supplied args.
- No SQL-backed user/session/permission repository yet.
- No WebSocket/realtime gateway exists to secure.
- No API integration test harness exists for Vercel functions.
- No dependency audit command is configured in package scripts.

## Required Next Security Work

1. Add server-side sessions and authenticated principal extraction.
2. Stop trusting client-supplied `viewer` arguments.
3. Replace generic workspace RPC with explicit authenticated endpoints.
4. Enforce permission and data-scope checks in backend services.
5. Add API security tests for auth, permissions, IDOR, exports, monitoring admin actions, upload tokens, and cron endpoints.
6. Implement signed, server-authenticated blob upload flow.
7. Wire PostgreSQL users/roles/sessions/audit logs as the authority.
