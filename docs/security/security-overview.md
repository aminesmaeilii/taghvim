# Security Overview

Audience: security reviewer, developers, operators  
Last verified version: `0.1.1` / commit `8842877`

## Authentication And Authorization

Frontend auth service manages browser/dev auth state. Shared authorization defines roles and permissions. Backend/shared `requirePermission` is used for reports, Monitoring management, and technical health. UI hiding is not security.

## Secrets

Never commit secret values. Server-only variables include Upstash tokens, cron secret, blob upload secret, database URLs, VAPID private key, and backup storage credentials.

## Controls Present

- CORS allowlist in backend route.
- Vercel security headers: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`.
- Cron endpoints fail closed in production if `CRON_SECRET` is missing.
- Blob upload endpoint fails closed in production if `BLOB_UPLOAD_SECRET` is missing.
- Structured log redaction for sensitive fields.
- Backup restore guards.

## Threats To Watch

- Browser/local-first data is not suitable for sensitive multi-user production without hardened backend auth/session enforcement.
- Social Monitoring must avoid SSRF and unauthorized crawling.
- Push keys and subscriptions are sensitive.
- Backup deletion/restore permissions must be tightly controlled.

## Security Test Commands

```powershell
npm run lint
npm run test:run
npm run test:backup
```

No dedicated dependency audit or SAST script exists in `package.json`.
