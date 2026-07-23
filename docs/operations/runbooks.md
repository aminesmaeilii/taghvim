# Incident Runbooks

Audience: operators  
Last verified version: `0.1.1` / commit `8842877`

## Backend Unavailable

Symptoms: `/health/live` fails, Vercel proxy returns 502.  
Checks: Render service status, logs, `BACKEND_URL`, `/health/ready`.  
Safe actions: restart backend, verify Upstash env, roll back compatible backend version.  
Escalate: repeated readiness failures or data persistence errors.

## Database/Persistence Unavailable

Symptoms: `/health/ready` 503 in production, workspace saves fail.  
Checks: Upstash URL/token, provider status, logs.  
Safe actions: restore env variables, pause risky writes, preserve `.data` fallback only for non-production.  
Do not: reset production data.

## Reminder Queue Delayed

Symptoms: due reminders not producing notifications.  
Checks: `/api/reminders-process`, `CRON_SECRET`, backend logs, reminders status.  
Safe actions: run authorized scheduler request once, monitor duplicate behavior.

## Daily Monitoring Missed

Symptoms: stale sources, no latest snapshots.  
Checks: `/api/monitoring-collect`, `CRON_SECRET`, Monitoring jobs/events.  
Safe actions: run authorized recovery, keep real third-party calls disabled in tests.

## Push Delivery Failing

Symptoms: in-app notifications exist but device Push missing.  
Checks: browser support, service worker, `VITE_VAPID_PUBLIC_KEY`, invalid subscriptions.  
Safe actions: preserve in-app notification records, ask user to re-enable device permission.

## Backup Failed

Symptoms: backup catalog status `FAILED`, technical health stale/degraded.  
Checks: storage path, credentials, quota, checksum, PostgreSQL CLI.  
Safe actions: create manual authorized backup, stop risky migrations.

## Failed Deployment

Symptoms: frontend 404, backend not ready, functions fail.  
Checks: Vercel build output `frontend/dist`, Render start command, env variables, health endpoints.  
Safe actions: roll back compatible version, verify critical journeys.
