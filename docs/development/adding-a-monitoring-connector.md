# Adding A Monitoring Connector

Audience: future developers  
Last verified version: `0.1.1` / commit `8842877`

Current Monitoring logic lives in `shared/services/monitoring-service.ts` and UI in `frontend/src/features/monitoring/monitoring-page.tsx`.

## Current Model

- Platforms declare capabilities.
- Sources have normalized URLs and platform keys.
- Jobs collect snapshots and events.
- UI must not show unsupported metrics as zero.

## Adding A New Platform

1. Add platform defaults/capabilities in shared monitoring defaults/service code.
2. Validate allowed domains and URL normalization.
3. Declare supported metrics and limitation states.
4. Add mock connector behavior for tests.
5. Add tests for URL validation, capability declaration, failure isolation, and snapshot writes.
6. Update Monitoring UI only if the capability model cannot render the new platform generically.

## Security Rules

- Do not crawl arbitrary URLs.
- Do not access private accounts or messages.
- Do not bypass platform restrictions.
- Do not run external calls inside database transactions.
- Use mocked responses in tests and performance runs.
