#!/usr/bin/env node
import { join } from "node:path";
import { appendCatalogRecord, checksumFile, fileSize, readCatalog, requireSafeEnvironment, runCommand } from "./lib.mjs";

const environment = requireSafeEnvironment();
const storageDir = process.env.BACKUP_STORAGE_DIR;
const catalogPath = process.env.BACKUP_CATALOG_PATH ?? join(process.cwd(), ".backup-catalog", `${environment}.json`);
const backupId = process.argv[2];
if (!storageDir) throw new Error("BACKUP_STORAGE_DIR is required.");

const catalog = await readCatalog(catalogPath);
const record = (catalog.backups ?? []).find((item) => item.id === backupId) ?? (catalog.backups ?? []).find((item) => item.status === "VERIFIED" || item.status === "COMPLETED");
if (!record) throw new Error("No backup record found to verify.");
if (record.environment !== environment) throw new Error("Backup environment mismatch.");
const objectPath = join(storageDir, record.objectLocationReference);
const sizeBytes = await fileSize(objectPath);
if (sizeBytes <= 0) throw new Error("Backup object is empty.");
const checksum = await checksumFile(objectPath, record.checksumAlgorithm ?? "sha256");
if (checksum !== record.checksum) throw new Error("Backup checksum mismatch.");
await runCommand(process.env.PG_RESTORE_BIN ?? "pg_restore", ["--list", objectPath]);
const updated = { ...record, status: "VERIFIED", verificationStatus: "ARCHIVE_READABLE", lastVerifiedAt: new Date().toISOString(), safeErrorCode: null };
await appendCatalogRecord(catalogPath, updated);
console.log(JSON.stringify({ ok: true, id: updated.id, verificationStatus: updated.verificationStatus }));
