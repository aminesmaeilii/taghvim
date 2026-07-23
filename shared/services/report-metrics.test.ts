import { describe, expect, it } from "vitest";
import { buildReportSnapshot, defaultReportFilters } from "./report-metrics.js";
import type { SafeUser } from "../types/auth.js";
import type { TaskItem, WorkspaceData } from "../types/domain.js";

const baseTask = (patch: Partial<TaskItem>): TaskItem => ({
  id: patch.id ?? crypto.randomUUID(),
  title: patch.title ?? "Task",
  notes: null,
  assigneeUserId: patch.assigneeUserId ?? "u1",
  status: patch.status ?? "todo",
  priority: patch.priority ?? "normal",
  dueDate: "dueDate" in patch ? patch.dueDate : "2026-07-20",
  createdByUserId: patch.createdByUserId ?? "u1",
  createdByName: null,
  createdAt: patch.createdAt ?? "2026-07-01T08:00:00.000Z",
  updatedAt: patch.updatedAt ?? "2026-07-20T08:00:00.000Z",
  archivedAt: null,
  sortOrder: 0,
  version: 1,
});

function workspace(tasks: TaskItem[]): WorkspaceData {
  return {
    contents: [], platforms: [], types: [], statuses: [], campaigns: [], tags: [], pillars: [], ideas: [], templates: [],
    userProfiles: [{ id: "u1", userId: "u1", displayName: "کاربر اول", avatarUrl: null, jobRole: null, lastSeenAt: "2026-07-20T00:00:00.000Z", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" }],
    activityLog: [], learningMaterials: [], highlights: [], personalNotes: [], adBudgets: [], tasks,
    chatConversations: [], chatMembers: [], chatMessages: [], reminders: [], pushSubscriptions: [], notifications: [],
  };
}

const viewer: SafeUser = {
  id: "u1", username: "u1", email: "u1@example.com", firstName: "کاربر", lastName: "اول", phone: null, avatarUrl: null, jobTitle: null, department: null, team: null,
  role: "USER", extraPermissions: [], dataScope: "OWN", status: "ACTIVE", mustChangePassword: false, failedLoginCount: 0, lastLoginAt: null, lastActivityAt: null,
  createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", permissions: ["reports.view"],
};

describe("report metrics", () => {
  it("calculates task completion and on-time rates from real tasks", () => {
    const data = buildReportSnapshot(workspace([
      baseTask({ id: "done-on-time", status: "done", dueDate: "2026-07-10", updatedAt: "2026-07-10T08:00:00.000Z" }),
      baseTask({ id: "done-late", status: "done", dueDate: "2026-07-11", updatedAt: "2026-07-12T08:00:00.000Z" }),
      baseTask({ id: "open", status: "in_progress", dueDate: "2026-07-12" }),
    ]), { ...defaultReportFilters(new Date("2026-07-23T00:00:00.000Z")), fromDate: "2026-07-01", toDate: "2026-07-31" }, viewer);

    expect(data.kpis.find((item) => item.key === "task_completion_rate")?.value).toBe(66.7);
    expect(data.kpis.find((item) => item.key === "on_time_completion_rate")?.value).toBe(50);
  });

  it("distinguishes missing due-date data from a real zero", () => {
    const data = buildReportSnapshot(workspace([baseTask({ id: "no-due", status: "done", dueDate: null })]), { ...defaultReportFilters(new Date("2026-07-23T00:00:00.000Z")), fromDate: "2026-07-01", toDate: "2026-07-31" }, viewer);

    expect(data.kpis.find((item) => item.key === "on_time_completion_rate")?.value).toBeNull();
    expect(data.dataQuality.find((item) => item.key === "tasks_without_due")?.count).toBe(1);
  });

  it("limits ordinary users to their own task rows", () => {
    const data = buildReportSnapshot(workspace([
      baseTask({ id: "own", assigneeUserId: "u1" }),
      baseTask({ id: "other", assigneeUserId: "u2", createdByUserId: "u2" }),
    ]), { ...defaultReportFilters(new Date("2026-07-23T00:00:00.000Z")), fromDate: "2026-07-01", toDate: "2026-07-31" }, viewer);

    expect(data.table.total).toBe(1);
    expect(data.table.rows[0]?.id).toBe("own");
  });
});
