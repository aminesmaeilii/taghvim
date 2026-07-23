import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checksumFile, refuseProductionRestore, safeCleanup } from "./lib.mjs";

test("refuses production-looking restore targets", () => {
  assert.throws(() => refuseProductionRestore("postgres://user:pass@db.production.internal/app"), /Refusing/);
});

test("allows production restore only with explicit reviewed override", () => {
  assert.doesNotThrow(() => refuseProductionRestore("postgres://db.production/app", true));
});

test("calculates checksums and restricts cleanup to backup temp root", async () => {
  const root = join(process.cwd(), ".tmp", "backups", `test-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const file = join(root, "sample.txt");
  await writeFile(file, "taghvim", "utf8");
  assert.equal(await checksumFile(file), "9f5a9bbe24c908804d7bd5868695f5cbbf8ed486144c33a464c1a5ebb9271408");
  await safeCleanup(root);
  await assert.rejects(() => safeCleanup(process.cwd()), /Refusing cleanup/);
});
