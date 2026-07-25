import { describe, expect, it } from "vitest";
import { ensureMonitoringDefaults, runMonitoringCollection, validateMonitoringSource } from "./monitoring-service.js";
import type { SafeUser } from "../types/auth.js";
import type { WorkspaceData } from "../types/domain.js";
import { MemoryRepository } from "./workspace-memory-repository.js";

function emptyWorkspace(): WorkspaceData {
  return {
    contents: [], platforms: [], types: [], statuses: [], campaigns: [], tags: [], pillars: [], ideas: [], templates: [],
    userProfiles: [], activityLog: [], learningMaterials: [], highlights: [], personalNotes: [], adBudgets: [], tasks: [],
    chatConversations: [], chatMembers: [], chatMessages: [], reminders: [], pushSubscriptions: [], notifications: [],
    monitoringPlatforms: [], monitoringPlatformCapabilities: [], monitoringSources: [], monitoringSourceCapabilities: [], monitoringSnapshots: [], monitoredContents: [], monitoredContentSnapshots: [], monitoringJobs: [], monitoringDailyAggregates: [], monitoringEvents: [],
  };
}

describe("monitoring service", () => {
  it("seeds editable initial platforms and multiple sources per platform", () => {
    const workspace = emptyWorkspace();
    expect(ensureMonitoringDefaults(workspace)).toBe(true);
    expect(workspace.monitoringPlatforms.map((item) => item.key)).toEqual(expect.arrayContaining(["INSTAGRAM", "EITAA", "BALE", "TELEGRAM", "RUBIKA"]));
    expect(workspace.monitoringSources.filter((item) => item.platformKey === "EITAA")).toHaveLength(2);
  });

  it("rejects unsafe or unregistered domains", () => {
    const workspace = emptyWorkspace();
    ensureMonitoringDefaults(workspace);
    const source = { ...workspace.monitoringSources[0], sourceUrl: "https://localhost/admin" };
    expect(validateMonitoringSource(workspace, source).ok).toBe(false);
    expect(validateMonitoringSource(workspace, { ...source, sourceUrl: "http://instagram.com/zambil.club" }).ok).toBe(false);
    expect(validateMonitoringSource(workspace, { ...source, sourceUrl: "https://evil.example/zambil.club" }).ok).toBe(false);
  });

  it("creates idempotent daily snapshots without fabricating unavailable metrics", async () => {
    const workspace = emptyWorkspace();
    ensureMonitoringDefaults(workspace);
    const result = await runMonitoringCollection(workspace, "DAILY");
    expect(result.processed).toBeGreaterThan(0);
    expect(workspace.monitoringSnapshots).toHaveLength(workspace.monitoringSources.length);
    await runMonitoringCollection(workspace, "MANUAL", workspace.monitoringSources[0].id);
    expect(workspace.monitoringSnapshots.filter((item) => item.sourceId === workspace.monitoringSources[0].id)).toHaveLength(1);
    expect(workspace.monitoringSnapshots[0].normalizedMetrics.some((item) => item.qualityStatus === "UNAVAILABLE")).toBe(true);
  });

  it("rejects manual monitoring refresh without settings permission", async () => {
    const repository = new MemoryRepository();
    const viewer: SafeUser = {
      id: "viewer", username: "viewer", email: "viewer@example.com", firstName: "Viewer", lastName: "User",
      role: "VIEWER", extraPermissions: [], dataScope: "OWN", status: "ACTIVE", mustChangePassword: false,
      failedLoginCount: 0, createdAt: "2026-07-23T00:00:00.000Z", updatedAt: "2026-07-23T00:00:00.000Z",
      permissions: ["dashboard.view", "profile.view_own", "reports.view", "security_sessions.view_own"],
    };
    await expect(repository.runMonitoringCollection("MANUAL", null, viewer)).rejects.toThrow("برای اجرای دستی مانیتورینگ دسترسی ندارید.");
  });
});
