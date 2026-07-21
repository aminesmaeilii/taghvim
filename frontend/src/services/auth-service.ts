import type { AccountStatus, AuditLog, AuthSession, AuthUser, CreateUserInput, DataScope, LoginResult, Permission, Role, SafeUser } from "@shared/types/auth";

const DB_NAME = "zambil-auth-v2";
const DB_VERSION = 1;
const SESSION_KEY = "zambil.auth.session";
const SESSION_HOURS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view", "users.view", "users.create", "users.update", "users.disable", "users.delete", "users.restore", "users.assign_role", "users.assign_permission", "users.reset_password", "users.view_activity",
  "roles.view", "roles.create", "roles.update", "roles.delete", "roles.assign_permissions", "settings.view", "settings.update",
  "profile.view_own", "profile.update_own", "profile.change_password", "reports.view", "reports.export", "audit_logs.view", "security_sessions.view_own", "security_sessions.revoke_own", "security_sessions.manage_all",
];

export const ROLES: Role[] = [
  { key: "SUPER_ADMIN", label: "مدیر کل", permissions: ALL_PERMISSIONS },
  { key: "ADMIN", label: "مدیر", permissions: ALL_PERMISSIONS.filter((item) => item !== "roles.delete") },
  { key: "MANAGER", label: "مدیر تیم", permissions: ["dashboard.view", "users.view", "profile.view_own", "profile.update_own", "profile.change_password", "reports.view", "reports.export", "security_sessions.view_own", "security_sessions.revoke_own"] },
  { key: "USER", label: "کاربر", permissions: ["dashboard.view", "profile.view_own", "profile.update_own", "profile.change_password", "reports.view", "security_sessions.view_own", "security_sessions.revoke_own"] },
  { key: "VIEWER", label: "مشاهده گر", permissions: ["dashboard.view", "profile.view_own", "reports.view", "security_sessions.view_own"] },
];

function now(): string { return new Date().toISOString(); }
function addHours(hours: number): string { const date = new Date(); date.setHours(date.getHours() + hours); return date.toISOString(); }
function addMinutes(minutes: number): string { const date = new Date(); date.setMinutes(date.getMinutes() + minutes); return date.toISOString(); }
function bytesToBase64(bytes: ArrayBuffer): string { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
async function sha256(value: string): Promise<string> { return bytesToBase64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }

async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" }, key, 256);
  return { hash: bytesToBase64(bits), salt: bytesToBase64(salt) };
}

async function verifyPassword(password: string, user: AuthUser): Promise<boolean> {
  const result = await hashPassword(password, base64ToBytes(user.passwordSalt));
  return result.hash === user.passwordHash;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("users")) {
        const users = db.createObjectStore("users", { keyPath: "id" });
        users.createIndex("username", "username", { unique: true });
        users.createIndex("email", "email", { unique: true });
      }
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" }).createIndex("userId", "userId");
      if (!db.objectStoreNames.contains("auditLogs")) db.createObjectStore("auditLogs", { keyPath: "id" }).createIndex("createdAt", "createdAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("پایگاه داده احراز هویت باز نشد."));
  });
}

async function storeGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function storePut<T>(storeName: string, value: T): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

async function addAudit(entry: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
  await storePut("auditLogs", { ...entry, id: crypto.randomUUID(), createdAt: now() } satisfies AuditLog);
}

function permissionsFor(user: AuthUser): Permission[] {
  return [...new Set([...(ROLES.find((role) => role.key === user.role)?.permissions ?? []), ...user.extraPermissions])];
}

function toSafeUser(user: AuthUser): SafeUser {
  const { passwordHash, passwordSalt, ...safe } = user;
  void passwordHash; void passwordSalt;
  return { ...safe, permissions: permissionsFor(user) };
}

