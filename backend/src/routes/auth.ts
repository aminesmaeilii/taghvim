import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pbkdf2, randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { AccountStatus, AuditLog, AuthSession, AuthUser, CreateUserInput, LoginResult, Permission, SafeUser } from "../../../shared/types/auth.js";
import { ALL_PERMISSIONS, DATA_SCOPES, ROLES, effectivePermissions, hasPermission as userHasPermission } from "../../../shared/services/authorization.js";
import { createLogEntry, normalizeCorrelationId, serializeLog } from "../../../shared/services/observability.js";

type VercelRequest = {
  method?: string;
  headers: { origin?: string; authorization?: string; "user-agent"?: string; "x-request-id"?: string; "x-correlation-id"?: string };
  body: unknown;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void; end(): void };
};

type AuthMethod = "bootstrap" | "login" | "currentUser" | "logout" | "changePassword" | "listUsers" | "createUser" | "updateUser" | "softDeleteUser" | "updateOwnProfile" | "sessions" | "revokeSession" | "auditLogs";
type RpcBody = { method?: AuthMethod; args?: unknown[] };
type AuthSnapshot = { users: AuthUser[]; sessions: AuthSession[]; auditLogs: AuditLog[] };

const AUTH_KEY = "taghvim:auth:v1";
const AUTH_FILE = join(process.cwd(), ".data", "auth-snapshot.json");
const SESSION_HOURS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const pbkdf2Async = promisify(pbkdf2);
let redis: Redis | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function now(): string { return new Date().toISOString(); }
function addHours(hours: number): string { const date = new Date(); date.setHours(date.getHours() + hours); return date.toISOString(); }
function addMinutes(minutes: number): string { const date = new Date(); date.setMinutes(date.getMinutes() + minutes); return date.toISOString(); }
function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  redis = Redis.fromEnv();
  return redis;
}
function sha256(value: string): string { return createHash("sha256").update(value).digest("base64"); }
async function hashPassword(password: string, salt = randomBytes(16)): Promise<{ hash: string; salt: string }> {
  const key = await pbkdf2Async(password, salt, 210_000, 32, "sha256");
  return { hash: key.toString("base64"), salt: salt.toString("base64") };
}
async function verifyPassword(password: string, user: AuthUser): Promise<boolean> {
  const result = await hashPassword(password, Buffer.from(user.passwordSalt, "base64"));
  const expected = Buffer.from(user.passwordHash, "base64");
  const actual = Buffer.from(result.hash, "base64");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function emptySnapshot(): AuthSnapshot { return { users: [], sessions: [], auditLogs: [] }; }
function toSafeUser(user: AuthUser): SafeUser {
  const { passwordHash, passwordSalt, ...safe } = user;
  void passwordHash; void passwordSalt;
  return { ...safe, permissions: effectivePermissions(user) };
}
function validatePassword(password: string, user?: Pick<AuthUser, "username" | "email">): string | null {
  if (password.length < 12) return "رمز عبور باید حداقل ۱۲ کاراکتر باشد.";
  const lower = password.toLowerCase();
  if (["password", "123456", "qwerty", "admin"].some((item) => lower.includes(item))) return "رمز عبور بسیار رایج یا قابل حدس است.";
  if (user && (lower.includes(user.username.toLowerCase()) || (user.email && lower.includes(user.email.toLowerCase())))) return "رمز عبور نباید شامل نام کاربری یا ایمیل باشد.";
  return null;
}
async function loadSnapshot(): Promise<AuthSnapshot> {
  const client = getRedis();
  if (client) return (await client.get<AuthSnapshot>(AUTH_KEY)) ?? emptySnapshot();
  try { return JSON.parse(await readFile(AUTH_FILE, "utf8")) as AuthSnapshot; } catch { return emptySnapshot(); }
}
async function saveSnapshot(snapshot: AuthSnapshot): Promise<void> {
  const client = getRedis();
  if (client) { await client.set(AUTH_KEY, snapshot); return; }
  writeQueue = writeQueue.then(async () => {
    await mkdir(join(process.cwd(), ".data"), { recursive: true });
    await writeFile(AUTH_FILE, JSON.stringify(snapshot), "utf8");
  }).catch((error) => console.error("Failed to write local auth snapshot:", error instanceof Error ? error.message : error));
  await writeQueue;
}
async function addAudit(snapshot: AuthSnapshot, entry: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
  snapshot.auditLogs.push({ ...entry, id: randomUUID(), createdAt: now() });
}
async function ensureBootstrapAdmin(snapshot: AuthSnapshot): Promise<boolean> {
  if (snapshot.users.some((user) => user.role === "SUPER_ADMIN" && user.status !== "DELETED")) return false;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Taghvim!2026#Root";
  const { hash, salt } = await hashPassword(password);
  const admin: AuthUser = {
    id: randomUUID(), username: process.env.BOOTSTRAP_ADMIN_USERNAME || "taghvim-root", email: "root@taghvim.app", firstName: "مدیر", lastName: "سیستم",
    phone: null, avatarUrl: null, jobTitle: "Super Admin", department: "مدیریت", team: "هسته", role: "SUPER_ADMIN", extraPermissions: [],
    dataScope: "ALL", status: "ACTIVE", mustChangePassword: true, passwordHash: hash, passwordSalt: salt, passwordUpdatedAt: null,
    failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, lastActivityAt: null, createdAt: now(), updatedAt: now(), deletedAt: null, adminNotes: "Bootstrap account",
  };
  snapshot.users.push(admin);
  await addAudit(snapshot, { actorUserId: null, targetUserId: admin.id, action: "auth.bootstrap_super_admin", result: "success", metadata: { username: admin.username } });
  return true;
}
function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}
async function currentFullUser(snapshot: AuthSnapshot, req: VercelRequest): Promise<{ user: AuthUser; session: AuthSession } | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const tokenHash = sha256(token);
  const session = snapshot.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt && item.expiresAt > now());
  if (!session) return null;
  const user = snapshot.users.find((item) => item.id === session.userId && item.status === "ACTIVE" && !item.deletedAt);
  return user ? { user, session } : null;
}
async function requireUser(snapshot: AuthSnapshot, req: VercelRequest): Promise<AuthUser> {
  const current = await currentFullUser(snapshot, req);
  if (!current) throw new Error("ابتدا وارد شوید.");
  return current.user;
}
async function requirePermission(snapshot: AuthSnapshot, req: VercelRequest, permission: Permission): Promise<AuthUser> {
  const user = await requireUser(snapshot, req);
  if (!userHasPermission(toSafeUser(user), permission)) throw new Error("شما به این بخش دسترسی ندارید.");
  return user;
}

