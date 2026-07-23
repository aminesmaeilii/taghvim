#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const profile = process.env.PERF_DATA_PROFILE ?? "small";
const output = process.env.PERF_DATA_OUTPUT ?? `performance-results/dataset-${profile}.json`;
const profiles = {
  small: { users: 5, contents: 30, tasks: 40, campaigns: 4, conversations: 3, messages: 30, notifications: 50, monitoringSources: 5, monitoringSnapshots: 30 },
  realistic: { users: 25, contents: 500, tasks: 800, campaigns: 40, conversations: 25, messages: 2_000, notifications: 3_000, monitoringSources: 40, monitoringSnapshots: 2_400 },
  large: { users: 100, contents: 5_000, tasks: 8_000, campaigns: 250, conversations: 150, messages: 50_000, notifications: 80_000, monitoringSources: 250, monitoringSnapshots: 45_000 },
};
const size = profiles[profile] ?? profiles.small;
const now = "2026-07-23T00:00:00.000Z";
const day = (index) => `2026-07-${String((index % 28) + 1).padStart(2, "0")}`;
const workspace = {
  contents: Array.from({ length: size.contents }, (_, i) => ({ id: `perf-content-${i}`, title: `Perf content ${i}`, shortDescription: null, brief: null, typeId: "type-2", platformId: "platform-6", campaignId: `perf-campaign-${i % size.campaigns}`, pillarId: "pillar-1", tagIds: [], owner: `Perf User ${i % size.users}`, reviewer: null, publisher: null, priority: "normal", status: i % 3 === 0 ? "review" : "scheduled", publicationDate: day(i), publicationTime: "10:00", timezone: "Asia/Tehran", startDate: day(i), deadline: day(i + 1), productionDate: day(i), reviewDate: day(i + 1), recurrence: null, caption: null, mainCopy: "Synthetic performance fixture", hook: null, callToAction: null, hashtags: null, keywords: null, link: null, sourceLink: null, notes: null, checklist: [], attachments: [], performance: null, contentVersion: 1, version: 1, sortOrder: i, createdAt: now, updatedAt: now, archivedAt: null })),
  campaigns: Array.from({ length: size.campaigns }, (_, i) => ({ id: `perf-campaign-${i}`, title: `Perf campaign ${i}`, goal: "Synthetic capacity test", description: null, startDate: day(i), endDate: day(i + 14), platformIds: ["platform-6"], targetAudience: null, mainMessage: null, kpi: null, status: "active", notes: null, version: 1, sortOrder: i, createdAt: now, updatedAt: now, archivedAt: null })),
  userProfiles: Array.from({ length: size.users }, (_, i) => ({ id: `perf-user-${i}`, userId: `perf-user-${i}`, displayName: `Perf User ${i}`, avatarUrl: null, role: i % 5 === 0 ? "manager" : "member", team: `Team ${i % 5}`, updatedAt: now })),
  tasks: Array.from({ length: size.tasks }, (_, i) => ({ id: `perf-task-${i}`, title: `Perf task ${i}`, description: null, status: i % 4 === 0 ? "done" : "todo", priority: "normal", assigneeUserId: `perf-user-${i % size.users}`, createdByUserId: `perf-user-${(i + 1) % size.users}`, dueDate: day(i), relatedContentId: `perf-content-${i % size.contents}`, relatedCampaignId: `perf-campaign-${i % size.campaigns}`, version: 1, sortOrder: i, createdAt: now, updatedAt: now, archivedAt: null })),
  chatConversations: Array.from({ length: size.conversations }, (_, i) => ({ id: `perf-conv-${i}`, type: "GROUP", title: `Perf room ${i}`, avatarUrl: null, createdBy: "perf-user-0", createdAt: now, updatedAt: now, lastMessageAt: now, directKey: null })),
  chatMembers: Array.from({ length: size.conversations * Math.min(size.users, 6) }, (_, i) => ({ conversationId: `perf-conv-${Math.floor(i / Math.min(size.users, 6))}`, userId: `perf-user-${i % size.users}`, role: i % 6 === 0 ? "OWNER" : "MEMBER", joinedAt: now, lastReadAt: now })),
  chatMessages: Array.from({ length: size.messages }, (_, i) => ({ id: `perf-message-${i}`, conversationId: `perf-conv-${i % size.conversations}`, senderId: `perf-user-${i % size.users}`, messageType: "TEXT", body: `Synthetic message ${i}`, contextType: null, contextId: null, contextMetadata: null, clientMessageId: `fixture-${i}`, createdAt: now, editedAt: null, deletedAt: null })),
  notifications: Array.from({ length: size.notifications }, (_, i) => ({ id: `perf-notification-${i}`, userId: `perf-user-${i % size.users}`, type: "perf", title: `Perf notification ${i}`, body: null, relatedEntityType: "task", relatedEntityId: `perf-task-${i % size.tasks}`, actionUrl: "#/tasks", priority: "normal", readAt: i % 2 === 0 ? now : null, createdAt: now, expiresAt: null })),
  monitoringSources: Array.from({ length: size.monitoringSources }, (_, i) => ({ id: `perf-source-${i}`, platformKey: "instagram", displayName: `Perf source ${i}`, sourceType: "profile", sourceUrl: `https://example.test/${i}`, normalizedUrl: `https://example.test/${i}`, enabled: true, collectionEnabled: true, collectionIntervalMinutes: 1440, dailyCollectionTime: "06:00", freshnessThresholdHours: 30, timezone: "Asia/Tehran", createdBy: "perf-user-0", identityChangedAt: null, identityChangeNote: null, sortOrder: i, version: 1, createdAt: now, updatedAt: now, archivedAt: null })),
  monitoringSnapshots: Array.from({ length: size.monitoringSnapshots }, (_, i) => ({ id: `perf-snapshot-${i}`, sourceId: `perf-source-${i % size.monitoringSources}`, collectedAt: now, snapshotDate: day(i), dataQuality: "COMPLETE", collectionMethod: "MOCK", normalizedMetadata: { followers: i }, createdAt: now })),
};
const emptyKeys = ["platforms", "types", "statuses", "tags", "pillars", "ideas", "templates", "activityLog", "learningMaterials", "highlights", "personalNotes", "adBudgets", "pushSubscriptions", "reminders", "monitoringPlatforms", "monitoringPlatformCapabilities", "monitoringSourceCapabilities", "monitoredContents", "monitoredContentSnapshots", "monitoringJobs", "monitoringDailyAggregates", "monitoringEvents"];
for (const key of emptyKeys) workspace[key] = [];
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ version: 1, generatedAt: now, profile, tag: "PERF_SYNTHETIC_ONLY", workspace, settings: null }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, profile, output, counts: size }, null, 2));
