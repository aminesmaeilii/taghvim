# Service And Secret Inventory

Audience: owner, technical administrator  
Last verified version: `0.1.1` / commit `8842877`

## Services

| Service | Purpose | Path/config | Provider evidence | Health |
| --- | --- | --- | --- | --- |
| Frontend PWA | Persian UI | `frontend/`, `vercel.json` | Vercel config | browser route smoke required |
| Vercel functions | proxy, upload, schedulers | `api/` | `vercel.json` rewrites | function logs/provider |
| Backend API | workspace RPC and health | `backend/`, `render.yaml` | Render config | `/health/ready` |
| Shared domain/services | business logic | `shared/` | npm/TS imports | tests |
| PostgreSQL schema | target relational schema | `backend/database/postgres/` | SQL files | not runtime-wired |
| Tauri desktop | desktop shell | `src-tauri/` | Tauri config | local desktop build |
| Backup tooling | logical backup/restore test | `backend/scripts/backup/` | npm scripts | `npm run test:backup` |
| Performance tooling | load/budget checks | `scripts/performance/` | npm scripts | `npm run perf:budget` |

## Secret Names Without Values

| Secret | Purpose | Owner |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | backend persistence endpoint | نیازمند تعیین مالک |
| `UPSTASH_REDIS_REST_TOKEN` | backend persistence credential | نیازمند تعیین مالک |
| `CRON_SECRET` | scheduler endpoint protection | نیازمند تعیین مالک |
| `BLOB_UPLOAD_SECRET` | upload endpoint protection | نیازمند تعیین مالک |
| `DATABASE_URL` / `BACKUP_DATABASE_URL` | PostgreSQL/backup source | نیازمند تعیین مالک |
| `DATABASE_MIGRATION_URL` | privileged migrations | نیازمند تعیین مالک |
| `WEB_PUSH_PRIVATE_KEY` | private VAPID key | نیازمند تعیین مالک |
| `VITE_VAPID_PUBLIC_KEY` | public VAPID key | نیازمند تعیین مالک |
| `BACKUP_STORAGE_DIR` / provider credentials | backup storage | نیازمند تعیین مالک |

## Ownership Gaps

Product, frontend, backend, database, deployment, connectors, Web Push, backups, security, billing, DNS/domain, and incident response owners are not named in the repository. Mark all as `نیازمند تعیین مالک` until assigned.
