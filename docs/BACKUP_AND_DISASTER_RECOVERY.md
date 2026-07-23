# Backup and Disaster Recovery

Date: 2026-07-23

## Backup Audit

Persistent data found in this repository:

- PostgreSQL target schema in `backend/database/postgres`, covering users, roles, permissions, workspaces, calendar content, tasks, campaigns, chat, reminders, notifications, push subscriptions, monitoring sources, monitoring snapshots, jobs, settings, and audit logs.
- Current backend persistence uses Upstash Redis when configured, with `.data/workspace-snapshot.json` as a local fallback. The fallback is not a production backup.
- Uploaded files use the Vercel Blob upload endpoint. SQL backups do not protect blob objects.
- PWA/offline data can exist in browser IndexedDB. Production source of truth must be server-side; browser data is not centrally recoverable.
- Infrastructure config exists in `render.yaml`, `vercel.json`, `.env.example`, docs, migrations, and source.

Current risks:

- Managed PostgreSQL backups and PITR cannot be confirmed from the repo and require provider verification.
- Object-storage versioning/lifecycle cannot be confirmed from the repo.
- The PostgreSQL schema exists, but runtime database integration is marked future work in `.env.example`.
- No prior restore-test evidence was present.
- Production backup alerts require `BACKUP_ALERT_WEBHOOK_URL`.
- No paid storage or provider PITR was enabled by this change.

## Proposed Recovery Requirements

Proposed RPO, requiring owner approval: 24 hours with daily logical backups; 1 hour or provider PITR if message/reminder volume becomes business-critical.

Proposed RTO, requiring owner approval: 4 hours for essential service restoration from logical backup and object storage; 1 hour if managed PITR/failover is approved and tested.

PITR status: unknown. Owner must confirm provider, retention window, granularity, region, encryption, and restore limitations.

## Data Classification

Critical: users, roles, permissions, workspace membership, content calendar, tasks, campaigns, workflows, chat messages, reminder schedules, monitoring sources, historical monitoring snapshots, monitored-content history, settings, audit logs, migration history.

Important: notification history, report configuration, saved filters, user preferences, export metadata, monitored-content metrics, push subscription records.

Regenerable: derived report aggregates, materialized/report calculations, search indexes, generated thumbnails, temporary exports, safe retry metadata.

Ephemeral: typing indicators, online presence, browser UI state, caches, temporary local files.

## Architecture

Layer 1: enable managed PostgreSQL automated backups and PITR with provider encryption and monitored retention after owner approval.

Layer 2: `npm run backup:postgres` creates a PostgreSQL custom-format logical dump using `pg_dump`, checksums it, copies it to `BACKUP_STORAGE_DIR`, verifies remote size/checksum, records safe metadata, and removes temp files.

Layer 3: uploaded files must be protected through private blob storage, versioning, lifecycle policy, and a reconciliation procedure. Restore tests must verify DB file metadata against restored object versions before service cutover.

Layer 4: configuration recovery uses repo-controlled manifests, migrations, scheduler/queue docs, and environment-variable names. Secret values are recovered only from the approved secret manager.

## Automation

Required schedules:

- Daily logical database backup: `npm run backup:postgres`
- Verification after every backup: `npm run backup:verify`
- Pre-migration backup: run backup and verification before production migrations; abort migration on failure.
- Restore drill: `npm run backup:restore-test` at least every 90 days.
- Retention cleanup: `npm run backup:retention`; dry-run by default.

Required environment variables are listed in `.env.example`. `BACKUP_STORAGE_DIR` must be private storage outside the application runtime and outside Git.

## Retention

Proposed defaults, requiring approval:

- Daily: 14-30 days
- Weekly: 8-12 weeks
- Monthly: 6-12 months
- Pre-migration: until release verification plus a safety period

Cleanup uses catalog metadata, refuses invalid prefixes, defaults to dry-run, and preserves the newest valid backup and the only restore-tested backup.

## Access Control

Permissions added:

- `backup.status.read`
- `backup.create`
- `backup.verify`
- `backup.restore_test`
- `backup.restore_production`
- `backup.retention.manage`
- `backup.delete`

Production restoration must remain separate from restore tests and requires explicit reviewed authorization.

## Restore Procedure

1. Select a `VERIFIED` backup from the catalog.
2. Confirm authorization and target environment.
3. Use a new empty restore database, never production.
4. Set `BACKUP_ENVIRONMENT=restore-test`, `BACKUP_STORAGE_DIR`, `BACKUP_CATALOG_PATH`, and `RESTORE_TEST_DATABASE_URL`.
5. Run `npm run backup:restore-test -- <backup-id>`.
6. The script refuses production-looking targets unless a separate reviewed production-recovery override is set.
7. Run smoke tests with outbound notifications, Web Push, chat delivery, and crawlers disabled.
8. Record restore duration, counts, missing/orphaned files, and result.

## Disaster Runbooks

Accidental deletion: check soft-delete/archive first. Otherwise restore the selected backup into isolation, identify related records, create a reviewed recovery package, import through a controlled migration or tool, verify integrity, and audit the recovery.

Failed migration: stop incompatible deployment, confirm pre-migration backup, prefer forward repair when possible, restore only with explicit authorization, and verify app/database version compatibility.

Database corruption: stop writes if needed, preserve evidence, restore latest healthy recovery point to a new database, run verification, then switch connection safely.

Provider outage: avoid split writes, monitor provider status, use failover or recovered instance only through the documented process.

Object storage loss: restore object versions or replicas, reconcile database metadata, regenerate safe derived files, and never restore private files to a public bucket.

Credential compromise: revoke and rotate credentials, inspect backup access logs, verify attacker cannot delete both primary data and backups, and preserve audit evidence.

Entire environment loss: recreate infrastructure from repo docs/manifests, restore secrets from the secret manager, restore database and files, deploy compatible app version, verify services, then restore DNS/routes.

## Monitoring

Technical health now includes a backup service using `BACKUP_LAST_SUCCESS_AT`, `BACKUP_LAST_RESTORE_TEST_AT`, `BACKUP_RPO_HOURS`, and `BACKUP_RESTORE_DRILL_DAYS`.

Track:

- `backup_age_seconds`
- `restore_test_age_days`
- backup duration, size, failures, verification failures, storage usage, and restore-test duration through the scheduler/monitoring system.

Alerts:

- Critical: no valid backup inside RPO, all recent backups failed, storage inaccessible, repeated restore failures, encryption key unavailable, migration started without required backup.
- Error: scheduled backup failed, checksum mismatch, upload failed, unreadable archive.
- Warning: backup becoming old, unexpected size change, quota nearing limit, restore drill overdue, provider backup disabled, PITR retention reduced.

## Restore-Test Result

No live restore drill was executed in this workspace because no `BACKUP_DATABASE_URL`, `BACKUP_STORAGE_DIR`, or isolated `RESTORE_TEST_DATABASE_URL` was provided. The tooling is implemented and guarded; owner must provide non-production restore infrastructure to complete the first drill.

Next recommended restore drill date: within 7 days of provisioning backup storage and an isolated restore database, then every 90 days.