function validatePassword(password: string, user?: Pick<AuthUser, "username" | "email">): string | null {
  if (password.length < 12) return "رمز عبور باید حداقل ۱۲ کاراکتر باشد.";
  const lower = password.toLowerCase();
  if (["password", "123456", "qwerty", "admin"].some((item) => lower.includes(item))) return "رمز عبور بسیار رایج یا قابل حدس است.";
  if (user && (lower.includes(user.username.toLowerCase()) || lower.includes(user.email.toLowerCase()))) return "رمز عبور نباید شامل نام کاربری یا ایمیل باشد.";
  return null;
}

async function ensureBootstrapAdmin(): Promise<void> {
  const users = await storeGetAll<AuthUser>("users");
  if (users.some((user) => user.role === "SUPER_ADMIN" && user.status !== "DELETED")) return;
  const password = "Taghvim!2026#Root";
  const { hash, salt } = await hashPassword(password);
  const admin: AuthUser = {
    id: crypto.randomUUID(), username: "taghvim-root", email: "root@taghvim.app", firstName: "مدیر", lastName: "سیستم",
    phone: null, avatarUrl: null, jobTitle: "Super Admin", department: "مدیریت", team: "هسته", role: "SUPER_ADMIN", extraPermissions: [],
    dataScope: "ALL", status: "ACTIVE", mustChangePassword: true, passwordHash: hash, passwordSalt: salt, passwordUpdatedAt: null,
    failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, lastActivityAt: null, createdAt: now(), updatedAt: now(), deletedAt: null, adminNotes: "Bootstrap account",
  };
  await storePut("users", admin);
  await addAudit({ actorUserId: null, targetUserId: admin.id, action: "auth.bootstrap_super_admin", result: "success", metadata: { username: "taghvim-root" } });
}

