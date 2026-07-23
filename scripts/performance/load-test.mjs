#!/usr/bin/env node
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const profile = process.env.PERF_PROFILE ?? "smoke";
const testRunId = process.env.PERF_TEST_RUN_ID ?? `perf_${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}`;
const maxRps = Number(process.env.PERF_MAX_RPS ?? 20);
const profiles = {
  smoke: { users: 2, iterations: 8, concurrency: 2 },
  baseline: { users: 5, iterations: 25, concurrency: 4 },
  expected: { users: 15, iterations: 60, concurrency: 8 },
  peak: { users: 30, iterations: 120, concurrency: 12 },
};
const config = profiles[profile] ?? profiles.smoke;
const results = [];

async function rpc(method, args = []) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/workspace`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-correlation-id": testRunId },
    body: JSON.stringify({ method, args }),
  });
  const text = await response.text();
  const durationMs = performance.now() - started;
  results.push({ method, status: response.status, durationMs, bytes: Buffer.byteLength(text) });
  if (!response.ok) throw new Error(`${method} failed with ${response.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text).data;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function seed() {
  await rpc("bootstrap");
  for (let i = 0; i < config.users; i += 1) {
    await rpc("saveProfile", [{ userId: `perf-user-${i}`, displayName: `Perf User ${i}`, avatarUrl: null, role: i % 5 === 0 ? "manager" : "member", team: `Team ${i % 3}`, updatedAt: new Date().toISOString() }]);
  }
  await rpc("createDirectChat", ["perf-user-0", "perf-user-1"]);
}

async function journey(index) {
  const userId = `perf-user-${index % config.users}`;
  await rpc("dashboard");
  await rpc("listContents", [{ search: "", archived: false }]);
  await rpc("reportSnapshot", [{ range: "30d" }, { id: userId, role: "USER", team: `Team ${index % 3}`, dataScope: "OWN", permissions: ["reports.view"] }, 1, 25]);
  await rpc("monitoringOverview");
  await rpc("listNotifications", [userId, null, 20]);
  const conversations = await rpc("listChatConversations", [userId]).catch(() => []);
  if (conversations[0]?.conversation?.id) {
    await rpc("listChatMessages", [userId, conversations[0].conversation.id, null, 20]);
    if (index % 5 === 0) await rpc("sendChatMessage", [userId, conversations[0].conversation.id, `perf message ${testRunId} ${index}`, `${testRunId}-${index}`]);
  }
}

async function runPool() {
  let next = 0;
  async function worker() {
    while (next < config.iterations) {
      const index = next;
      next += 1;
      await journey(index);
      if (maxRps > 0) await new Promise((resolve) => setTimeout(resolve, Math.ceil(1000 / maxRps)));
    }
  }
  await Promise.all(Array.from({ length: config.concurrency }, () => worker()));
}

const startedAt = new Date().toISOString();
const wallStart = performance.now();
await seed();
await runPool();
const durationSeconds = (performance.now() - wallStart) / 1000;
const durations = results.map((item) => item.durationMs);
const errors = results.filter((item) => item.status >= 500).length;
const byMethod = Object.fromEntries([...new Set(results.map((item) => item.method))].map((method) => {
  const items = results.filter((item) => item.method === method);
  return [method, {
    count: items.length,
    p50Ms: Math.round(percentile(items.map((item) => item.durationMs), 50)),
    p95Ms: Math.round(percentile(items.map((item) => item.durationMs), 95)),
    maxBytes: Math.max(...items.map((item) => item.bytes)),
  }];
}));
const summary = {
  testRunId,
  profile,
  startedAt,
  completedAt: new Date().toISOString(),
  durationSeconds: Number(durationSeconds.toFixed(2)),
  requests: results.length,
  rps: Number((results.length / durationSeconds).toFixed(2)),
  errorRate: Number((errors / Math.max(1, results.length)).toFixed(4)),
  p50Ms: Math.round(percentile(durations, 50)),
  p95Ms: Math.round(percentile(durations, 95)),
  p99Ms: Math.round(percentile(durations, 99)),
  byMethod,
};
console.log(JSON.stringify(summary, null, 2));
