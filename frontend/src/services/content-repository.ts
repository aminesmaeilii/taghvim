import { isDesktopRuntime, platformInvoke } from "./platform";
import { API_BASE_URL, USE_REMOTE_API } from "./api-config";
import { MemoryRepository, type ContentRepository, type NewContent, type ReferenceEntity, type ReferenceKind } from "@shared/services/workspace-memory-repository";
import type { SafeUser } from "@shared/types/auth";
import type { ActivityLogEntry, AdBudget, AppNotification, AppSettings, Campaign, ChatContextType, ChatConversationSummary, ChatMessage, ChatMessagePage, Content, ContentFilters, ContentIdea, ContentTemplate, DashboardData, Highlight, LearningMaterial, MonitoringJobTrigger, MonitoringOverview, MonitoringPlatform, MonitoringSource, PersonalNote, PushSubscriptionRecord, Reminder, ReminderRelatedEntityType, ReportFilters, ReportSnapshot, TaskItem, UserProfile, WorkspaceData } from "@shared/types/domain";
import type { TechnicalHealthOverview } from "@shared/services/observability";

export type { ContentRepository, ReferenceEntity, ReferenceKind };
type BrowserSnapshot = { id: "workspace"; workspace: WorkspaceData; settings: AppSettings | null };

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openBrowserDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rooznegar-offline", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state")) request.result.createObjectStore("state", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("پایگاه داده مرورگر باز نشد."));
  });
}

async function readBrowserSnapshot(): Promise<BrowserSnapshot | null> {
  if (!hasIndexedDb()) return null;
  const database = await openBrowserDb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("state", "readonly").objectStore("state").get("workspace");
    request.onsuccess = () => resolve((request.result as BrowserSnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("داده‌های محلی خوانده نشدند."));
  });
}

async function writeBrowserSnapshot(snapshot: BrowserSnapshot): Promise<void> {
  if (!hasIndexedDb()) return;
  const database = await openBrowserDb();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction("state", "readwrite").objectStore("state").put(snapshot);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("داده‌های محلی ذخیره نشدند."));
  });
}

