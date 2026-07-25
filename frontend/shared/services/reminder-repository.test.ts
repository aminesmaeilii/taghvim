import { describe, expect, it } from "vitest";
import { MemoryRepository } from "./workspace-memory-repository";
import type { Reminder } from "../types/domain";

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    taskId: "task-1",
    eventId: null,
    campaignId: null,
    relatedEntityId: "task-1",
    relatedEntityType: "task",
    title: "یادآوری وظیفه",
    body: "متن",
    scheduledForUtc: now,
    originalTimezone: "Asia/Tehran",
    status: "SCHEDULED",
    priority: "normal",
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
    sentAt: null,
    deduplicationKey: `user-1:task:task-1:${now}`,
    retryCount: 0,
    ...overrides,
  };
}

describe("reminder repository", () => {
  it("creates, cancels, and snoozes reminders", async () => {
    const repository = new MemoryRepository();
    const saved = await repository.saveReminder(reminder());
    expect(await repository.listReminders("user-1", "task", "task-1")).toHaveLength(1);

    const snoozed = await repository.snoozeReminder("user-1", saved.id, 10);
    expect(snoozed.status).toBe("SNOOZED");

    await repository.cancelReminder("user-1", saved.id);
    expect((await repository.listReminders("user-1"))[0].status).toBe("CANCELLED");
  });

  it("processes due reminders once and creates notifications", async () => {
    const repository = new MemoryRepository();
    await repository.saveReminder(reminder({ scheduledForUtc: "2026-01-01T00:00:00.000Z" }));

    const first = await repository.processDueReminders("2026-01-01T00:01:00.000Z");
    const second = await repository.processDueReminders("2026-01-01T00:02:00.000Z");
    const notifications = await repository.listNotifications("user-1");

    expect(first.notificationsCreated).toBe(1);
    expect(second.notificationsCreated).toBe(0);
    expect(notifications.unreadCount).toBe(1);
  });
});
