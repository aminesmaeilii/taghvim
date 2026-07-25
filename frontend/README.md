# Taghvim frontend

Self-contained React/Vite app for the Taghvim content calendar. Builds to a
static `dist/` folder — no Vercel-specific code, deployable behind nginx,
Caddy, Apache, a CDN, or any static file host.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL to the backend's URL, see ../backend
npm run build
```

`npm run build` produces `dist/`. Serve that folder with any static web
server. Two deployment shapes work:

1. **Different origin from the backend** (e.g. frontend on
   `calendar.example.com`, backend on `api.example.com`): set `VITE_API_URL`
   to the backend's full URL before building. Make sure the backend's
   `ALLOWED_ORIGINS` includes `https://calendar.example.com`.
2. **Same server/origin as the backend, behind one reverse proxy**: leave
   `VITE_API_URL` empty, and configure your proxy so `/api/*` requests are
   forwarded to the backend process while everything else serves this
   `dist/` folder as static files (or falls back to `index.html` for
   client-side routing).

For local development: `npm run dev` (Vite dev server on port 1420).

## What's in here

- `src/` — the app itself
- `shared/` — types/schemas/utilities shared with the backend (duplicated
  here so this folder is fully standalone; keep it in sync with
  `../backend/shared` if you change either copy)
- `public/` — PWA manifest, service worker, icon

## Notes

- File uploads (`src/services/blob-storage.ts`) call
  `${VITE_API_URL}/api/blob-upload` on the backend, which needs
  `BLOB_READ_WRITE_TOKEN` configured there (see backend README).
- Desktop packaging (Tauri) dependencies are still listed in
  `package.json` for parity with the original app, but no Tauri project
  (`src-tauri/`) is included here — this package is set up for a plain web
  deployment only.
- Lint/test tooling (`eslint`, `vitest`) is included but optional; skip
  `npm install`-ing them by trimming `devDependencies` if you only need the
  production build.
