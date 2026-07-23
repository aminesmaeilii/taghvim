# Troubleshooting

Audience: developers and operators  
Last verified version: `0.1.1` / commit `8842877`

## Frontend Does Not Start

Run `npm ci`, then `npm run dev`. Check Node `24.x`, port conflicts, and Vite output.

## Backend Does Not Start

Run:

```powershell
npm run build
npm run start
```

Check `backend/dist/backend/src/server.js` exists and port `3000` is free.

## CORS Error

Check `FRONTEND_URL` and `ALLOWED_ORIGINS` on backend.

## Workspace Proxy Fails

Check Vercel `BACKEND_URL` and backend `/health/ready`.

## Scheduler Unauthorized

Check `CRON_SECRET` and `Authorization: Bearer <secret>`.

## Upload Fails

Check `BLOB_UPLOAD_SECRET`, file type, and 50 MB limit.

## Push Unavailable

Check service worker, browser Push support, notification permission, and `VITE_VAPID_PUBLIC_KEY`.

## Reports Slow

Run performance scripts locally and SQL profiling in isolated PostgreSQL when DB integration exists. Do not test production directly.

## Backup Fails

Check `BACKUP_STORAGE_DIR`, PostgreSQL CLI, DB URL, catalog path, and storage quota.
