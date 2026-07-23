#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readCatalog, requireSafeEnvironment, writeJsonAtomic } from "./lib.mjs";

const environment = requireSafeEnvironment();
const dryRun = process.env.BACKUP_RETENTION_DRY_RUN !== "false";
const storageDir = process.env.BACKUP_STORAGE_DIR;
const catalogPath = process.env.BACKUP_CATALOG_PATH ?? join(process.cwd(), ".backup-catalog", `${environment}.json`);
if (!storageDir) throw new Error("BACKUP_STORAGE_DIR is required.");
const catalog = await readCatalog(catalogPath);
const backups = (catalog.backups ?? []).filter((item) => item.environment === environment);
const valid = backups.filter((item) => ["VERIFIED", "COMPLETED"].includes(item.status));
const newestValid = valid.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))[0]?.id;
const onlyRestoreTested = valid.filter((item) => item.restoreTestStatus === "PASSED").length === 1 ? valid.find((item) => item.restoreTestStatus === "PASSED")?.id : null;
const now = Date.now();
const deleteCandidates = backups.filter((item) => {
  if (!item.expiresAt || Date.parse(item.expiresAt) > now) return false;
  if (item.id === newestValid || item.id === onlyRestoreTested) return false;
  if (String(item.retentionClass ?? "").startsWith("pre-migration")) return false;
  return true;
});
const root = resolve(storageDir);
for (const item of deleteCandidates) {
  const target = resolve(storageDir, item.objectLocationReference);
  if (!target.startsWith(root) || !item.objectLocationReference.startsWith(`backups/${environment}/`)) throw new Error(`Invalid retention target: ${item.objectLocationReference}`);
  if (!dryRun) await rm(target, { force: true });
  item.status = dryRun ? item.status : "DELETED";
}
if (!dryRun) await writeJsonAtomic(catalogPath, { ...catalog, backups });
console.log(JSON.stringify({ ok: true, dryRun, candidates: deleteCandidates.map((item) => item.id) }));
