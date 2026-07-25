import { describe, expect, it } from "vitest";
import { buildTechnicalHealthOverview, createLogEntry, normalizeCorrelationId, redactSensitive, serializeLog } from "./observability.js";
import type { WorkspaceData } from "../types/domain.js";

function workspace(): WorkspaceData {
  return {
    contents: [], platforms: [], types: [], statuses: [], campaigns: [], tags: [], pillars: [], ideas: [], templates: [],
    userProfiles: [], activityLog: [], learningMaterials: [], highlights: [], personalNotes: [], adBudgets: [], tasks: [],
    chatConversations: [], chatMembers: [], chatMessages: [], reminders: [], pushSubscriptions: [], notifications: [],
    monitoringPlatforms: [], monitoringPlatformCapabilities: [], monitoringSources: [], monitoringSourceCapabilities: [],
    monitoringSnapshots: [], monitoredContents: [], monitoredContentSnapshots: [], monitoringJobs: [], monitoringDailyAggregates: [], monitoringEvents: [],
  };
}

describe("observability", () => {
  it("redacts sensitive nested fields from logs", () => {
    const redacted = redactSensitive({ headers: { authorization: "Bearer secret" }, password: "hidden", nested: { databaseUrl: "postgres://secret", ok: "safe" } });
    expect(redacted).toEqual({ headers: { authorization: "[REDACTED]" }, password: "[REDACTED]", nested: { databaseUrl: "[REDACTED]", ok: "safe" } });
  });

  it("serializes structured logs without secret values", () => {
    const serialized = serializeLog(createLogEntry({ level: "error", event: "test_error", metadata: { token: "abc", message: "safe" } }));
    expect(serialized).toContain("test_error");
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("abc");
  });

  it("rejects hostile or oversized correlation IDs", () => {
    expect(normalizeCorrelationId("req_safe-123")).toBe("req_safe-123");
    expect(normalizeCorrelationId("<script>alert(1)</script>")).toMatch(/^req_/);
    expect(normalizeCorrelationId("x".repeat(120))).toMatch(/^req_/);
  });

  it("does not report missing technical integrations as healthy", () => {
    const health = buildTechnicalHealthOverview(workspace(), { environment: "test", applicationVersion: "test" });
    expect(health.services.find((item) => item.key === "database")?.status).toBe("UNKNOWN");
    expect(health.services.find((item) => item.key === "realtime")?.status).toBe("UNKNOWN");
    expect(health.overallStatus).toBe("UNKNOWN");
  });
});
