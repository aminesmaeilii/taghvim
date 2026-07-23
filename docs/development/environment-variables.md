# Environment Variables

Audience: developers and operators  
Last verified version: `0.1.1` / commit `8842877`

Do not place real secret values in Git. Only `VITE_` variables may be exposed to the browser.

| Name | Service | Public | Required | Purpose |
| --- | --- | --- | --- | --- |
| `VITE_APP_NAME` | frontend | yes | optional | display/build metadata |
| `VITE_APP_ENV` | frontend | yes | optional | environment label |
| `VITE_FRONTEND_URL` | frontend | yes | optional | frontend URL reference |
| `VITE_API_URL` | frontend | yes | production unless same-origin Vercel | backend/API base URL |
| `VITE_PUBLIC_WEB_PUSH_KEY` | frontend | yes | optional | documented public key placeholder |
| `VITE_VAPID_PUBLIC_KEY` | frontend | yes | required for Push subscription | actual code lookup for VAPID public key |
| `BACKEND_URL` | Vercel functions | no | required | upstream backend URL |
| `ALLOWED_ORIGINS` | backend | no | production | CORS allowlist |
| `NODE_ENV` | backend/functions | no | production | runtime mode |
| `PORT` | backend | no | optional | backend listen port, default `3000` |
| `FRONTEND_URL` | backend | no | production | CORS/frontend origin |
| `UPSTASH_REDIS_REST_URL` | backend | no | production persistence | Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | backend | no | production persistence | Redis token |
| `CRON_SECRET` | functions | no | production scheduler | protects scheduled endpoints |
| `BLOB_UPLOAD_SECRET` | functions | no | production uploads | protects upload token endpoint |
| `WEB_PUSH_SUBJECT` | future server push | no | optional | push identity |
| `WEB_PUSH_PRIVATE_KEY` | future server push | no | optional/secret | private VAPID key |
| `DATABASE_URL` | backup/future DB | no | optional now | PostgreSQL URL |
| `DATABASE_SSL` | future DB | no | optional | SSL flag |
| `DATABASE_POOL_MAX` | future DB | no | optional | pool size |
| `DATABASE_MIGRATION_URL` | migrations | no | optional | migration credential |
| `APP_VERSION` | backend/logs | no | optional | version endpoint/logs |
| `COMMIT_SHA` | backend/logs | no | optional | version endpoint/logs |
| `BUILD_TIMESTAMP` | backend | no | optional | version endpoint |
| `OBSERVABILITY_SERVICE_NAME` | logs | no | optional | structured log service name |
| `BACKUP_*` | backup scripts/health | no | required for backup workflows | backup env, storage, catalog, RPO/status |
| `RESTORE_TEST_DATABASE_URL` | restore test | no | restore tests | isolated restore DB |
| `PG_DUMP_BIN`, `PG_RESTORE_BIN`, `PSQL_BIN` | backup scripts | no | optional | PostgreSQL CLI paths |
| `PERF_*` | performance scripts | no | optional | performance profile and budgets |

Note: `.env.example` currently includes `VITE_PUBLIC_WEB_PUSH_KEY`, while code reads `VITE_VAPID_PUBLIC_KEY`. Set `VITE_VAPID_PUBLIC_KEY` for real Push subscription support.
