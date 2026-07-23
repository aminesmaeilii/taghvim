#!/usr/bin/env node
import { join } from "node:path";
import { appendCatalogRecord, readCatalog, refuseProductionRestore, requireSafeEnvironment, runCommand } from "./lib.mjs";

const environment = requireSafeEnvironment(process.env.BACKUP_ENVIRONMENT ?? "restore-test");
const storageDir = process.env.BACKUP_STORAGE_DIR;
const restoreDatabaseUrl = process.env.RESTORE_TEST_DATABASE_URL;
const catalogPath = process.env.BACKUP_CATALOG_PATH ?? join(process.cwd(), ".backup-catalog", `${environment}.json`);
const backupId = process.argv[2];

if (environment !== "restore-test" && process.env.ALLOW_NON_TEST_RESTORE !== "reviewed") throw new Error("Restore tests must run with BACKUP_ENVIRONMENT=restore-test.");
if (!storageDir) throw new Error("BACKUP_STORAGE_DIR is required.");
if (!restoreDatabaseUrl) throw new Error("RESTORE_TEST_DATABASE_URL is required.");
refuseProductionRestore(restoreDatabaseUrl);

const catalog = await readCatalog(catalogPath);
const record = (catalog.backups ?? []).find((item) => item.id === backupId) ?? (catalog.backups ?? []).find((item) => item.status === "VERIFIED");
if (!record) throw new Error("No verified backup record found for restore test.");
const objectPath = join(storageDir, record.objectLocationReference);
const startedAt = Date.now();
await runCommand(process.env.PG_RESTORE_BIN ?? "pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", restoreDatabaseUrl, objectPath]);
await runCommand(process.env.PSQL_BIN ?? "psql", [restoreDatabaseUrl, "--set", "ON_ERROR_STOP=1", "--file", "backend/scripts/backup/sql/restore-verification.sql"]);
const updated = { ...record, restoreTestStatus: "PASSED", lastRestoreTestAt: new Date().toISOString(), restoreTestDurationSeconds: Math.round((Date.now() - startedAt) / 1000) };
await appendCatalogRecord(catalogPath, updated);
console.log(JSON.stringify({ ok: true, id: record.id, restoreTestDurationSeconds: updated.restoreTestDurationSeconds }));
