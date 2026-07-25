import type { DataScope, Permission, Role, SafeUser } from "../types/auth.js";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view", "users.view", "users.create", "users.update", "users.disable", "users.delete", "users.restore", "users.assign_role", "users.assign_permission", "users.reset_password", "users.view_activity",
  "roles.view", "roles.create", "roles.update", "roles.delete", "roles.assign_permissions", "settings.view", "settings.update",
  "profile.view_own", "profile.update_own", "profile.change_password", "reports.view", "reports.export", "audit_logs.view", "security_sessions.view_own", "security_sessions.revoke_own", "security_sessions.manage_all",
  "technical_health.read", "technical_logs.read", "technical_alerts.manage", "technical_jobs.retry",
  "backup.status.read", "backup.create", "backup.verify", "backup.restore_test", "backup.restore_production", "backup.retention.manage", "backup.delete",
];

export const ROLES: Role[] = [
  { key: "SUPER_ADMIN", label: "مدیر کل", permissions: ALL_PERMISSIONS },
  { key: "ADMIN", label: "مدیر", permissions: ALL_PERMISSIONS.filter((item) => item !== "roles.delete") },
  { key: "MANAGER", label: "مدیر تیم", permissions: ["dashboard.view", "users.view", "profile.view_own", "profile.update_own", "profile.change_password", "reports.view", "reports.export", "security_sessions.view_own", "security_sessions.revoke_own"] },
  { key: "USER", label: "کاربر", permissions: ["dashboard.view", "profile.view_own", "profile.update_own", "profile.change_password", "reports.view", "security_sessions.view_own", "security_sessions.revoke_own"] },
  { key: "VIEWER", label: "مشاهده گر", permissions: ["dashboard.view", "profile.view_own", "reports.view", "security_sessions.view_own"] },
];

export const DATA_SCOPES: DataScope[] = ["ALL", "ORGANIZATION", "DEPARTMENT", "TEAM", "ASSIGNED", "OWN", "NONE"];

export function permissionsForRole(roleKey: Role["key"]): Permission[] {
  return ROLES.find((role) => role.key === roleKey)?.permissions ?? [];
}

export function effectivePermissions(user: Pick<SafeUser, "role" | "extraPermissions">): Permission[] {
  return [...new Set([...permissionsForRole(user.role), ...user.extraPermissions])];
}

export function hasPermission(user: Pick<SafeUser, "permissions"> | null | undefined, permission: Permission): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function requirePermission(user: Pick<SafeUser, "permissions"> | null | undefined, permission: Permission, message = "اجازه انجام این عملیات را ندارید."): void {
  if (!hasPermission(user, permission)) throw new Error(message);
}