class BrowserRepository implements ContentRepository {
  private readonly memory = new MemoryRepository();
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = readBrowserSnapshot().then((snapshot) => {
      if (snapshot) this.memory.restore({ workspace: snapshot.workspace, settings: snapshot.settings });
    }).catch(() => undefined);
  }

  private async run<T>(action: () => Promise<T>, persist = false): Promise<T> {
    await this.ready;
    const result = await action();
    if (persist) await writeBrowserSnapshot({ id: "workspace", ...this.memory.snapshot() });
    return result;
  }

  bootstrap() { return this.run(async () => {
    const changed = this.memory.ensureDefaults();
    const workspace = await this.memory.bootstrap();
    if (changed) await writeBrowserSnapshot({ id: "workspace", ...this.memory.snapshot() });
    return workspace;
  }); }
  listContents(filters?: ContentFilters) { return this.run(() => this.memory.listContents(filters)); }
  saveContent(content: Content | NewContent) { return this.run(() => this.memory.saveContent(content), true); }
  archiveContent(id: string) { return this.run(() => this.memory.archiveContent(id), true); }
  deleteContent(id: string) { return this.run(() => this.memory.deleteContent(id), true); }
  moveContent(id: string, publicationDate: string, status?: Content["status"]) { return this.run(() => this.memory.moveContent(id, publicationDate, status), true); }
  duplicateContent(id: string, options?: { copySchedule?: boolean }) { return this.run(() => this.memory.duplicateContent(id, options), true); }
  saveCampaign(campaign: Campaign) { return this.run(() => this.memory.saveCampaign(campaign), true); }
  saveIdea(idea: ContentIdea) { return this.run(() => this.memory.saveIdea(idea), true); }
  saveTemplate(template: ContentTemplate) { return this.run(() => this.memory.saveTemplate(template), true); }
  deleteEntity(entity: "campaign" | "idea" | "template", id: string) { return this.run(() => this.memory.deleteEntity(entity, id), true); }
  saveReference(kind: ReferenceKind, entity: ReferenceEntity) { return this.run(() => this.memory.saveReference(kind, entity), true); }
  deleteReference(kind: ReferenceKind, id: string) { return this.run(() => this.memory.deleteReference(kind, id), true); }
  getSettings() { return this.run(() => this.memory.getSettings()); }
  saveSettings(settings: AppSettings) { return this.run(() => this.memory.saveSettings(settings), true); }
  dashboard() { return this.run(() => this.memory.dashboard()); }
  reportSnapshot(filters: ReportFilters, viewer?: Pick<SafeUser, "id" | "role" | "team" | "dataScope" | "permissions">, page?: number, pageSize?: number) { return this.run(() => this.memory.reportSnapshot(filters, viewer, page, pageSize)); }
  exportWorkspace() { return this.run(() => this.memory.exportWorkspace()); }
  importWorkspace(raw: string) { return this.run(async () => this.memory.importWorkspace(raw).then(async (result) => { if (result.imported > 0) await writeBrowserSnapshot({ id: "workspace", ...this.memory.snapshot() }); return result; })); }
  backup() { return this.run(() => this.memory.backup()); }
  saveProfile(profile: UserProfile) { return this.run(() => this.memory.saveProfile(profile), true); }
  logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">) { return this.run(() => this.memory.logActivity(entry), true); }
  saveLearningMaterial(material: LearningMaterial) { return this.run(() => this.memory.saveLearningMaterial(material), true); }
  deleteLearningMaterial(id: string) { return this.run(() => this.memory.deleteLearningMaterial(id), true); }
  saveHighlight(highlight: Omit<Highlight, "id" | "createdAt">) { return this.run(() => this.memory.saveHighlight(highlight), true); }
  deleteHighlight(id: string) { return this.run(() => this.memory.deleteHighlight(id), true); }
  savePersonalNote(note: PersonalNote) { return this.run(() => this.memory.savePersonalNote(note), true); }
  deletePersonalNote(id: string) { return this.run(() => this.memory.deletePersonalNote(id), true); }
  saveAdBudget(budget: AdBudget) { return this.run(() => this.memory.saveAdBudget(budget), true); }
  saveTask(task: TaskItem) { return this.run(() => this.memory.saveTask(task), true); }
  deleteTask(id: string) { return this.run(() => this.memory.deleteTask(id), true); }
  listChatConversations(userId: string) { return this.run(() => this.memory.listChatConversations(userId)); }
  listChatMessages(userId: string, conversationId: string, cursor?: string | null, limit?: number) { return this.run(() => this.memory.listChatMessages(userId, conversationId, cursor, limit)); }
  createDirectChat(userId: string, peerUserId: string) { return this.run(() => this.memory.createDirectChat(userId, peerUserId), true); }
  createGroupChat(userId: string, title: string, memberIds: string[]) { return this.run(() => this.memory.createGroupChat(userId, title, memberIds), true); }
  sendChatMessage(userId: string, conversationId: string, body: string, clientMessageId: string, context?: { type: ChatContextType; id: string; metadata?: Record<string, string> | null }) { return this.run(() => this.memory.sendChatMessage(userId, conversationId, body, clientMessageId, context), true); }
  markChatRead(userId: string, conversationId: string) { return this.run(() => this.memory.markChatRead(userId, conversationId), true); }
  purgeUserData(userId: string) { return this.run(() => this.memory.purgeUserData(userId), true); }
  listNotifications(userId: string, cursor?: string | null, limit?: number) { return this.run(() => this.memory.listNotifications(userId, cursor, limit)); }
  markNotificationRead(userId: string, notificationId: string) { return this.run(() => this.memory.markNotificationRead(userId, notificationId), true); }
  markAllNotificationsRead(userId: string) { return this.run(() => this.memory.markAllNotificationsRead(userId), true); }
  saveReminder(reminder: Reminder) { return this.run(() => this.memory.saveReminder(reminder), true); }
  listReminders(userId: string, relatedEntityType?: ReminderRelatedEntityType, relatedEntityId?: string) { return this.run(() => this.memory.listReminders(userId, relatedEntityType, relatedEntityId)); }
  cancelReminder(userId: string, reminderId: string) { return this.run(() => this.memory.cancelReminder(userId, reminderId), true); }
  snoozeReminder(userId: string, reminderId: string, minutes: number) { return this.run(() => this.memory.snoozeReminder(userId, reminderId, minutes), true); }
  savePushSubscription(subscription: PushSubscriptionRecord) { return this.run(() => this.memory.savePushSubscription(subscription), true); }
  revokePushSubscription(userId: string, subscriptionId: string) { return this.run(() => this.memory.revokePushSubscription(userId, subscriptionId), true); }
  listPushSubscriptions(userId: string) { return this.run(() => this.memory.listPushSubscriptions(userId)); }
  processDueReminders(atUtc?: string) { return this.run(() => this.memory.processDueReminders(atUtc), true); }
  monitoringOverview() { return this.run(() => this.memory.monitoringOverview()); }
  saveMonitoringSource(source: MonitoringSource, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.run(() => this.memory.saveMonitoringSource(source, viewer), true); }
  archiveMonitoringSource(sourceId: string, archived: boolean, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.run(() => this.memory.archiveMonitoringSource(sourceId, archived, viewer), true); }
  saveMonitoringPlatform(platform: MonitoringPlatform, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.run(() => this.memory.saveMonitoringPlatform(platform, viewer), true); }
  runMonitoringCollection(triggerType?: MonitoringJobTrigger, sourceId?: string | null, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.run(() => this.memory.runMonitoringCollection(triggerType, sourceId, viewer), true); }
  technicalHealth(viewer?: Pick<SafeUser, "id" | "permissions">) { return this.run(() => this.memory.technicalHealth(viewer)); }
}

