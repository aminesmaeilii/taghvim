# Performance Audit and Capacity Report

Date: 2026-07-23

## Audit

Frontend findings:

- Production build uses route-level lazy loading for Reports, Monitoring, Technical Health, and PDF reader.
- Largest app JS chunk after cleanup: 743,443 bytes. Dedicated PDF worker: 1,255,067 bytes. CSS: 103,800 bytes. Total built assets: 3,136,076 bytes.
- Persian Vazirmatn font files are bundled in multiple weights and scripts; they are important for UI quality but should remain budgeted.
- Duplicate Monitoring routes were present and removed.
- Calendar, chat, reports, and monitoring pages are not virtualized in this audit; large-list behavior needs browser profiling with production data.

Backend findings:

- The backend RPC route reloads and saves a full workspace snapshot for each request when using Redis or local fallback storage.
- Local fallback persistence is useful for development but is not production-grade performance infrastructure.
- The backend start script pointed at the wrong build path; it was corrected so local/performance startup can run from the root workspace.
- No production SQL query layer is wired yet; PostgreSQL schema and indexes exist, but query-plan profiling needs a real isolated database.

Database findings:

- Existing schema includes useful indexes for calendar ranges, task lookup, chat pagination, due reminders, notifications, monitoring snapshots, background job claiming, and audit pagination.
- Added `scripts/performance/query-plan.sql` for isolated `EXPLAIN (ANALYZE, BUFFERS)` profiling of calendar ranges, chat pagination, and due reminders.
- No new SQL index was added because no production-like query plan was available.

Jobs and real-time findings:

- Real-time chat is represented in repository methods but no WebSocket gateway is implemented in this repo.
- Reminder and monitoring scheduler endpoints exist, but full worker contention testing requires isolated queue/worker infrastructure.
- Monitoring performance tests must use mocked connectors only; no real social platform was called.

## Test Environment

Executed environment: local isolated Node backend on `127.0.0.1:3000`, production-built backend/frontend artifacts, local fallback workspace state, synthetic test identities, no real notifications, no real third-party crawler calls, no production credentials.

Differences from staging/production: no PostgreSQL, no real connection pool, no Redis network latency measurement, no WebSocket gateway, no worker fleet, no real CPU/memory telemetry, no cloud autoscaling or cold-start measurement.

## Dataset Profiles

Created deterministic generator: `npm run perf:data`.

Profiles:

- Small: 5 users, 30 contents, 40 tasks, 4 campaigns, 3 conversations, 30 messages, 50 notifications, 5 monitoring sources, 30 monitoring snapshots.
- Realistic: 25 users, 500 contents, 800 tasks, 40 campaigns, 25 conversations, 2,000 messages, 3,000 notifications, 40 monitoring sources, 2,400 monitoring snapshots.
- Large: 100 users, 5,000 contents, 8,000 tasks, 250 campaigns, 150 conversations, 50,000 messages, 80,000 notifications, 250 monitoring sources, 45,000 monitoring snapshots.

Generated data is tagged `PERF_SYNTHETIC_ONLY` and `performance-results/` is ignored by Git.

## Workload Model

Created protocol-level workload runner: `npm run perf:load`.

Journeys covered:

- Bootstrap/session-style startup.
- Dashboard.
- Calendar/content list.
- Report snapshot with realistic permission object.
- Monitoring overview.
- Notification list.
- Conversation list.
- Message history.
- Controlled message send.

Profiles:

- Smoke: 2 users, 8 journey iterations, concurrency 2.
- Baseline: 5 users, 25 journey iterations, concurrency 4.
- Expected: 15 users, 60 journey iterations, concurrency 8.
- Peak: 30 users, 120 journey iterations, concurrency 12.

## Proposed Targets

Owner approval required:

