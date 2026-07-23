import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile, readFile, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

export const VALID_ENVIRONMENTS = new Set(["staging", "production", "restore-test", "development"]);
export const CATALOG_SCHEMA_VERSION = 1;

export function requireSafeEnvironment(environment = process.env.BACKUP_ENVIRONMENT ?? process.env.NODE_ENV ?? "development") {
  if (!VALID_ENVIRONMENTS.has(environment)) throw new Error(`Unsupported backup environment: ${environment}`);
  return environment;
}

export function refuseProductionRestore(targetUrl, override = process.env.ALLOW_PRODUCTION_RESTORE === "reviewed-production-recovery") {
  const text = String(targetUrl ?? "").toLowerCase();
  const looksProduction = text.includes("prod") || text.includes("production") || text === String(process.env.DATABASE_URL ?? "").toLowerCase();
  if (looksProduction && !override) throw new Error("Refusing to restore into a production-looking database target.");
}

export function backupId(prefix = "backup") {
  return `${prefix}_${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}_${randomUUID().slice(0, 8)}`;
}

export async function checksumFile(path, algorithm = "sha256") {
  const hash = createHash(algorithm);
  await new Promise((resolvePromise, reject) => {
    createReadStream(path).on("data", (chunk) => hash.update(chunk)).on("end", resolvePromise).on("error", reject);
  });
  return hash.digest("hex");
}

export async function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env, ...options });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} failed with exit code ${code}: ${redact(stderr).slice(0, 800)}`));
    });
  });
}

export function redact(message) {
  return String(message).replace(/(postgres(?:ql)?:\/\/)[^\s@]+@/gi, "$1[REDACTED]@").replace(/(token|secret|password)=([^&\s]+)/gi, "$1=[REDACTED]");
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

export async function readCatalog(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { schemaVersion: CATALOG_SCHEMA_VERSION, backups: [] };
  }
}

export async function appendCatalogRecord(catalogPath, record) {
  const catalog = await readCatalog(catalogPath);
  catalog.schemaVersion = CATALOG_SCHEMA_VERSION;
  catalog.backups = [record, ...(catalog.backups ?? []).filter((item) => item.id !== record.id)];
  await writeJsonAtomic(catalogPath, catalog);
  return catalog;
}

export async function safeCleanup(path) {
  if (!path) return;
  const target = resolve(path);
  const tempRoot = resolve(process.env.BACKUP_TEMP_DIR ?? join(process.cwd(), ".tmp", "backups"));
  if (!target.startsWith(tempRoot)) throw new Error(`Refusing cleanup outside backup temp root: ${target}`);
  await rm(target, { recursive: true, force: true });
}

export async function fileSize(path) {
  return (await stat(path)).size;
}
