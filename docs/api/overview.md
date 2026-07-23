# API Reference

Audience: frontend/backend developers and operators  
Last verified version: `0.1.1` / commit `8842877`

## Backend Health Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | liveness |
| `/health/live` | GET | liveness |
| `/health/ready` | GET | readiness; production requires Upstash Redis env |
| `/health/version` | GET | app version, commit, build timestamp, environment |

## Workspace API

Backend route: `POST /api/workspace`.

Request shape:

```json
{ "method": "dashboard", "args": [] }
```

Response shape:

```json
{ "data": {} }
```

Errors include `error` and sometimes `requestId`. The backend sets `x-request-id`.

Allowed methods are the `ContentRepository` methods implemented by `MemoryRepository`, including dashboard, content CRUD, settings, reports, chat, notifications, reminders, Monitoring, and technical health.

## Vercel Functions

| Function | Method | Notes |
| --- | --- | --- |
| `/api/workspace` | POST | proxies to `BACKEND_URL` |
| `/api/blob-upload` | POST | Vercel Blob client upload token; production requires `BLOB_UPLOAD_SECRET` |
| `/api/reminders-process` | POST | protected by `CRON_SECRET` when set; production fails closed if missing |
| `/api/monitoring-collect` | POST | protected by `CRON_SECRET`; proxies daily Monitoring collection to backend |

## Authorization

Role and permission data exists in shared code. Some repository methods call `requirePermission`, for example reports, Monitoring management, and technical health. Do not treat frontend navigation visibility as authorization.

## Date/Time

Use ISO timestamps for API data. Display Jalali dates in UI.
