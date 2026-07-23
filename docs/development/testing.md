# Testing And Commands

Audience: developers and operators  
Last verified version: `0.1.1` / commit `8842877`

## Verified Commands

Run from repository root:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run test:backup
npm run build
npm run perf:budget
```

`npm run verify` runs typecheck, lint, frontend tests, and build.

## Test Coverage Present

- Authorization tests.
- Observability tests.
- Content schema tests.
- Report metrics tests.
- Chat repository tests.
- Monitoring service tests.
- Reminder repository tests.
- Jalali utility tests.
- Content repository tests.
- Backup safety tests.

## Performance Scripts

```powershell
npm run perf:data
npm run perf:load
npm run perf:budget
```

Do not point performance tests at production without explicit approval.

## Backup Tests

```powershell
npm run test:backup
```

Restore tests require isolated storage and `RESTORE_TEST_DATABASE_URL`.
