-- Backup metadata catalog. Stores references and safe metadata only; never signed URLs or credentials.

BEGIN;

CREATE TYPE backup_type AS ENUM ('POSTGRES_LOGICAL','OBJECT_STORAGE','CONFIGURATION','PRE_MIGRATION','RESTORE_TEST');
CREATE TYPE backup_status AS ENUM ('SCHEDULED','RUNNING','COMPLETED','VERIFIED','FAILED','EXPIRED','DELETED');

CREATE TABLE backup_catalog (
  id text PRIMARY KEY,
  environment text NOT NULL CHECK (environment IN ('production','staging','restore-test','development')),
  backup_type backup_type NOT NULL,
  status backup_status NOT NULL,
  database_version text,
  schema_migration_version text,
  application_version text,
  commit_sha text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  object_location_reference text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  checksum_algorithm text,
  checksum text,
  encrypted boolean NOT NULL DEFAULT true,
  retention_class text NOT NULL,
  expires_at timestamptz,
  verification_status text NOT NULL DEFAULT 'NOT_VERIFIED',
  last_verified_at timestamptz,
  restore_test_status text NOT NULL DEFAULT 'NOT_TESTED',
  last_restore_test_at timestamptz,
  safe_error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_catalog_environment_status ON backup_catalog(environment, status, completed_at DESC);
CREATE INDEX idx_backup_catalog_restore_test ON backup_catalog(environment, restore_test_status, last_restore_test_at DESC);

COMMIT;