class TauriRepository implements ContentRepository {
  private call<T>(command: string, args?: Record<string, unknown>): Promise<T> { return platformInvoke<T>(command, args); }
  bootstrap() { return this.call<WorkspaceData>("bootstrap_workspace"); }
  listContents(filters?: ContentFilters) { return this.call<Content[]>("list_contents", { filters }); }
  saveContent(content: Content | NewContent) { return this.call<Content>("save_content", { content }); }
  archiveContent(id: string) { return this.call<void>("archive_content", { id }); }
  deleteContent(id: string) { return this.call<void>("delete_content", { id }); }
  moveContent(id: string, publicationDate: string, status?: Content["status"]) { return this.call<Content>("move_content", { id, publicationDate, status }); }
  duplicateContent(id: string, options?: { copySchedule?: boolean }) { return this.call<Content>("duplicate_content", { id, options }); }
  saveCampaign(campaign: Campaign) { return this.call<Campaign>("save_campaign", { campaign }); }
  saveIdea(idea: ContentIdea) { return this.call<ContentIdea>("save_idea", { idea }); }
  saveTemplate(template: ContentTemplate) { return this.call<ContentTemplate>("save_template", { template }); }
  deleteEntity(entity: "campaign" | "idea" | "template", id: string) { return this.call<void>("delete_entity", { entity, id }); }
  saveReference(kind: ReferenceKind, entity: ReferenceEntity) { return this.call<ReferenceEntity>("save_reference", { kind, entity }); }
  deleteReference(kind: ReferenceKind, id: string) { return this.call<void>("delete_reference", { kind, id }); }
  getSettings() { return this.call<AppSettings | null>("get_settings"); }
  saveSettings(settings: AppSettings) { return this.call<void>("save_settings", { settings }); }
  dashboard() { return this.call<DashboardData>("get_dashboard"); }
  reportSnapshot(filters: ReportFilters, viewer?: Pick<SafeUser, "id" | "role" | "team" | "dataScope" | "permissions">, page?: number, pageSize?: number) { return this.call<ReportSnapshot>("report_snapshot", { filters, viewer, page, pageSize }); }
  exportWorkspace() { return this.call<string>("export_workspace"); }
  importWorkspace(raw: string) { return this.call<{ imported: number; skipped: number; errors: string[] }>("import_workspace", { raw }); }
  backup() { return this.call<string>("create_backup"); }
  saveProfile(profile: UserProfile) { return this.call<UserProfile>("save_profile", { profile }); }
  logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">) { return this.call<ActivityLogEntry>("log_activity", { entry }); }
  saveLearningMaterial(material: LearningMaterial) { return this.call<LearningMaterial>("save_learning_material", { material }); }
  deleteLearningMaterial(id: string) { return this.call<void>("delete_learning_material", { id }); }
  saveHighlight(highlight: Omit<Highlight, "id" | "createdAt">) { return this.call<Highlight>("save_highlight", { highlight }); }
  deleteHighlight(id: string) { return this.call<void>("delete_highlight", { id }); }
  savePersonalNote(note: PersonalNote) { return this.call<PersonalNote>("save_personal_note", { note }); }
  deletePersonalNote(id: string) { return this.call<void>("delete_personal_note", { id }); }
  saveAdBudget(budget: AdBudget) { return this.call<AdBudget>("save_ad_budget", { budget }); }
  saveTask(task: TaskItem) { return this.call<TaskItem>("save_task", { task }); }
  deleteTask(id: string) { return this.call<void>("delete_task", { id }); }
  listChatConversations(userId: string) { return this.call<ChatConversationSummary[]>("list_chat_conversations", { userId }); }
  listChatMessages(userId: string, conversationId: string, cursor?: string | null, limit?: number) { return this.call<ChatMessagePage>("list_chat_messages", { userId, conversationId, cursor, limit }); }
  createDirectChat(userId: string, peerUserId: string) { return this.call<ChatConversationSummary>("create_direct_chat", { userId, peerUserId }); }
  createGroupChat(userId: string, title: string, memberIds: string[]) { return this.call<ChatConversationSummary>("create_group_chat", { userId, title, memberIds }); }
  sendChatMessage(userId: string, conversationId: string, body: string, clientMessageId: string, context?: { type: ChatContextType; id: string; metadata?: Record<string, string> | null }) { return this.call<ChatMessage>("send_chat_message", { userId, conversationId, body, clientMessageId, context }); }
  markChatRead(userId: string, conversationId: string) { return this.call<void>("mark_chat_read", { userId, conversationId }); }
  purgeUserData(userId: string) { return this.call<void>("purge_user_data", { userId }); }
  listNotifications(userId: string, cursor?: string | null, limit?: number) { return this.call<{ notifications: AppNotification[]; unreadCount: number; nextCursor?: string | null }>("list_notifications", { userId, cursor, limit }); }
  markNotificationRead(userId: string, notificationId: string) { return this.call<void>("mark_notification_read", { userId, notificationId }); }
  markAllNotificationsRead(userId: string) { return this.call<void>("mark_all_notifications_read", { userId }); }
  saveReminder(reminder: Reminder) { return this.call<Reminder>("save_reminder", { reminder }); }
  listReminders(userId: string, relatedEntityType?: ReminderRelatedEntityType, relatedEntityId?: string) { return this.call<Reminder[]>("list_reminders", { userId, relatedEntityType, relatedEntityId }); }
  cancelReminder(userId: string, reminderId: string) { return this.call<void>("cancel_reminder", { userId, reminderId }); }
  snoozeReminder(userId: string, reminderId: string, minutes: number) { return this.call<Reminder>("snooze_reminder", { userId, reminderId, minutes }); }
  savePushSubscription(subscription: PushSubscriptionRecord) { return this.call<PushSubscriptionRecord>("save_push_subscription", { subscription }); }
  revokePushSubscription(userId: string, subscriptionId: string) { return this.call<void>("revoke_push_subscription", { userId, subscriptionId }); }
  listPushSubscriptions(userId: string) { return this.call<PushSubscriptionRecord[]>("list_push_subscriptions", { userId }); }
  processDueReminders(atUtc?: string) { return this.call<{ processed: number; notificationsCreated: number; failed: number }>("process_due_reminders", { atUtc }); }
  monitoringOverview() { return this.call<MonitoringOverview>("monitoring_overview"); }
  saveMonitoringSource(source: MonitoringSource, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<MonitoringSource>("save_monitoring_source", { source, viewer }); }
  archiveMonitoringSource(sourceId: string, archived: boolean, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<void>("archive_monitoring_source", { sourceId, archived, viewer }); }
  saveMonitoringPlatform(platform: MonitoringPlatform, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<MonitoringPlatform>("save_monitoring_platform", { platform, viewer }); }
  runMonitoringCollection(triggerType?: MonitoringJobTrigger, sourceId?: string | null, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<{ processed: number; succeeded: number; failed: number }>("run_monitoring_collection", { triggerType, sourceId, viewer }); }
  technicalHealth(viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<TechnicalHealthOverview>("technical_health", { viewer }); }
}

