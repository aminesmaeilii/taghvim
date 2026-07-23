import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MemoryRepository, type ContentRepository } from "../../../shared/services/workspace-memory-repository.js";

type VercelRequest = {
  method?: string;
  headers: { origin?: string };
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
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const body = req.body as RpcBody;
    const method = body.method;
    if (!method) return res.status(400).json({ error: "Missing method." });

    const repository = new MemoryRepository();
    await loadSnapshot(repository);

    const fn = repository[method];
    if (typeof fn !== "function") return res.status(400).json({ error: "Unknown method." });

    const data = await (fn as (...args: unknown[]) => Promise<unknown>).apply(repository, body.args ?? []);
    if (MUTATIONS.has(method)) await saveSnapshot(repository);

    return res.status(200).json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    return res.status(500).json({ error: message });
  }
}
