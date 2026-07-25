# Zambil / Taghvim

Persian-first content operations app: a Jalali content calendar plus tasks,
campaigns, workflows, chat, reminders, notifications, reports, social
monitoring, and technical health tracking.

Two independent, self-contained parts:

- **`backend/`** — Node HTTP API (calendar/content data, auth, file uploads).
- **`frontend/`** — React/Vite app, builds to static files.

Neither folder depends on the other at build time, and neither depends on
any specific hosting provider — deploy them on one server or two, on any
host that runs Node and serves static files.

## Deploying on a server

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in the values below
npm run build
npm start
```

Required for real persistence: **`UPSTASH_REDIS_REST_URL`** and
**`UPSTASH_REDIS_REST_TOKEN`** — create a free Redis database at
[upstash.com](https://upstash.com) and copy both values from its REST API
tab. Without these, data is written to a local JSON file on disk instead and
is lost on every restart — this is not a production-safe configuration.

Also set **`ALLOWED_ORIGINS`** to the exact origin the frontend will be
served from, e.g. `https://calendar.yourdomain.com`.

See `backend/README.md` for the full environment variable list, the
scheduled-job (reminders/monitoring) setup, and file-upload configuration.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL to the backend's URL from step 1
npm run build
```

`npm run build` produces `frontend/dist/` — serve it with any static file
host (nginx, Caddy, a CDN, etc.). See `frontend/README.md` for the two
supported deployment shapes (separate origin vs. same-origin reverse proxy).

### 3. Point them at each other

- Frontend's `VITE_API_URL` → backend's public URL.
- Backend's `ALLOWED_ORIGINS` → frontend's public origin (for CORS).

## Local development

```bash
cd backend && npm install && npm run build && npm start   # terminal 1
cd frontend && npm install && npm run dev                  # terminal 2
```

The backend listens on `http://localhost:3000` by default; the frontend
dev server runs on `http://localhost:1420`.

## Default admin login

On first boot, if no Super Admin exists yet, the backend creates one:
username `taghvim-root`, password `Taghvim-Admin-2026` (both overridable via
`BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` in the backend's env).

## Notes

- `backend/database/` holds a PostgreSQL schema for a possible future
  migration off the current Redis-snapshot persistence model — it exists
  but isn't wired into the running server yet.
- `backend/scripts/backup/` are Postgres backup/verify/restore tools tied
  to that same future schema.
- File uploads (attachments) use Vercel Blob storage — a storage API usable
  from any server, independent of where the app itself is hosted. See
  `backend/README.md` for the required token.
- Never commit secrets, real API tokens, or production URLs with
  credentials embedded in them. Only `VITE_`-prefixed variables are exposed
  to the browser bundle.