class ApiRepository implements ContentRepository {
  constructor(private readonly baseUrl: string) {}

  private async call<T>(method: keyof ContentRepository, args: unknown[] = []): Promise<T> {
    const requestId = `req_${crypto.randomUUID().slice(0, 8)}`;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/workspace`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({ method, args }),
    });
    const payload = await response.json().catch(() => null) as { data?: T; error?: string; requestId?: string } | null;
    if (!response.ok) throw new Error(`${payload?.error ?? "Backend request failed."} (${payload?.requestId ?? response.headers.get("x-request-id") ?? requestId})`);
    return payload?.data as T;
  }

  bootstrap() { return this.call<WorkspaceData>("bootstrap"); }
  listContents(filters?: ContentFilters) { return this.call<Content[]>("listContents", [filters]); }
  saveContent(content: Content | NewContent) { return this.call<Content>("saveContent", [content]); }
  archiveContent(id: string) { return this.call<void>("archiveContent", [id]); }
  deleteContent(id: string) { return this.call<void>("deleteContent", [id]); }
  moveContent(id: string, publicationDate: string, status?: Content["status"]) { return this.call<Content>("moveContent", [id, publicationDate, status]); }
  duplicateContent(id: string, options?: { copySchedule?: boolean }) { return this.call<Content>("duplicateContent", [id, options]); }
  saveCampaign(campaign: Campaign) { return this.call<Campaign>("saveCampaign", [campaign]); }
  saveIdea(idea: ContentIdea) { return this.call<ContentIdea>("saveIdea", [idea]); }
  saveTemplate(template: ContentTemplate) { return this.call<ContentTemplate>("saveTemplate", [template]); }
  deleteEntity(entity: "campaign" | "idea" | "template", id: string) { return this.call<void>("deleteEntity", [entity, id]); }
  saveReference(kind: ReferenceKind, entity: ReferenceEntity) { return this.call<ReferenceEntity>("saveReference", [kind, entity]); }
  deleteReference(kind: ReferenceKind, id: string) { return this.call<void>("deleteReference", [kind, id]); }
  getSettings() { return this.call<AppSettings | null>("getSettings"); }
  saveSettings(settings: AppSettings) { return this.call<void>("saveSettings", [settings]); }
  dashboard() { return this.call<DashboardData>("dashboard"); }
  reportSnapshot(filters: ReportFilters, viewer?: Pick<SafeUser, "id" | "role" | "team" | "dataScope" | "permissions">, page?: number, pageSize?: number) { return this.call<ReportSnapshot>("reportSnapshot", [filters, viewer, page, pageSize]); }
  exportWorkspace() { return this.call<string>("exportWorkspace"); }
  importWorkspace(raw: string) { return this.call<{ imported: number; skipped: number; errors: string[] }>("importWorkspace", [raw]); }
  backup() { return this.call<string>("backup"); }
  saveProfile(profile: UserProfile) { return this.call<UserProfile>("saveProfile", [profile]); }
  logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">) { return this.call<ActivityLogEntry>("logActivity", [entry]); }
  saveLearningMaterial(material: LearningMaterial) { return this.call<LearningMaterial>("saveLearningMaterial", [material]); }
  deleteLearningMaterial(id: string) { return this.call<void>("deleteLearningMaterial", [id]); }
  saveHighlight(highlight: Omit<Highlight, "id" | "createdAt">) { return this.call<Highlight>("saveHighlight", [highlight]); }
  deleteHighlight(id: string) { return this.call<void>("deleteHighlight", [id]); }
  savePersonalNote(note: PersonalNote) { return this.call<PersonalNote>("savePersonalNote", [note]); }
  deletePersonalNote(id: string) { return this.call<void>("deletePersonalNote", [id]); }
  saveAdBudget(budget: AdBudget) { return this.call<AdBudget>("saveAdBudget", [budget]); }
  saveTask(task: TaskItem) { return this.call<TaskItem>("saveTask", [task]); }
  deleteTask(id: string) { return this.call<void>("deleteTask", [id]); }
  listChatConversations(userId: string) { return this.call<ChatConversationSummary[]>("listChatConversations", [userId]); }
  listChatMessages(userId: string, conversationId: string, cursor?: string | null, limit?: number) { return this.call<ChatMessagePage>("listChatMessages", [userId, conversationId, cursor, limit]); }
  createDirectChat(userId: string, peerUserId: string) { return this.call<ChatConversationSummary>("createDirectChat", [userId, peerUserId]); }
  createGroupChat(userId: string, title: string, memberIds: string[]) { return this.call<ChatConversationSummary>("createGroupChat", [userId, title, memberIds]); }
  sendChatMessage(userId: string, conversationId: string, body: string, clientMessageId: string, context?: { type: ChatContextType; id: string; metadata?: Record<string, string> | null }) { return this.call<ChatMessage>("sendChatMessage", [userId, conversationId, body, clientMessageId, context]); }
  markChatRead(userId: string, conversationId: string) { return this.call<void>("markChatRead", [userId, conversationId]); }
  purgeUserData(userId: string) { return this.call<void>("purgeUserData", [userId]); }
  listNotifications(userId: string, cursor?: string | null, limit?: number) { return this.call<{ notifications: AppNotification[]; unreadCount: number; nextCursor?: string | null }>("listNotifications", [userId, cursor, limit]); }
  markNotificationRead(userId: string, notificationId: string) { return this.call<void>("markNotificationRead", [userId, notificationId]); }
  markAllNotificationsRead(userId: string) { return this.call<void>("markAllNotificationsRead", [userId]); }
  saveReminder(reminder: Reminder) { return this.call<Reminder>("saveReminder", [reminder]); }
  listReminders(userId: string, relatedEntityType?: ReminderRelatedEntityType, relatedEntityId?: string) { return this.call<Reminder[]>("listReminders", [userId, relatedEntityType, relatedEntityId]); }
  cancelReminder(userId: string, reminderId: string) { return this.call<void>("cancelReminder", [userId, reminderId]); }
  snoozeReminder(userId: string, reminderId: string, minutes: number) { return this.call<Reminder>("snoozeReminder", [userId, reminderId, minutes]); }
  savePushSubscription(subscription: PushSubscriptionRecord) { return this.call<PushSubscriptionRecord>("savePushSubscription", [subscription]); }
  revokePushSubscription(userId: string, subscriptionId: string) { return this.call<void>("revokePushSubscription", [userId, subscriptionId]); }
  listPushSubscriptions(userId: string) { return this.call<PushSubscriptionRecord[]>("listPushSubscriptions", [userId]); }
  processDueReminders(atUtc?: string) { return this.call<{ processed: number; notificationsCreated: number; failed: number }>("processDueReminders", [atUtc]); }
  monitoringOverview() { return this.call<MonitoringOverview>("monitoringOverview"); }
  saveMonitoringSource(source: MonitoringSource, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<MonitoringSource>("saveMonitoringSource", [source, viewer]); }
  archiveMonitoringSource(sourceId: string, archived: boolean, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<void>("archiveMonitoringSource", [sourceId, archived, viewer]); }
  saveMonitoringPlatform(platform: MonitoringPlatform, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<MonitoringPlatform>("saveMonitoringPlatform", [platform, viewer]); }
  runMonitoringCollection(triggerType?: MonitoringJobTrigger, sourceId?: string | null, viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<{ processed: number; succeeded: number; failed: number }>("runMonitoringCollection", [triggerType, sourceId, viewer]); }
  technicalHealth(viewer?: Pick<SafeUser, "id" | "permissions">) { return this.call<TechnicalHealthOverview>("technicalHealth", [viewer]); }
}

export const contentRepository: ContentRepository = isDesktopRuntime
  ? new TauriRepository()
  : USE_REMOTE_API ? new ApiRepository(API_BASE_URL)
    : hasIndexedDb() ? new BrowserRepository() : new MemoryRepository();
