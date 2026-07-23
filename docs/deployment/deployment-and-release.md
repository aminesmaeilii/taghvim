# Deployment And Release

Audience: DevOps/operator, technical administrator  
Last verified version: `0.1.1` / commit `8842877`

## Actual Config

Vercel:

- `vercel.json`
- install: `npm install`
- build: `npm --workspace frontend run build`
- output: `frontend/dist`
- functions: `api/workspace.js`, `api/blob-upload.js`, `api/reminders-process.js`, `api/monitoring-collect.js`
- security headers are configured for all routes.

Render:

- `render.yaml`
- service: `taghvim-backend`
- runtime: Node
- plan: `free`
- build: `npm install && npm --workspace backend run build`
- start: `npm --workspace backend run start`
- health: `/health/ready`

## Required Production Variables

Vercel functions need `BACKEND_URL`; scheduler endpoints need `CRON_SECRET`; upload endpoint needs `BLOB_UPLOAD_SECRET`.

Render backend needs `FRONTEND_URL`, `ALLOWED_ORIGINS`, and production persistence credentials `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

## Safe Release Checklist

1. Confirm Git status and review diff.
2. Run:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run test:backup
npm run build
npm run perf:budget
```

3. Confirm no secrets or backup files are staged.
4. Confirm latest backup status before risky migrations.
5. Deploy staging if available.
6. Smoke test login, dashboard, calendar, tasks, reports, Monitoring, technical health.
7. Deploy production.
8. Check `/health/ready` and `/health/version`.
9. Monitor logs and errors.

## Rollback

Frontend rollback is safe when API contracts are compatible. Backend rollback is safe only if data format/migrations remain compatible. For irreversible data changes, prefer a forward fix or reviewed recovery procedure.

## CI/CD Status

No `.github` workflow exists in this repository at verification time. Provider-managed deployment may still exist outside Git, but it was not verifiable from the repo.
