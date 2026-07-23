# Known Limitations

Audience: owner, operators, developers  
Last verified version: `0.1.1` / commit `8842877`

- PostgreSQL schema exists, but the current backend workspace route persists snapshots through Upstash Redis or a local file fallback.
- Real-time chat is implemented as polling/floating chat UI and repository operations; no dedicated WebSocket gateway is present in the repo.
- Browser IndexedDB/local state is not a multi-user production source of truth.
- Social Monitoring is Beta and uses capability-aware modeled data. Tests must not call real third-party platforms.
- Backup scripts exist, but no live restore drill was executed because no isolated restore database/storage was provided.
- No `.github` CI workflow is present.
- Browser screenshot/visual regression could not be captured in the final UI pass because the browser connector reported no browser available.
- Web Push depends on browser support, service worker readiness, and configured `VITE_VAPID_PUBLIC_KEY`.
- Render `free` plan in `render.yaml` may sleep and should not be treated as a high-availability production plan.
- A bootstrap password string exists in frontend auth code for the current local/browser auth flow. It must not be accepted as a production credential model.
