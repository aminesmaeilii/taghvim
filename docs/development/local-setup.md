# Local Development

Audience: developers  
Last verified version: `0.1.1` / commit `8842877`

## Prerequisites

- Node.js `24.x`
- npm
- PowerShell on Windows
- Optional desktop build: Rust/Cargo and Tauri prerequisites
- Optional PostgreSQL tools for backup scripts: `pg_dump`, `pg_restore`, `psql`

## Install

From repository root:

```powershell
npm ci
```

## Frontend Dev Server

```powershell
npm run dev
```

This runs the frontend workspace Vite server.

## Production-Like Local Build

```powershell
npm run build
npm run start
```

The backend starts at `http://localhost:3000`.

## Tauri

```powershell
npm run tauri:dev
npm run tauri:build
```

## Adding UI Code

- New route: `frontend/src/app/app.tsx`.
- Shell/navigation: `frontend/src/components/app-shell.tsx`.
- Shared UI primitive: `frontend/src/components/ui.tsx`.
- Feature page: `frontend/src/features/<feature>/`.
- Shared business logic: `shared/services/`.

Preserve RTL, Persian microcopy, and permission-aware UI.
