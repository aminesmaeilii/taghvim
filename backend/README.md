# Taghvim backend

Self-contained Node backend for the Taghvim content calendar. No Vercel or
Render specific code — this is a plain Node HTTP server that can run on any
VPS, container host, or PaaS that runs `node`.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values, see below
npm run build
npm start
```

The server listens on `PORT` (default `3000`) and exposes:

- `POST /api/workspace` — all calendar/content/campaign/chat/etc. data (RPC-style, method name + args in the JSON body)
- `POST /api/auth` — login/session/user management
- `POST /api/blob-upload` — file attachment uploads (PDF/image), via Vercel Blob
- `GET /health`, `GET /health/live` — liveness
- `GET /health/ready` — readiness; reports `persistence: "upstash-redis"` or `"local-file"`
- `GET /health/version` — build metadata

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **Persistent storage.** Without these, all data (calendar content, users, sessions) is written to a local JSON file on disk and is lost on every restart or redeploy. Create a free database at [upstash.com](https://upstash.com) (Redis, REST API tab has both values). This is not optional for any real deployment. |
| `FRONTEND_URL` / `ALLOWED_ORIGINS` | CORS allowlist. Must contain the exact origin the frontend is served from (e.g. `https://calendar.yourdomain.com`). Multiple origins: comma-separated in `ALLOWED_ORIGINS`. |
| `BLOB_READ_WRITE_TOKEN` | Needed only for file uploads (attachments in the education/auth flows). Create a Blob store at [vercel.com/storage](https://vercel.com/storage) — it works from any server, not only Vercel-hosted ones. |
| `BLOB_UPLOAD_SECRET` | Required in production alongside the token above; the frontend's upload call must send `Authorization: Bearer <this value>`. |
| `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` | First Super Admin account, created automatically on first request if no Super Admin exists yet. Change the default password. |

See `.env.example` for the full list with defaults.

## Scheduled jobs (reminders + monitoring)

Two features (`processDueReminders`, `runMonitoringCollection`) used to run via
Vercel Cron hitting a proxy function. There's no Vercel here, so point any
scheduler (system cron, a systemd timer, GitHub Actions, etc.) at the
already-existing `/api/workspace` RPC endpoint instead:

```bash
# every 5 minutes
curl -s -X POST https://your-backend-host/api/workspace \
  -H "content-type: application/json" \
  -d '{"method":"processDueReminders","args":["'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"]}'

# once a day
curl -s -X POST https://your-backend-host/api/workspace \
  -H "content-type: application/json" \
  -d '{"method":"runMonitoringCollection","args":["DAILY", null, null]}'
```

If this endpoint is reachable from the public internet and you want to
restrict who can trigger these two calls, put the scheduler behind your own
auth (e.g. an nginx location block with basic auth, or a private network) —
there's no built-in secret check on this route today.

## Notes / known follow-ups

- `database/` and `scripts/backup/` contain a PostgreSQL schema and backup
  tooling that exist for a *future* migration off the Redis-snapshot model.
  They are not wired into the running server yet — today's persistence is
  entirely the Redis (or local-file fallback) snapshot described above.
- The `/api/blob-upload` route was adapted from a Vercel serverless function
  to run inside this plain Node server. The handshake logic (`@vercel/blob`'s
  `handleUpload`) expects a Vercel-request-shaped object; this port passes it
  the same plain `{ method, headers, body }` adapter the other two routes
  use, which matches what Vercel's own runtime passes. Smoke-test a real file
  upload after deploying — this specific route wasn't executed as part of the
  restructuring.
