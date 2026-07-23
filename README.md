# Zambil / Taghvim

Zambil is a Persian-first content operations web app and installable PWA for planning a Jalali content calendar, managing tasks, campaigns, workflows, chat, reminders, notifications, reports, social Monitoring, technical health, and backup readiness.

Current verified version: `0.1.1`  
Last verified commit during handover: `8842877`

## Features

- React/Vite frontend with RTL Persian UI and PWA manifest/service worker.
- Node backend API with `/api/workspace` RPC-style workspace operations.
- Browser, backend, and Tauri repository adapters.
- Authentication, user profiles, roles, permissions, sessions, and audit-oriented models.
- Content calendar, tasks, campaigns, workflow, ideas, templates, reports, chat, reminders, notifications, social Monitoring, technical health, and settings.
- PostgreSQL target schema and Tauri SQLite migrations.
- Backup, restore-test, retention, performance, and verification scripts.

## Tech Summary

- Node.js `24.x`, npm workspaces.
- Frontend: React 19, TypeScript, Vite, TanStack Query, Zustand, Tailwind base, Vazirmatn.
- Backend: Node HTTP server, shared TypeScript services, optional Upstash Redis persistence.
- Deployment config: Vercel frontend/functions, Render backend.
- Database assets: PostgreSQL SQL schema under `database/postgres`, Tauri migrations under `src-tauri/migrations`.

## Repository Structure

- `frontend/`: browser/PWA application.
- `backend/`: Node backend server and workspace route.
- `api/`: Vercel serverless proxy/scheduler/upload endpoints.
- `shared/`: domain types, repositories, authorization, reports, monitoring, observability.
- `database/postgres/`: unified PostgreSQL schema and backup catalog migration.
- `src-tauri/`: Tauri desktop shell and SQLite migrations.
- `scripts/backup/`: guarded backup, verify, restore-test, and retention tools.
- `scripts/performance/`: synthetic data, load-test, and bundle-budget tools.
- `docs/`: product, development, operations, security, and handover documentation.

## Quick Local Setup

Run from repository root:

```powershell
npm ci
npm run dev
```

Backend in another terminal:

```powershell
npm run build
npm run start
```

The backend listens on `http://localhost:3000` by default. Frontend development uses the frontend workspace Vite server.

## Main Commands

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run test:backup
npm run build
npm run perf:budget
npm run verify
```

Backup scripts require safe non-production variables before use; see [operations/backup-and-restore.md](docs/operations/backup-and-restore.md).

## Documentation

Start at [docs/README.md](docs/README.md).

## Deployment Summary

- Vercel builds `frontend/dist` using `npm --workspace frontend run build`.
- Vercel functions in `api/` proxy/schedule selected backend actions.
- Render uses `render.yaml` to build and run the backend.
- Production persistence currently depends on configured Upstash Redis for the backend workspace snapshot. PostgreSQL schema exists, but runtime PostgreSQL integration is not wired in the current backend.

## Security

Never commit secrets, database dumps, private chat data, real VAPID keys, production URLs with credentials, or backup objects. Only `VITE_` variables are allowed in the browser bundle.

## Maturity

Social Monitoring, backup automation, PostgreSQL runtime integration, full restore drills, and large-scale performance capacity need owner-provisioned staging/production validation before being treated as fully production-proven.