- Normal API p95: under 300 ms in staging.
- Expensive report p95: under 1,500 ms for bounded date ranges.
- Chat send confirmation p95: under 500 ms.
- Message history p95: under 400 ms for page size 50.
- Reminder processing delay: under 60 seconds for due reminders.
- Monitoring overview p95: under 1,000 ms using mocked connectors.
- Frontend largest app JS chunk: under 900 KB.
- Dedicated worker chunk: under 1.4 MB.
- CSS: under 140 KB.
- Total built assets: under 3.8 MB.

## Results

Frontend budget, after route cleanup:

- Total assets: 3,136,076 bytes.
- Largest app JS: 743,443 bytes.
- Largest worker JS: 1,255,067 bytes.
- CSS: 103,800 bytes.
- Result: pass.

Smoke local API:

- Requests: 62.
- RPS: 64.86.
- Error rate: 0.
- p50/p95/p99: 11 ms / 25 ms / 146 ms.
- Largest bootstrap payload: 53,705 bytes.

Baseline local API:

- Requests: 172.
- RPS: 144.81.
- Error rate: 0.
- p50/p95/p99: 13 ms / 21 ms / 26 ms.
- Largest bootstrap payload: 56,100 bytes.

Expected local API:

- Requests: 389.
- RPS: 227.71.
- Error rate: 0.
- p50/p95/p99: 23 ms / 32 ms / 37 ms.
- Largest bootstrap payload: 60,219 bytes.

Growth-sensitivity rerun after additional synthetic records accumulated:

- Requests: 389.
- RPS: 142.69.
- Error rate: 0.
- p50/p95/p99: 21 ms / 113 ms / 148 ms.
- Bootstrap: 416 ms and 64,749 bytes.
- This is not a clean before/after comparison because the local data volume changed; it indicates snapshot growth can affect bootstrap and aggregate endpoints.

## Optimizations Implemented

- Removed duplicate Monitoring route registrations from the frontend router.
- Corrected backend start script to point at `backend/dist/backend/src/server.js`.
- Added bundle budget regression checks with separate app JS and worker budgets.
- Added deterministic load-test and dataset tooling.

No SQL index or caching change was made because there was no isolated PostgreSQL execution plan proving a bottleneck.

## Bottlenecks

Confirmed locally:

- Bootstrap returns the largest payload and worsens as local snapshot state grows.
- PDF worker is the largest single asset, but it is lazy-loaded through the PDF reader route.

Suspected, requiring staging measurement:

- Full workspace snapshot load/save per RPC will not scale well for large workspaces.
- Report and monitoring aggregations need SQL-backed bounded queries before production scale.
- Real-time chat needs a dedicated WebSocket/pub-sub design before concurrent connection capacity can be claimed.
- Worker/API contention cannot be validated until queue and worker isolation exist.

## Capacity Estimate

Local-only confidence: low for production capacity, useful for regression signals.

Observed local expected-load profile handled 15 synthetic users and 389 requests with 0 errors and p95 32 ms before state growth. A conservative staging starting target is 15-30 concurrent active users on the current architecture, pending PostgreSQL/Redis-backed tests.

First expected scaling bottleneck: full snapshot serialization/persistence and bootstrap payload size.

Upgrade triggers:

- Bootstrap payload exceeds 250 KB.
- Normal API p95 exceeds 300 ms in staging.
- Report p95 exceeds 1,500 ms.
- Worker jobs increase API p95 by more than 50%.
- Database connection wait time appears.
- Chat message p95 exceeds 500 ms or duplicate delivery appears.

## Required Staging Tests

Still required before production capacity claims:

- PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` for critical queries.
- Expected, peak, stress, spike, soak, and recovery tests against isolated staging.
- WebSocket connection and chat broadcast tests.
- Reminder/notification worker throughput with mock push provider.
- Monitoring crawler throughput with mock connectors.
- Worker/API contention with separate queue.
- CPU, memory, database connection, queue depth, and slow-query telemetry capture.

Recommended next performance review: after PostgreSQL runtime integration and before the next production release that adds real-time chat or daily crawler volume.
