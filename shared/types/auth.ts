export type AccountStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "LOCKED" | "SUSPENDED" | "DELETED";
export type RoleKey = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER" | "VIEWER";
export type DataScope = "ALL" | "ORGANIZATION" | "DEPARTMENT" | "TEAM" | "ASSIGNED" | "OWN" | "NONE";

export type Permission =
  | "dashboard.view"
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.disable"
  | "users.delete"
  | "users.restore"
  | "users.assign_role"
  | "users.assign_permission"
  | "users.reset_password"
  | "users.view_activity"
  | "roles.view"
  | "roles.create"
  | "roles.update"
  | "roles.delete"
  | "roles.assign_permissions"
  | "settings.view"
  | "settings.update"
  | "profile.view_own"
  | "profile.update_own"
  | "profile.change_password"
  | "reports.view"
  | "reports.export"
  | "audit_logs.view"
  | "security_sessions.view_own"
  | "security_sessions.revoke_own"
  | "security_sessions.manage_all"
  | "technical_health.read"
  | "technical_logs.read"
  | "technical_alerts.manage"
  | "technical_jobs.retry"
  | "backup.status.read"
  | "backup.create"
  | "backup.verify"
  | "backup.restore_test"
  | "backup.restore_production"
  | "backup.retention.manage"
  | "backup.delete";

export interface Role {
  key: RoleKey;
  label: string;
  permissions: Permission[];
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  team?: string | null;
  role: RoleKey;
  extraPermissions: Permission[];
  dataScope: DataScope;
  status: AccountStatus;
  mustChangePassword: boolean;
  passwordHash: string;
  passwordSalt: string;
  passwordUpdatedAt?: string | null;
  failedLoginCount: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  lastActivityAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  adminNotes?: string | null;
}

export interface SafeUser extends Omit<AuthUser, "passwordHash" | "passwordSalt"> {
  permissions: Permission[];
}

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  revokedAt?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  current?: boolean;
}

export interface AuditLog {
  id: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  result: "success" | "failure";
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface LoginResult {
  user: SafeUser;
  session: AuthSession;
  mustChangePassword: boolean;
}

export interface CreateUserInput {
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  team?: string;
  role: RoleKey;
  extraPermissions: Permission[];
  dataScope: DataScope;
  status: AccountStatus;
  temporaryPassword: string;
  mustChangePassword: boolean;
  adminNotes?: string;
}
