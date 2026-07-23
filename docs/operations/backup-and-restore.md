# Backup And Restore

Audience: database administrators and operators  
Last verified version: `0.1.1` / commit `8842877`

See also [../BACKUP_AND_DISASTER_RECOVERY.md](../BACKUP_AND_DISASTER_RECOVERY.md).

## Implemented Scripts

```powershell
npm run backup:postgres
npm run backup:verify
npm run backup:restore-test
npm run backup:retention
npm run test:backup
```

## Preconditions

- `BACKUP_DATABASE_URL` or `DATABASE_URL`
- `BACKUP_STORAGE_DIR`
- `BACKUP_ENVIRONMENT`
- `BACKUP_CATALOG_PATH`
- PostgreSQL CLI tools
- isolated `RESTORE_TEST_DATABASE_URL` for restore tests

## Safety

Restore tests refuse production-looking targets. Temp cleanup is constrained to the backup temp root. Retention cleanup defaults to dry-run and preserves the newest valid backup and the only restore-tested backup.

## Current Evidence

Backup safety tests pass. No live restore drill is recorded because isolated restore infrastructure was not provided.

## Production Rule

Do not run migrations that require backup protection after a failed required backup.