function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  const allowed = new Set(["https://taghvim.vercel.app", process.env.FRONTEND_URL, ...(process.env.ALLOWED_ORIGINS?.split(",").map((item) => item.trim()).filter(Boolean) ?? []), "http://localhost:1420", "http://localhost:5173", "http://127.0.0.1:1420", "http://127.0.0.1:5173"].filter(Boolean));
  res.setHeader("access-control-allow-origin", origin && allowed.has(origin) ? origin : "https://taghvim.vercel.app");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  const requestId = normalizeCorrelationId(req.headers["x-request-id"] ?? req.headers["x-correlation-id"]);
  res.setHeader("x-request-id", requestId);
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed.", requestId });

  try {
    const body = req.body as RpcBody;
    if (!body.method) return res.status(400).json({ error: "Missing method.", requestId });
    const snapshot = await loadSnapshot();
    const bootstrapped = await ensureBootstrapAdmin(snapshot);
    let changed = bootstrapped;
    const args = body.args ?? [];
    let data: unknown;

    if (body.method === "bootstrap" || body.method === "currentUser") data = (await currentFullUser(snapshot, req))?.user ? toSafeUser((await currentFullUser(snapshot, req))!.user) : null;
    else if (body.method === "login") {
      const [identifier, password, remember] = args as [string, string, boolean];
      const normalized = identifier.trim().toLowerCase();
      const user = snapshot.users.find((item) => item.username.toLowerCase() === normalized || item.email.toLowerCase() === normalized);
      const generic = "نام کاربری یا رمز عبور صحیح نیست.";
      if (!user) { await addAudit(snapshot, { action: "auth.login", result: "failure", metadata: { reason: "invalid_credentials" } }); changed = true; throw new Error(generic); }
      if (user.status !== "ACTIVE" && user.status !== "PENDING") { await addAudit(snapshot, { actorUserId: user.id, action: "auth.login", result: "failure", metadata: { reason: user.status } }); changed = true; throw new Error(generic); }
      if (user.lockedUntil && user.lockedUntil > now()) throw new Error("حساب موقتا قفل شده است. کمی بعد دوباره تلاش کنید.");
      if (!(await verifyPassword(password, user))) {
        user.failedLoginCount += 1;
        user.lockedUntil = user.failedLoginCount >= MAX_FAILED_LOGINS ? addMinutes(LOCK_MINUTES) : null;
        user.updatedAt = now();
        await addAudit(snapshot, { actorUserId: user.id, action: "auth.login", result: "failure", metadata: { reason: "invalid_credentials" } });
        changed = true;
        throw new Error(generic);
      }
      const token = randomUUID() + randomUUID();
      const session: AuthSession = { id: randomUUID(), userId: user.id, tokenHash: sha256(token), createdAt: now(), expiresAt: remember ? addHours(24 * 14) : addHours(SESSION_HOURS), lastActivityAt: now(), revokedAt: null, userAgent: req.headers["user-agent"] ?? null, ipAddress: null, current: true };
      snapshot.sessions.push(session);
      Object.assign(user, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now(), lastActivityAt: now(), updatedAt: now() });
      await addAudit(snapshot, { actorUserId: user.id, action: "auth.login", result: "success", metadata: { remember } });
      changed = true;
      data = { user: toSafeUser(user), session, mustChangePassword: user.mustChangePassword, token } satisfies LoginResult & { token: string };
    } else if (body.method === "logout") {
      const current = await currentFullUser(snapshot, req);
      if (current) { current.session.revokedAt = now(); current.session.lastActivityAt = now(); await addAudit(snapshot, { actorUserId: current.user.id, action: "auth.logout", result: "success" }); changed = true; }
      data = null;
    } else if (body.method === "changePassword") {
      const user = await requireUser(snapshot, req);
      const [currentPassword, newPassword] = args as [string, string];
      if (!(await verifyPassword(currentPassword, user))) throw new Error("رمز عبور فعلی صحیح نیست.");
      const validation = validatePassword(newPassword, user);
      if (validation) throw new Error(validation);
      if (await verifyPassword(newPassword, user)) throw new Error("رمز جدید نباید با رمز فعلی یکسان باشد.");
      const { hash, salt } = await hashPassword(newPassword);
      Object.assign(user, { passwordHash: hash, passwordSalt: salt, mustChangePassword: false, passwordUpdatedAt: now(), updatedAt: now() });
      const tokenHash = bearerToken(req) ? sha256(bearerToken(req)!) : "";
      snapshot.sessions.filter((item) => item.userId === user.id && item.tokenHash !== tokenHash && !item.revokedAt).forEach((item) => { item.revokedAt = now(); });
      await addAudit(snapshot, { actorUserId: user.id, targetUserId: user.id, action: "profile.change_password", result: "success" });
      changed = true; data = null;
    } else if (body.method === "listUsers") data = (await requirePermission(snapshot, req, "users.view"), snapshot.users.filter((item) => item.status !== "DELETED").map(toSafeUser).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    else if (body.method === "createUser") {
      const actor = await requirePermission(snapshot, req, "users.create");
      const input = args[0] as CreateUserInput;
      const normalizedEmail = input.email?.trim().toLowerCase() ?? "";
      const validation = validatePassword(input.temporaryPassword, { username: input.username, email: normalizedEmail });
      if (validation) throw new Error(validation);
      if (snapshot.users.some((user) => user.username.toLowerCase() === input.username.toLowerCase())) throw new Error("نام کاربری تکراری است.");
      if (normalizedEmail && snapshot.users.some((user) => user.email.toLowerCase() === normalizedEmail)) throw new Error("ایمیل تکراری است.");
      const { hash, salt } = await hashPassword(input.temporaryPassword);
      const user: AuthUser = { ...input, email: normalizedEmail || `${input.username.toLowerCase()}@no-email.local`, id: randomUUID(), phone: input.phone ?? null, avatarUrl: null, jobTitle: input.jobTitle ?? null, department: input.department ?? null, team: input.team ?? null, passwordHash: hash, passwordSalt: salt, passwordUpdatedAt: null, failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, lastActivityAt: null, createdAt: now(), updatedAt: now(), deletedAt: null, adminNotes: input.adminNotes ?? null };
      snapshot.users.push(user);
      await addAudit(snapshot, { actorUserId: actor.id, targetUserId: user.id, action: "users.create", result: "success", metadata: { role: user.role } });
      changed = true; data = toSafeUser(user);
    } else if (body.method === "updateUser") {
      const actor = await requirePermission(snapshot, req, "users.update");
      const [id, patch] = args as [string, Partial<AuthUser>];
      const target = snapshot.users.find((item) => item.id === id);
      if (!target) throw new Error("کاربر پیدا نشد.");
      Object.assign(target, patch, { updatedAt: now() });
      await addAudit(snapshot, { actorUserId: actor.id, targetUserId: id, action: "users.update", result: "success" });
      changed = true; data = toSafeUser(target);
    } else if (body.method === "softDeleteUser") {
      await requirePermission(snapshot, req, "users.delete");
      const target = snapshot.users.find((item) => item.id === args[0]);
      if (target) { Object.assign(target, { status: "DELETED" as AccountStatus, deletedAt: now(), updatedAt: now() }); snapshot.sessions.filter((item) => item.userId === target.id && !item.revokedAt).forEach((item) => { item.revokedAt = now(); }); changed = true; }
      data = null;
    } else if (body.method === "updateOwnProfile") {
      const user = await requirePermission(snapshot, req, "profile.update_own");
      Object.assign(user, args[0] as Pick<AuthUser, "firstName" | "lastName" | "phone">, { updatedAt: now() });
      await addAudit(snapshot, { actorUserId: user.id, targetUserId: user.id, action: "profile.update_own", result: "success" });
      changed = true; data = toSafeUser(user);
    } else if (body.method === "sessions") {
      const current = await currentFullUser(snapshot, req);
      if (!current) throw new Error("ابتدا وارد شوید.");
      if (!userHasPermission(toSafeUser(current.user), "security_sessions.view_own")) throw new Error("شما به این بخش دسترسی ندارید.");
      data = snapshot.sessions.filter((item) => item.userId === current.user.id && !item.revokedAt).map((item) => ({ ...item, current: item.id === current.session.id }));
    } else if (body.method === "revokeSession") {
      const user = await requirePermission(snapshot, req, "security_sessions.revoke_own");
      const session = snapshot.sessions.find((item) => item.id === args[0] && item.userId === user.id);
      if (session) { session.revokedAt = now(); await addAudit(snapshot, { actorUserId: user.id, action: "security_sessions.revoke_own", result: "success" }); changed = true; }
      data = null;
    } else if (body.method === "auditLogs") data = (await requirePermission(snapshot, req, "audit_logs.view"), snapshot.auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200));
    else return res.status(400).json({ error: "Unknown method.", requestId });

    if (changed) await saveSnapshot(snapshot);
    console.info(serializeLog(createLogEntry({ level: "info", event: "auth_request_completed", requestId, route: "/api/auth", method: req.method ?? null, statusCode: 200, durationMs: Date.now() - started, metadata: { rpcMethod: body.method } })));
    return res.status(200).json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    console.error(serializeLog(createLogEntry({ level: "error", event: "auth_request_failed", requestId, route: "/api/auth", method: req.method ?? null, statusCode: 500, durationMs: Date.now() - started, errorCode: "AUTH_REQUEST_FAILED", metadata: { message } })));
    return res.status(500).json({ error: message, requestId });
  }
}

export { ALL_PERMISSIONS, DATA_SCOPES, ROLES };