export const authService = {
  async bootstrap(): Promise<SafeUser | null> {
    await ensureBootstrapAdmin();
    return this.currentUser();
  },
  async login(identifier: string, password: string, remember: boolean): Promise<LoginResult> {
    await ensureBootstrapAdmin();
    const users = await storeGetAll<AuthUser>("users");
    const normalized = identifier.trim().toLowerCase();
    const user = users.find((item) => item.username.toLowerCase() === normalized || item.email.toLowerCase() === normalized);
    const generic = "نام کاربری یا رمز عبور صحیح نیست.";
    if (!user) { await addAudit({ action: "auth.login", result: "failure", metadata: { reason: "invalid_credentials" } }); throw new Error(generic); }
    if (user.status !== "ACTIVE" && user.status !== "PENDING") { await addAudit({ actorUserId: user.id, action: "auth.login", result: "failure", metadata: { reason: user.status } }); throw new Error(generic); }
    if (user.lockedUntil && user.lockedUntil > now()) throw new Error("حساب موقتاً قفل شده است. کمی بعد دوباره تلاش کنید.");
    if (!(await verifyPassword(password, user))) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil = failedLoginCount >= MAX_FAILED_LOGINS ? addMinutes(LOCK_MINUTES) : null;
      await storePut("users", { ...user, failedLoginCount, lockedUntil, updatedAt: now() });
      await addAudit({ actorUserId: user.id, action: "auth.login", result: "failure", metadata: { reason: "invalid_credentials" } });
      throw new Error(generic);
    }
    const token = crypto.randomUUID() + crypto.randomUUID();
    const session: AuthSession = { id: crypto.randomUUID(), userId: user.id, tokenHash: await sha256(token), createdAt: now(), expiresAt: remember ? addHours(24 * 14) : addHours(SESSION_HOURS), lastActivityAt: now(), revokedAt: null, userAgent: navigator.userAgent, ipAddress: null, current: true };
    await storePut("sessions", session);
    const updated = { ...user, failedLoginCount: 0, lockedUntil: null, lastLoginAt: now(), lastActivityAt: now(), updatedAt: now() };
    await storePut("users", updated);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: session.id, token }));
    await addAudit({ actorUserId: user.id, action: "auth.login", result: "success", metadata: { remember } });
    return { user: toSafeUser(updated), session, mustChangePassword: updated.mustChangePassword };
  },
  async currentUser(): Promise<SafeUser | null> {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; token: string };
    const sessions = await storeGetAll<AuthSession>("sessions");
    const session = sessions.find((item) => item.id === parsed.id);
    if (!session || session.revokedAt || session.expiresAt <= now() || session.tokenHash !== await sha256(parsed.token)) { sessionStorage.removeItem(SESSION_KEY); return null; }
    const user = (await storeGetAll<AuthUser>("users")).find((item) => item.id === session.userId);
    if (!user || user.status !== "ACTIVE" || user.deletedAt) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return toSafeUser(user);
  },
  async logout(): Promise<void> {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string };
      const sessions = await storeGetAll<AuthSession>("sessions");
      const session = sessions.find((item) => item.id === parsed.id);
      if (session) await storePut("sessions", { ...session, revokedAt: now(), lastActivityAt: now() });
      await addAudit({ actorUserId: session?.userId ?? null, action: "auth.logout", result: "success" });
    }
    sessionStorage.removeItem(SESSION_KEY);
  },
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.requireUser();
    const users = await storeGetAll<AuthUser>("users");
    const full = users.find((item) => item.id === user.id);
    if (!full || !(await verifyPassword(currentPassword, full))) throw new Error("رمز عبور فعلی صحیح نیست.");
    const validation = validatePassword(newPassword, full);
    if (validation) throw new Error(validation);
    if (await verifyPassword(newPassword, full)) throw new Error("رمز جدید نباید با رمز فعلی یکسان باشد.");
    const { hash, salt } = await hashPassword(newPassword);
    await storePut("users", { ...full, passwordHash: hash, passwordSalt: salt, mustChangePassword: false, passwordUpdatedAt: now(), updatedAt: now() });
    await this.revokeOtherSessions(full.id);
    await addAudit({ actorUserId: full.id, targetUserId: full.id, action: "profile.change_password", result: "success" });
  },
  async listUsers(): Promise<SafeUser[]> {
    await this.requirePermission("users.view");
    return (await storeGetAll<AuthUser>("users")).filter((item) => item.status !== "DELETED").map(toSafeUser).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async createUser(input: CreateUserInput): Promise<SafeUser> {
    const actor = await this.requirePermission("users.create");
    const validation = validatePassword(input.temporaryPassword, input);
    if (validation) throw new Error(validation);
    const users = await storeGetAll<AuthUser>("users");
    if (users.some((user) => user.username.toLowerCase() === input.username.toLowerCase())) throw new Error("نام کاربری تکراری است.");
    if (users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) throw new Error("ایمیل تکراری است.");
    const { hash, salt } = await hashPassword(input.temporaryPassword);
    const user: AuthUser = { ...input, id: crypto.randomUUID(), phone: input.phone ?? null, avatarUrl: null, jobTitle: input.jobTitle ?? null, department: input.department ?? null, team: input.team ?? null, passwordHash: hash, passwordSalt: salt, passwordUpdatedAt: null, failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, lastActivityAt: null, createdAt: now(), updatedAt: now(), deletedAt: null, adminNotes: input.adminNotes ?? null };
    await storePut("users", user);
    await addAudit({ actorUserId: actor.id, targetUserId: user.id, action: "users.create", result: "success", metadata: { role: user.role } });
    return toSafeUser(user);
  },
  async updateUser(id: string, patch: Partial<Pick<AuthUser, "firstName" | "lastName" | "phone" | "jobTitle" | "department" | "team" | "role" | "extraPermissions" | "dataScope" | "status" | "adminNotes" | "mustChangePassword">>): Promise<SafeUser> {
    const actor = await this.requirePermission("users.update");
    const users = await storeGetAll<AuthUser>("users");
    const target = users.find((item) => item.id === id);
    if (!target) throw new Error("کاربر پیدا نشد.");
    if (target.role === "SUPER_ADMIN" && patch.status && patch.status !== "ACTIVE") {
      const activeSuperAdmins = users.filter((item) => item.role === "SUPER_ADMIN" && item.status === "ACTIVE" && item.id !== id);
      if (activeSuperAdmins.length === 0) throw new Error("آخرین مدیر کل فعال قابل غیرفعال سازی نیست.");
    }
    const updated = { ...target, ...patch, updatedAt: now() };
    await storePut("users", updated);
    await addAudit({ actorUserId: actor.id, targetUserId: id, action: "users.update", result: "success" });
    return toSafeUser(updated);
  },
  async softDeleteUser(id: string): Promise<void> {
    await this.updateUser(id, { status: "DELETED" as AccountStatus });
    const users = await storeGetAll<AuthUser>("users");
    const target = users.find((item) => item.id === id);
    if (target) await storePut("users", { ...target, deletedAt: now(), updatedAt: now() });
    await this.revokeAllSessions(id);
  },
  async updateOwnProfile(patch: Pick<AuthUser, "firstName" | "lastName" | "phone">): Promise<SafeUser> {
    const current = await this.requirePermission("profile.update_own");
    const users = await storeGetAll<AuthUser>("users");
    const full = users.find((item) => item.id === current.id);
    if (!full) throw new Error("کاربر پیدا نشد.");
    const updated = { ...full, ...patch, updatedAt: now() };
    await storePut("users", updated);
    await addAudit({ actorUserId: current.id, targetUserId: current.id, action: "profile.update_own", result: "success" });
    return toSafeUser(updated);
  },
  async sessions(): Promise<AuthSession[]> {
    const user = await this.requirePermission("security_sessions.view_own");
    const raw = sessionStorage.getItem(SESSION_KEY);
    const currentId = raw ? (JSON.parse(raw) as { id: string }).id : "";
    return (await storeGetAll<AuthSession>("sessions")).filter((item) => item.userId === user.id && !item.revokedAt).map((item) => ({ ...item, current: item.id === currentId }));
  },
  async revokeSession(id: string): Promise<void> {
    const user = await this.requirePermission("security_sessions.revoke_own");
    const sessions = await storeGetAll<AuthSession>("sessions");
    const session = sessions.find((item) => item.id === id && item.userId === user.id);
    if (!session) return;
    await storePut("sessions", { ...session, revokedAt: now() });
    await addAudit({ actorUserId: user.id, action: "security_sessions.revoke_own", result: "success" });
  },
  async auditLogs(): Promise<AuditLog[]> {
    await this.requirePermission("audit_logs.view");
    return (await storeGetAll<AuditLog>("auditLogs")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  },
  async revokeAllSessions(userId: string): Promise<void> {
    const sessions = await storeGetAll<AuthSession>("sessions");
    await Promise.all(sessions.filter((item) => item.userId === userId && !item.revokedAt).map((item) => storePut("sessions", { ...item, revokedAt: now() })));
  },
  async revokeOtherSessions(userId: string): Promise<void> {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const currentId = raw ? (JSON.parse(raw) as { id: string }).id : "";
    const sessions = await storeGetAll<AuthSession>("sessions");
    await Promise.all(sessions.filter((item) => item.userId === userId && item.id !== currentId && !item.revokedAt).map((item) => storePut("sessions", { ...item, revokedAt: now() })));
  },
  async requireUser(): Promise<SafeUser> {
    const user = await this.currentUser();
    if (!user) throw new Error("ابتدا وارد شوید.");
    return user;
  },
  async requirePermission(permission: Permission): Promise<SafeUser> {
    const user = await this.requireUser();
    if (!user.permissions.includes(permission)) throw new Error("شما به این بخش دسترسی ندارید.");
    return user;
  },
  hasPermission(user: SafeUser | null, permission: Permission): boolean {
    return Boolean(user?.permissions.includes(permission));
  },
  roles(): Role[] { return ROLES; },
  dataScopes(): DataScope[] { return ["ALL", "ORGANIZATION", "DEPARTMENT", "TEAM", "ASSIGNED", "OWN", "NONE"]; },
};
