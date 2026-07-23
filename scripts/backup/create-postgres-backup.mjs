#!/usr/bin/env node
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { appendCatalogRecord, backupId, checksumFile, fileSize, requireSafeEnvironment, runCommand, safeCleanup } from "./lib.mjs";

const environment = requireSafeEnvironment();
const databaseUrl = process.env.BACKUP_DATABASE_URL ?? process.env.DATABASE_URL;
const storageDir = process.env.BACKUP_STORAGE_DIR;
const tempRoot = process.env.BACKUP_TEMP_DIR ?? join(process.cwd(), ".tmp", "backups");
const catalogPath = process.env.BACKUP_CATALOG_PATH ?? join(process.cwd(), ".backup-catalog", `${environment}.json`);
const id = backupId("pg");
const startedAt = new Date().toISOString();
const appVersion = process.env.APP_VERSION ?? "0.1.1";
const commitSha = process.env.COMMIT_SHA ?? null;
const migrationVersion = process.env.DB_MIGRATION_VERSION ?? "database/postgres/001_unified_schema.sql";
let workDir;

if (!databaseUrl) throw new Error("BACKUP_DATABASE_URL or DATABASE_URL is required.");
if (!storageDir) throw new Error("BACKUP_STORAGE_DIR is required and must point outside the application runtime.");
if (environment === "production" && !process.env.BACKUP_ALERT_WEBHOOK_URL) {
  console.warn("Production backup alerts are not configured; set BACKUP_ALERT_WEBHOOK_URL.");
}

try {
  workDir = join(tempRoot, id);
  await mkdir(workDir, { recursive: true });
  const dumpPath = join(workDir, `${id}.dump`);
  await runCommand(process.env.PG_DUMP_BIN ?? "pg_dump", ["--format=custom", "--verbose", "--no-owner", "--no-acl", "--file", dumpPath, databaseUrl]);
  const checksum = await checksumFile(dumpPath);
  const sizeBytes = await fileSize(dumpPath);
  if (sizeBytes <= 0) throw new Error("Backup dump is empty.");
  const date = new Date();
  const objectKey = join("backups", environment, "database", String(date.getUTCFullYear()), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0"), `${id}.dump`);
  const objectPath = join(storageDir, objectKey);
  await mkdir(dirname(objectPath), { recursive: true });
  await copyFile(dumpPath, objectPath);
  const remoteSize = await fileSize(objectPath);
  const remoteChecksum = await checksumFile(objectPath);
  if (remoteSize !== sizeBytes || remoteChecksum !== checksum) throw new Error("Uploaded backup failed size/checksum verification.");

  const record = {
    id,
    environment,
    backupType: "POSTGRES_LOGICAL",
    status: "VERIFIED",
    databaseVersion: "postgresql",
    schemaMigrationVersion: migrationVersion,
    applicationVersion: appVersion,
    commitSha,
    startedAt,
    completedAt: new Date().toISOString(),
    objectLocationReference: objectKey.replaceAll("\\", "/"),
    sizeBytes,
    checksumAlgorithm: "sha256",
    checksum,
    encrypted: process.env.BACKUP_STORAGE_ENCRYPTED === "true",
    retentionClass: process.env.BACKUP_RETENTION_CLASS ?? "daily",
    expiresAt: null,
    verificationStatus: "CHECKSUM_VERIFIED",
    lastVerifiedAt: new Date().toISOString(),
    restoreTestStatus: "NOT_TESTED",
    safeErrorCode: null,
    createdAt: startedAt,
  };
  await appendCatalogRecord(catalogPath, record);
  console.log(JSON.stringify({ ok: true, id, objectLocationReference: record.objectLocationReference, sizeBytes }));
} catch (error) {
  const record = {
    id,
    environment,
    backupType: "POSTGRES_LOGICAL",
    status: "FAILED",
    startedAt,
    completedAt: new Date().toISOString(),
    safeErrorCode: error instanceof Error ? error.message.slice(0, 160) : "BACKUP_FAILED",
    createdAt: startedAt,
  };
  await appendCatalogRecord(catalogPath, record);
  console.error(JSON.stringify({ ok: false, id, error: record.safeErrorCode }));
  process.exitCode = 1;
} finally {
  await safeCleanup(workDir);
}
