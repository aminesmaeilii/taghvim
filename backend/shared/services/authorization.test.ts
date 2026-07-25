import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DATA_SCOPES, ROLES, effectivePermissions, hasPermission, requirePermission } from "./authorization.js";
import type { SafeUser } from "../types/auth.js";

const user = (patch: Partial<SafeUser>): SafeUser => ({
  id: "u1",
  username: "u1",
  email: "u1@example.com",
  firstName: "Test",
  lastName: "User",
  role: "USER",
  extraPermissions: [],
  dataScope: "OWN",
  status: "ACTIVE",
  mustChangePassword: false,
  failedLoginCount: 0,
  lastLoginAt: null,
  lastActivityAt: null,
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
  permissions: [],
  ...patch,
});

describe("central authorization catalog", () => {
  it("keeps role permissions centralized and unique", () => {
    expect(ALL_PERMISSIONS.length).toBe(new Set(ALL_PERMISSIONS).size);
    expect(DATA_SCOPES).toContain("OWN");
    expect(effectivePermissions(user({ role: "SUPER_ADMIN" }))).toEqual(expect.arrayContaining(ALL_PERMISSIONS));
  });

  it("combines role permissions and extra permissions without duplicates", () => {
    const permissions = effectivePermissions(user({ role: "USER", extraPermissions: ["reports.export", "reports.view"] }));
    expect(permissions).toContain("dashboard.view");
    expect(permissions).toContain("reports.export");
    expect(permissions.filter((item) => item === "reports.view")).toHaveLength(1);
  });

  it("uses permission checks instead of role-name checks", () => {
    const manager = user({ role: "MANAGER", permissions: effectivePermissions(user({ role: "MANAGER" })) });
    const viewer = user({ role: "VIEWER", permissions: effectivePermissions(user({ role: "VIEWER" })) });
    expect(hasPermission(manager, "reports.export")).toBe(true);
    expect(hasPermission(viewer, "reports.export")).toBe(false);
    expect(() => requirePermission(viewer, "settings.update")).toThrow("اجازه انجام این عملیات را ندارید.");
  });

  it("has no role permission outside the shared permission catalog", () => {
    const catalog = new Set(ALL_PERMISSIONS);
    for (const role of ROLES) {
      expect(role.permissions.every((permission) => catalog.has(permission))).toBe(true);
    }
  });
});
