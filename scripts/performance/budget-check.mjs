#!/usr/bin/env node
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const dist = process.env.PERF_FRONTEND_DIST ?? "frontend/dist";
const budgets = {
  jsChunkBytes: Number(process.env.PERF_MAX_JS_CHUNK_BYTES ?? 900_000),
  workerChunkBytes: Number(process.env.PERF_MAX_WORKER_CHUNK_BYTES ?? 1_400_000),
  cssChunkBytes: Number(process.env.PERF_MAX_CSS_CHUNK_BYTES ?? 140_000),
  totalAssetBytes: Number(process.env.PERF_MAX_TOTAL_ASSET_BYTES ?? 3_800_000),
};

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const files = await walk(dist);
const sizes = await Promise.all(files.map(async (file) => ({ file, size: (await stat(file)).size })));
const workerChunks = sizes.filter((item) => /worker/i.test(item.file) && (item.file.endsWith(".js") || item.file.endsWith(".mjs")));
const jsChunks = sizes.filter((item) => !workerChunks.includes(item) && (item.file.endsWith(".js") || item.file.endsWith(".mjs")));
const cssChunks = sizes.filter((item) => item.file.endsWith(".css"));
const total = sizes.reduce((sum, item) => sum + item.size, 0);
const failures = [
  ...jsChunks.filter((item) => item.size > budgets.jsChunkBytes).map((item) => `${item.file} exceeds JS budget (${item.size} > ${budgets.jsChunkBytes})`),
  ...workerChunks.filter((item) => item.size > budgets.workerChunkBytes).map((item) => `${item.file} exceeds worker budget (${item.size} > ${budgets.workerChunkBytes})`),
  ...cssChunks.filter((item) => item.size > budgets.cssChunkBytes).map((item) => `${item.file} exceeds CSS budget (${item.size} > ${budgets.cssChunkBytes})`),
  total > budgets.totalAssetBytes ? `dist assets exceed total budget (${total} > ${budgets.totalAssetBytes})` : null,
].filter(Boolean);
console.log(JSON.stringify({ ok: failures.length === 0, budgets, totalAssetBytes: total, largestJsBytes: Math.max(...jsChunks.map((item) => item.size), 0), largestWorkerBytes: Math.max(...workerChunks.map((item) => item.size), 0), largestCssBytes: Math.max(...cssChunks.map((item) => item.size), 0), failures }, null, 2));
if (failures.length) process.exitCode = 1;
