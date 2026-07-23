import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MemoryRepository, type ContentRepository } from "../../../shared/services/workspace-memory-repository.js";
import { createLogEntry, normalizeCorrelationId, serializeLog } from "../../../shared/services/observability.js";

type VercelRequest = {
  method?: string;
  headers: { origin?: string; "x-request-id"?: string; "x-correlation-id"?: string };
  body: unknown;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json(body: unknown): void;
    end(): void;
  };
};

type Snapshot = ReturnType<MemoryRepository["snapshot"]>;
type RpcBody = {
  method?: keyof ContentRepository;
  args?: unknown[];
};

const SNAPSHOT_KEY = "taghvim:workspace:v1";
// Fallback persistence for when Upstash Redis isn't configured: without this, every request
// starts from a brand-new in-memory repository and nothing a user saves survives past that
// single HTTP response. A local file at least survives across requests on a persistent
// long-running process (e.g. Render's Node service) — it just won't survive a redeploy/restart.
const SNAPSHOT_FILE = join(process.cwd(), ".data", "workspace-snapshot.json");
let redis: Redis | null = null;
let fileWriteQueue: Promise<void> = Promise.resolve();
const MUTATIONS = new Set<keyof ContentRepository>([
  "saveContent",
  "archiveContent",
  "deleteContent",
  "moveContent",
  "duplicateContent",
  "saveCampaign",
  "saveIdea",
  "saveTemplate",
  "deleteEntity",
  "saveReference",
  "deleteReference",
  "saveSettings",
  "importWorkspace",
  "bootstrap",
  "saveProfile",
  "logActivity",
  "saveLearningMaterial",
  "deleteLearningMaterial",
  "saveHighlight",
  "deleteHighlight",
  "savePersonalNote",
  "deletePersonalNote",
  "saveAdBudget",
  "saveTask",
  "deleteTask",
  "createDirectChat",
  "createGroupChat",
  "sendChatMessage",
  "markChatRead",
  "purgeUserData",
  "markNotificationRead",
  "markAllNotificationsRead",
  "saveReminder",
  "cancelReminder",
  "snoozeReminder",
  "savePushSubscription",
  "revokePushSubscription",
  "processDueReminders",
  "saveMonitoringSource",
  "archiveMonitoringSource",
  "saveMonitoringPlatform",
  "runMonitoringCollection",
]);

function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  const allowed = new Set([
    "https://taghvim.vercel.app",
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(",").map((item) => item.trim()).filter(Boolean) ?? []),
    "http://localhost:1420",
    "http://localhost:5173",
    "http://127.0.0.1:1420",
    "http://127.0.0.1:5173",
  ].filter(Boolean));
  res.setHeader("access-control-allow-origin", origin && allowed.has(origin) ? origin : "https://taghvim.vercel.app");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
}

async function readFileSnapshot(): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(SNAPSHOT_FILE, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

async function writeFileSnapshot(snapshot: Snapshot): Promise<void> {
  // Serialize writes so concurrent requests can't interleave and corrupt the file.
  fileWriteQueue = fileWriteQueue
    .then(async () => {
      await mkdir(join(process.cwd(), ".data"), { recursive: true });
      await writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot), "utf8");
    })
    .catch((error) => {
      console.error("Failed to write local workspace snapshot:", error instanceof Error ? error.message : error);
    });
  await fileWriteQueue;
}

async function loadSnapshot(repository: MemoryRepository): Promise<void> {
  const client = getRedis();
  if (client) {
    const snapshot = await client.get<Snapshot>(SNAPSHOT_KEY);
    if (snapshot) repository.restore(snapshot);
    return;
  }
  const snapshot = await readFileSnapshot();
  if (snapshot) repository.restore(snapshot);
}

async function saveSnapshot(repository: MemoryRepository): Promise<void> {
  const snapshot = repository.snapshot();
  const client = getRedis();
  if (client) {
    await client.set(SNAPSHOT_KEY, snapshot);
    return;
  }
  await writeFileSnapshot(snapshot);
}

function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  redis = Redis.fromEnv();
  return redis;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  const requestId = normalizeCorrelationId(req.headers["x-request-id"] ?? req.headers["x-correlation-id"]);
  res.setHeader("x-request-id", requestId);
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    logRequest("warn", "workspace_method_not_allowed", requestId, req.method, null, 405, started);
    return res.status(405).json({ error: "Method not allowed.", requestId });
  }

  try {
    const body = req.body as RpcBody;
    const method = body.method;
    if (!method) {
      logRequest("warn", "workspace_missing_method", requestId, req.method, null, 400, started);
      return res.status(400).json({ error: "Missing method.", requestId });
    }

    const repository = new MemoryRepository();
    await loadSnapshot(repository);

    const fn = repository[method];
    if (typeof fn !== "function") {
      logRequest("warn", "workspace_unknown_method", requestId, req.method, String(method), 400, started);
      return res.status(400).json({ error: "Unknown method.", requestId });
    }

    const data = await (fn as (...args: unknown[]) => Promise<unknown>).apply(repository, body.args ?? []);
    if (MUTATIONS.has(method)) await saveSnapshot(repository);

    logRequest("info", "workspace_request_completed", requestId, req.method, String(method), 200, started);
    return res.status(200).json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    console.error(serializeLog(createLogEntry({ level: "error", event: "workspace_request_failed", requestId, route: "/api/workspace", method: req.method ?? null, statusCode: 500, durationMs: Date.now() - started, errorCode: "WORKSPACE_REQUEST_FAILED", metadata: { message } })));
    return res.status(500).json({ error: message, requestId });
  }
}

function logRequest(level: "info" | "warn", event: string, requestId: string, method: string | undefined, rpcMethod: string | null, statusCode: number, started: number): void {
  console[level](serializeLog(createLogEntry({ level, event, requestId, route: "/api/workspace", method: method ?? null, statusCode, durationMs: Date.now() - started, metadata: { rpcMethod } })));
}
