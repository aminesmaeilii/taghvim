import { DEFAULT_PILLARS, DEFAULT_PLATFORMS, DEFAULT_STATUSES, DEFAULT_TYPES } from "../constants/defaults.js";
import { requirePermission } from "./authorization.js";
import { ensureMonitoringDefaults, monitoringOverview, runMonitoringCollection, validateMonitoringSource } from "./monitoring-service.js";
import { buildTechnicalHealthOverview } from "./observability.js";
import { buildReportSnapshot } from "./report-metrics.js";
import type { SafeUser } from "../types/auth.js";
import type { ActivityLogEntry, AdBudget, AppNotification, AppSettings, Campaign, ChatContextType, ChatConversation, ChatConversationMember, ChatConversationSummary, ChatMemberRole, ChatMessage, ChatMessagePage, Content, ContentFilters, ContentIdea, ContentTemplate, ContentPillar, ContentStatus, ContentType, DashboardData, Highlight, LearningMaterial, MonitoringJobTrigger, MonitoringOverview, MonitoringPlatform, MonitoringSource, PersonalNote, PushSubscriptionRecord, Reminder, ReminderRelatedEntityType, ReportFilters, ReportSnapshot, TaskItem, UserProfile, WorkspaceData, Platform, Tag } from "../types/domain.js";
import type { TechnicalHealthOverview } from "./observability.js";
import { todayIso } from "../utils/jalali.js";

export type NewContent = Omit<Content, "id" | "createdAt" | "updatedAt" | "archivedAt" | "sortOrder" | "version" | "contentVersion">;
export type ReferenceEntity = Platform | ContentType | ContentStatus | ContentPillar | Tag;
export type ReferenceKind = "platform" | "type" | "status" | "pillar" | "tag";

export interface ContentRepository {
  bootstrap(): Promise<WorkspaceData>;
  listContents(filters?: ContentFilters): Promise<Content[]>;
  saveContent(content: Content | NewContent): Promise<Content>;
  archiveContent(id: string): Promise<void>;
  deleteContent(id: string): Promise<void>;
  moveContent(id: string, publicationDate: string, status?: Content["status"]): Promise<Content>;
  duplicateContent(id: string, options?: { copySchedule?: boolean }): Promise<Content>;
  saveCampaign(campaign: Campaign): Promise<Campaign>;
  saveIdea(idea: ContentIdea): Promise<ContentIdea>;
  saveTemplate(template: ContentTemplate): Promise<ContentTemplate>;
  deleteEntity(entity: "campaign" | "idea" | "template", id: string): Promise<void>;
  saveReference(kind: ReferenceKind, entity: ReferenceEntity): Promise<ReferenceEntity>;
  deleteReference(kind: ReferenceKind, id: string): Promise<void>;
  getSettings(): Promise<AppSettings | null>;
  saveSettings(settings: AppSettings): Promise<void>;
  dashboard(): Promise<DashboardData>;
  reportSnapshot(filters: ReportFilters, viewer?: Pick<SafeUser, "id" | "role" | "team" | "dataScope" | "permissions">, page?: number, pageSize?: number): Promise<ReportSnapshot>;
  exportWorkspace(): Promise<string>;
  importWorkspace(raw: string): Promise<{ imported: number; skipped: number; errors: string[] }>;
  backup(): Promise<string>;
  saveProfile(profile: UserProfile): Promise<UserProfile>;
  logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">): Promise<ActivityLogEntry>;
  saveLearningMaterial(material: LearningMaterial): Promise<LearningMaterial>;
  deleteLearningMaterial(id: string): Promise<void>;
  saveHighlight(highlight: Omit<Highlight, "id" | "createdAt">): Promise<Highlight>;
  deleteHighlight(id: string): Promise<void>;
  savePersonalNote(note: PersonalNote): Promise<PersonalNote>;
  deletePersonalNote(id: string): Promise<void>;
  saveAdBudget(budget: AdBudget): Promise<AdBudget>;
  saveTask(task: TaskItem): Promise<TaskItem>;
  deleteTask(id: string): Promise<void>;
  listChatConversations(userId: string): Promise<ChatConversationSummary[]>;
  listChatMessages(userId: string, conversationId: string, cursor?: string | null, limit?: number): Promise<ChatMessagePage>;
  createDirectChat(userId: string, peerUserId: string): Promise<ChatConversationSummary>;
  createGroupChat(userId: string, title: string, memberIds: string[]): Promise<ChatConversationSummary>;
  sendChatMessage(userId: string, conversationId: string, body: string, clientMessageId: string, context?: { type: ChatContextType; id: string; metadata?: Record<string, string> | null }): Promise<ChatMessage>;
  markChatRead(userId: string, conversationId: string): Promise<void>;
  purgeUserData(userId: string): Promise<void>;
  listNotifications(userId: string, cursor?: string | null, limit?: number): Promise<{ notifications: AppNotification[]; unreadCount: number; nextCursor?: string | null }>;
  markNotificationRead(userId: string, notificationId: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  saveReminder(reminder: Reminder): Promise<Reminder>;
  listReminders(userId: string, relatedEntityType?: ReminderRelatedEntityType, relatedEntityId?: string): Promise<Reminder[]>;
  cancelReminder(userId: string, reminderId: string): Promise<void>;
  snoozeReminder(userId: string, reminderId: string, minutes: number): Promise<Reminder>;
  savePushSubscription(subscription: PushSubscriptionRecord): Promise<PushSubscriptionRecord>;
  revokePushSubscription(userId: string, subscriptionId: string): Promise<void>;
  listPushSubscriptions(userId: string): Promise<PushSubscriptionRecord[]>;
  processDueReminders(atUtc?: string): Promise<{ processed: number; notificationsCreated: number; failed: number }>;
  monitoringOverview(): Promise<MonitoringOverview>;
  saveMonitoringSource(source: MonitoringSource, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<MonitoringSource>;
  archiveMonitoringSource(sourceId: string, archived: boolean, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<void>;
  saveMonitoringPlatform(platform: MonitoringPlatform, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<MonitoringPlatform>;
  runMonitoringCollection(triggerType?: MonitoringJobTrigger, sourceId?: string | null, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<{ processed: number; succeeded: number; failed: number }>;
  technicalHealth(viewer?: Pick<SafeUser, "id" | "permissions">): Promise<TechnicalHealthOverview>;
}

function now(): string { return new Date().toISOString(); }
function id(): string { return crypto.randomUUID(); }
function clone<T>(value: T): T { return structuredClone(value); }
function addDaysIso(days: number): string {
  const value = new Date(`${todayIso()}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function createWorkspace(): WorkspaceData {
  return {
    contents: [],
    platforms: clone(DEFAULT_PLATFORMS),
    types: clone(DEFAULT_TYPES),
    statuses: clone(DEFAULT_STATUSES),
    campaigns: [], tags: [], pillars: clone(DEFAULT_PILLARS), ideas: [], templates: [],
    userProfiles: [], activityLog: [],
    learningMaterials: [], highlights: [], personalNotes: [], adBudgets: [], tasks: [], chatConversations: [], chatMembers: [], chatMessages: [], reminders: [], pushSubscriptions: [], notifications: [],
    monitoringPlatforms: [], monitoringPlatformCapabilities: [], monitoringSources: [], monitoringSourceCapabilities: [], monitoringSnapshots: [], monitoredContents: [], monitoredContentSnapshots: [], monitoringJobs: [], monitoringDailyAggregates: [], monitoringEvents: [],
  };
}

function appendMissingDefaults<T extends { id: string; name: string; sortOrder: number }>(target: T[], defaults: T[], prefix: string): boolean {
  const names = new Set(target.map((item) => item.name));
  const ids = new Set(target.map((item) => item.id));
  let changed = false;
  for (const item of defaults) {
    if (names.has(item.name)) continue;
    const next = clone(item);
    if (ids.has(next.id)) next.id = `${prefix}-${crypto.randomUUID()}`;
    next.sortOrder = target.length;
    target.push(next);
    names.add(next.name);
    ids.add(next.id);
    changed = true;
  }
  return changed;
}

function ensureDefaultReferences(workspace: WorkspaceData): boolean {
  return [
    appendMissingDefaults(workspace.platforms, DEFAULT_PLATFORMS, "platform"),
    appendMissingDefaults(workspace.types, DEFAULT_TYPES, "type"),
    appendMissingDefaults(workspace.statuses, DEFAULT_STATUSES, "status"),
    appendMissingDefaults(workspace.pillars, DEFAULT_PILLARS, "pillar"),
  ].some(Boolean);
}

function createBaseEntity(id: string, sortOrder: number) {
  const timestamp = now();
  return { id, sortOrder, version: 1, createdAt: timestamp, updatedAt: timestamp, archivedAt: null };
}

function seedStarterWorkspace(workspace: WorkspaceData): boolean {
  if (workspace.contents.length || workspace.campaigns.length || workspace.ideas.length || workspace.templates.length) return false;

  const tagData = [
    ["starter-campaign", "کمپین", "#FF334C"],
    ["starter-product", "محصول", "#0f766e"],
    ["starter-trust", "اعتمادسازی", "#2563eb"],
  ] as const;
  workspace.tags.push(...tagData.map(([id, name, color], index) => ({ ...createBaseEntity(id, index), name, color })));

  const campaign: Campaign = {
    ...createBaseEntity("starter-campaign-capture", 0),
    title: "کمپین معرفی زمبیل",
    goal: "ساخت اعتماد و افزایش capture برای مخاطبان جدید",
    description: "نمونه کمپین اولیه برای شروع تقویم محتوا.",
    startDate: addDaysIso(-2),
    endDate: addDaysIso(14),
    platformIds: ["platform-6", "platform-8", "platform-23"],
    targetAudience: "مخاطبان تازه و کاربران بالقوه زمبیل",
    mainMessage: "زمبیل مسیر برنامه ریزی، تولید و انتشار محتوا را یکپارچه می کند.",
    kpi: "ثبت ۲۰ محتوای برنامه ریزی شده و ۵ انتشار موفق",
    status: "active",
    notes: null,
  };
  workspace.campaigns.push(campaign);

  const contents: Content[] = [
    {
      ...createBaseEntity("starter-content-today", 0),
      title: "پست معرفی تقویم محتوای زمبیل",
      shortDescription: "شروع برنامه ریزی محتوا برای کانال های اصلی",
      brief: "یک پست کوتاه درباره ارزش تقویم متمرکز محتوا.",
      typeId: "type-2",
      platformId: "platform-6",
      campaignId: campaign.id,
      pillarId: "pillar-6",
      tagIds: ["starter-campaign", "starter-trust"],
      owner: "تیم محتوا",
      reviewer: "مدیر",
      publisher: null,
      priority: "high",
      status: "in_progress",
      publicationDate: todayIso(),
      publicationTime: "10:00",
      timezone: "Asia/Tehran",
      startDate: addDaysIso(-1),
      deadline: todayIso(),
      productionDate: todayIso(),
      reviewDate: addDaysIso(1),
      recurrence: null,
      caption: "تقویم محتوا وقتی ارزشمند است که همه تیم بدانند امروز چه چیزی باید منتشر شود.",
      mainCopy: "این محتوای نمونه برای راه اندازی داشبورد ساخته شده است.",
      hook: "امروز چه محتوایی باید منتشر شود؟",
      callToAction: "اولین محتوای واقعی خودتان را بسازید.",
      hashtags: "#زمبیل #تقویم_محتوا",
      keywords: "تقویم محتوا، زمبیل",
      link: null,
      sourceLink: null,
      notes: "بعد از ورود داده های واقعی می توانید این آیتم را حذف کنید.",
      checklist: [
        { id: "starter-check-1", title: "بازبینی کپشن", completed: false },
        { id: "starter-check-2", title: "هماهنگی زمان انتشار", completed: false },
      ],
      attachments: [],
      contentVersion: 1,
      performance: null,
    },
    {
      ...createBaseEntity("starter-content-review", 1),
      title: "استوری اعتمادسازی برای خرید از زمبیل",
      shortDescription: "پاسخ به نگرانی های رایج مخاطب",
      brief: "استوری چند اسلایدی با تمرکز روی اعتماد و مسیر خرید.",
      typeId: "type-3",
      platformId: "platform-6",
      campaignId: campaign.id,
      pillarId: "pillar-6",
      tagIds: ["starter-trust"],
      owner: "تیم محتوا",
      reviewer: "مدیر",
      publisher: null,
      priority: "normal",
      status: "review",
      publicationDate: addDaysIso(1),
      publicationTime: "18:00",
      timezone: "Asia/Tehran",
      startDate: todayIso(),
      deadline: addDaysIso(1),
      productionDate: todayIso(),
      reviewDate: todayIso(),
      recurrence: null,
      caption: null,
      mainCopy: "نمونه محتوای در انتظار بررسی.",
      hook: "چرا مخاطب باید به زمبیل اعتماد کند؟",
      callToAction: "نظر مخاطبان را جمع آوری کنید.",
      hashtags: "#اعتمادسازی",
      keywords: null,
      link: null,
      sourceLink: null,
      notes: null,
      checklist: [],
      attachments: [],
      contentVersion: 1,
      performance: null,
    },
    {
      ...createBaseEntity("starter-content-scheduled", 2),
      title: "مقاله کوتاه درباره نظم در تولید محتوا",
      shortDescription: "محتوای آماده انتشار برای هفته جاری",
      brief: "یک مقاله وبلاگی کوتاه درباره مدیریت گردش کار محتوا.",
      typeId: "type-6",
      platformId: "platform-23",
      campaignId: campaign.id,
      pillarId: "pillar-1",
      tagIds: ["starter-product"],
      owner: "تیم محتوا",
      reviewer: "مدیر",
      publisher: null,
      priority: "normal",
      status: "scheduled",
      publicationDate: addDaysIso(3),
      publicationTime: "12:30",
      timezone: "Asia/Tehran",
      startDate: addDaysIso(1),
      deadline: addDaysIso(2),
      productionDate: addDaysIso(1),
      reviewDate: addDaysIso(2),
      recurrence: null,
      caption: null,
      mainCopy: "نمونه محتوای زمان بندی شده.",
      hook: "نظم محتوا از کجا شروع می شود؟",
      callToAction: "تقویم هفته را بررسی کنید.",
      hashtags: null,
      keywords: "گردش کار محتوا",
      link: null,
      sourceLink: null,
      notes: null,
      checklist: [],
      attachments: [],
      contentVersion: 1,
      performance: null,
    },
  ];
  workspace.contents.push(...contents);

  workspace.ideas.push(
    {
      ...createBaseEntity("starter-idea-1", 0),
      title: "سری محتوای پشت صحنه تیم محتوا",
      description: "نمایش روند تصمیم گیری، تولید و بازبینی برای ساخت اعتماد.",
      tagIds: ["starter-trust"],
      pillarId: "pillar-6",
      referenceLink: null,
      priority: "high",
      notes: "برای تبدیل به چند پست و استوری مناسب است.",
    },
    {
      ...createBaseEntity("starter-idea-2", 1),
      title: "چک لیست هفتگی انتشار محتوا",
      description: "یک محتوای آموزشی برای کمک به تیم های کوچک.",
      tagIds: ["starter-product"],
      pillarId: "pillar-1",
      referenceLink: null,
      priority: "normal",
      notes: null,
    },
  );

  workspace.templates.push(
    {
      ...createBaseEntity("starter-template-post", 0),
      title: "قالب پست معرفی محصول",
      typeId: "type-2",
      platformId: "platform-6",
      captionStructure: "Hook → مسئله → راه حل → CTA",
      checklist: [
        { id: "starter-template-check-1", title: "Hook واضح دارد", completed: false },
        { id: "starter-template-check-2", title: "CTA مشخص است", completed: false },
      ],
      defaultStatus: "draft",
      defaultOwner: "تیم محتوا",
      defaultTagIds: ["starter-product"],
      defaultPublishingTime: "10:00",
      brief: "برای ساخت سریع پست معرفی محصول یا قابلیت جدید.",
    },
  );

  return true;
}

function matchesFilters(item: Content, filters?: ContentFilters): boolean {
  if (!filters) return !item.archivedAt;
  if (!filters.archived && item.archivedAt) return false;
  if (filters.archived === false && item.archivedAt) return false;
  if (filters.search) {
    const query = filters.search.trim().toLocaleLowerCase("fa");
    const searchable = [item.title, item.caption, item.shortDescription, item.brief, item.notes, item.hashtags, item.owner].filter(Boolean).join(" ").toLocaleLowerCase("fa");
    if (!searchable.includes(query)) return false;
  }
  if (filters.status?.length && !filters.status.includes(item.status)) return false;
  if (filters.platformIds?.length && !filters.platformIds.includes(item.platformId)) return false;
  if (filters.typeIds?.length && !filters.typeIds.includes(item.typeId)) return false;
  if (filters.campaignIds?.length && (!item.campaignId || !filters.campaignIds.includes(item.campaignId))) return false;
  if (filters.pillarIds?.length && (!item.pillarId || !filters.pillarIds.includes(item.pillarId))) return false;
  if (filters.priorities?.length && !filters.priorities.includes(item.priority)) return false;
  if (filters.owner && item.owner !== filters.owner) return false;
  if (filters.tagIds?.length && !filters.tagIds.some((tagId) => item.tagIds.includes(tagId))) return false;
  if (filters.fromDate && item.publicationDate < filters.fromDate) return false;
  if (filters.toDate && item.publicationDate > filters.toDate) return false;
  if (filters.overdue && !(item.deadline && item.deadline < todayIso() && !["published", "archived", "cancelled"].includes(item.status))) return false;
  return true;
}

export class MemoryRepository implements ContentRepository {
  protected data = createWorkspace();
  protected settings: AppSettings | null = null;

  snapshot(): { workspace: WorkspaceData; settings: AppSettings | null } {
    return { workspace: clone(this.data), settings: clone(this.settings) };
  }

  restore(snapshot: { workspace: WorkspaceData; settings: AppSettings | null }): void {
    this.data = clone(snapshot.workspace);
    this.data.userProfiles ??= [];
    this.data.activityLog ??= [];
    this.data.learningMaterials ??= [];
    this.data.highlights ??= [];
    this.data.personalNotes ??= [];
    this.data.adBudgets ??= [];
    this.data.tasks ??= [];
    this.data.chatConversations ??= [];
    this.data.chatMembers ??= [];
    this.data.chatMessages ??= [];
    this.data.reminders ??= [];
    this.data.pushSubscriptions ??= [];
    this.data.notifications ??= [];
    ensureMonitoringDefaults(this.data);
    this.settings = clone(snapshot.settings);
  }

  ensureDefaults(): boolean {
    const references = ensureDefaultReferences(this.data);
    const monitoring = ensureMonitoringDefaults(this.data);
    const starter = seedStarterWorkspace(this.data);
    return references || monitoring || starter;
  }
  async bootstrap(): Promise<WorkspaceData> { this.ensureDefaults(); return clone(this.data); }
  async listContents(filters?: ContentFilters): Promise<Content[]> {
    return clone(this.data.contents.filter((item) => matchesFilters(item, filters)).sort((a, b) => `${a.publicationDate}${a.publicationTime ?? ""}`.localeCompare(`${b.publicationDate}${b.publicationTime ?? ""}`)));
  }
  async saveContent(input: Content | NewContent): Promise<Content> {
    const found = "id" in input ? this.data.contents.findIndex((item) => item.id === input.id) : -1;
    const timestamp = now();
    const base: Content = found >= 0
      ? { ...this.data.contents[found], ...input, updatedAt: timestamp, version: this.data.contents[found].version + 1 }
      : { ...input, id: id(), createdAt: timestamp, updatedAt: timestamp, archivedAt: null, sortOrder: this.data.contents.length, version: 1, contentVersion: 1 };
    if (found >= 0) this.data.contents[found] = base; else this.data.contents.push(base);
    return clone(base);
  }
  async archiveContent(contentId: string): Promise<void> {
    const item = this.data.contents.find((content) => content.id === contentId);
    if (item) { item.archivedAt = now(); item.status = "archived"; item.updatedAt = now(); item.version += 1; }
  }
  async deleteContent(contentId: string): Promise<void> { this.data.contents = this.data.contents.filter((item) => item.id !== contentId); }
  async moveContent(contentId: string, publicationDate: string, status?: Content["status"]): Promise<Content> {
    const item = this.data.contents.find((content) => content.id === contentId);
    if (!item) throw new Error("محتوا پیدا نشد.");
    item.publicationDate = publicationDate;
    if (status) item.status = status;
    item.updatedAt = now(); item.version += 1;
    return clone(item);
  }
  async duplicateContent(contentId: string, options: { copySchedule?: boolean } = {}): Promise<Content> {
    const source = this.data.contents.find((item) => item.id === contentId);
    if (!source) throw new Error("محتوا پیدا نشد.");
    const timestamp = now();
    const duplicate: Content = {
      ...clone(source), id: id(), title: `${source.title} (کپی)`, status: "draft", publicationDate: options.copySchedule ? source.publicationDate : todayIso(),
      publicationTime: options.copySchedule ? source.publicationTime : null, createdAt: timestamp, updatedAt: timestamp, archivedAt: null, sortOrder: this.data.contents.length, version: 1, contentVersion: 1,
      checklist: source.checklist.map((item) => ({ ...item, id: id(), completed: false })), attachments: clone(source.attachments),
    };
    this.data.contents.push(duplicate); return clone(duplicate);
  }
  async saveCampaign(campaign: Campaign): Promise<Campaign> { return this.saveEntity("campaigns", campaign); }
  async saveIdea(idea: ContentIdea): Promise<ContentIdea> { return this.saveEntity("ideas", idea); }
  async saveTemplate(template: ContentTemplate): Promise<ContentTemplate> { return this.saveEntity("templates", template); }
  private async saveEntity<K extends "campaigns" | "ideas" | "templates", T extends Campaign | ContentIdea | ContentTemplate>(key: K, entity: T): Promise<T> {
    const list = this.data[key] as T[];
    const index = list.findIndex((item) => item.id === entity.id);
    const saved = { ...entity, updatedAt: now(), version: index >= 0 ? list[index].version + 1 : 1 };
    if (index >= 0) list[index] = saved; else list.push(saved);
    return clone(saved);
  }
  async deleteEntity(entity: "campaign" | "idea" | "template", entityId: string): Promise<void> {
    const key = entity === "campaign" ? "campaigns" : entity === "idea" ? "ideas" : "templates";
    this.data[key] = this.data[key].filter((item) => item.id !== entityId) as never;
  }
  async saveReference(kind: ReferenceKind, entity: ReferenceEntity): Promise<ReferenceEntity> {
    const key = ({ platform: "platforms", type: "types", status: "statuses", pillar: "pillars", tag: "tags" } as const)[kind];
    const list = this.data[key] as ReferenceEntity[];
    const index = list.findIndex((item) => item.id === entity.id);
    const saved = { ...entity, updatedAt: now(), version: index >= 0 ? list[index].version + 1 : 1 } as ReferenceEntity;
    if (index >= 0) list[index] = saved; else list.push(saved);
    return clone(saved);
  }
  async deleteReference(kind: ReferenceKind, entityId: string): Promise<void> {
    const key = ({ platform: "platforms", type: "types", status: "statuses", pillar: "pillars", tag: "tags" } as const)[kind];
    this.data[key] = this.data[key].filter((item) => item.id !== entityId) as never;
  }
  async getSettings(): Promise<AppSettings | null> { return clone(this.settings); }
  async saveSettings(settings: AppSettings): Promise<void> { this.settings = clone(settings); }
  async dashboard(): Promise<DashboardData> {
    const active = this.data.contents.filter((item) => !item.archivedAt);
    const today = todayIso();
    return clone({
      today: active.filter((item) => item.publicationDate === today),
      upcoming: active.filter((item) => item.publicationDate > today && item.publicationDate <= today.slice(0, 8) + "99").slice(0, 5),
      overdue: active.filter((item) => Boolean(item.deadline && item.deadline < today && !["published", "cancelled"].includes(item.status))),
      awaitingReview: active.filter((item) => item.status === "review"),
      scheduled: active.filter((item) => item.status === "scheduled"),
      recentlyPublished: active.filter((item) => item.status === "published").slice(0, 5),
    });
  }
  async reportSnapshot(filters: ReportFilters, viewer?: Pick<SafeUser, "id" | "role" | "team" | "dataScope" | "permissions">, page?: number, pageSize?: number): Promise<ReportSnapshot> {
    if (viewer) requirePermission(viewer, "reports.view", "به گزارش ها دسترسی ندارید.");
    return buildReportSnapshot(this.data, filters, viewer, page, pageSize);
  }
  async exportWorkspace(): Promise<string> { return JSON.stringify({ version: 1, exportedAt: now(), workspace: this.data, settings: this.settings }, null, 2); }
  async importWorkspace(raw: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    try {
      const parsed = JSON.parse(raw) as { workspace?: Partial<WorkspaceData>; settings?: AppSettings | null };
      if (!parsed.workspace || typeof parsed.workspace !== "object") throw new Error("ساختار فایل پشتیبان معتبر نیست.");
      const keys = ["contents", "platforms", "types", "statuses", "campaigns", "tags", "pillars", "ideas", "templates", "userProfiles", "activityLog", "learningMaterials", "highlights", "personalNotes", "adBudgets", "tasks", "chatConversations", "chatMembers", "chatMessages", "reminders", "pushSubscriptions", "notifications", "monitoringPlatforms", "monitoringPlatformCapabilities", "monitoringSources", "monitoringSourceCapabilities", "monitoringSnapshots", "monitoredContents", "monitoredContentSnapshots", "monitoringJobs", "monitoringDailyAggregates", "monitoringEvents"] as const;
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      for (const key of keys) {
        const incoming = parsed.workspace[key];
        if (incoming === undefined) continue;
        if (!Array.isArray(incoming)) { errors.push(`بخش ${key} آرایه نیست.`); continue; }
        const collection = this.data[key] as Array<{ id: string }>;
        const seen = new Set(collection.map((item) => item.id));
        for (const item of incoming) {
          if (!item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string") { errors.push(`یک رکورد نامعتبر در بخش ${key} نادیده گرفته شد.`); continue; }
          const record = item as { id: string };
          if (seen.has(record.id)) { skipped += 1; continue; }
          collection.push(clone(record) as never);
          seen.add(record.id);
          imported += 1;
        }
      }
      if (parsed.settings !== undefined) this.settings = clone(parsed.settings);
      return { imported, skipped, errors };
    } catch (error) { return { imported: 0, skipped: 0, errors: [error instanceof Error ? error.message : "خواندن فایل ممکن نشد."] }; }
  }
  async backup(): Promise<string> { return this.exportWorkspace(); }
  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    const index = this.data.userProfiles.findIndex((item) => item.userId === profile.userId);
    const saved: UserProfile = { ...profile, id: profile.userId, updatedAt: now() };
    if (index >= 0) this.data.userProfiles[index] = saved; else this.data.userProfiles.push(saved);
    return clone(saved);
  }
  async logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">): Promise<ActivityLogEntry> {
    const saved: ActivityLogEntry = { ...entry, id: id(), createdAt: now() };
    this.data.activityLog.unshift(saved);
    if (this.data.activityLog.length > 500) this.data.activityLog.length = 500;
    return clone(saved);
  }
  async saveLearningMaterial(material: LearningMaterial): Promise<LearningMaterial> {
    const index = this.data.learningMaterials.findIndex((item) => item.id === material.id);
    const saved: LearningMaterial = { ...material, id: material.id || id() };
    if (index >= 0) this.data.learningMaterials[index] = saved; else this.data.learningMaterials.push(saved);
    return clone(saved);
  }
  async deleteLearningMaterial(materialId: string): Promise<void> {
    this.data.learningMaterials = this.data.learningMaterials.filter((item) => item.id !== materialId);
    this.data.highlights = this.data.highlights.filter((item) => item.materialId !== materialId);
  }
  async saveHighlight(highlight: Omit<Highlight, "id" | "createdAt">): Promise<Highlight> {
    const saved: Highlight = { ...highlight, id: id(), createdAt: now() };
    this.data.highlights.push(saved);
    return clone(saved);
  }
  async deleteHighlight(highlightId: string): Promise<void> { this.data.highlights = this.data.highlights.filter((item) => item.id !== highlightId); }
  async savePersonalNote(note: PersonalNote): Promise<PersonalNote> {
    const index = this.data.personalNotes.findIndex((item) => item.id === note.id);
    const timestamp = now();
    const saved: PersonalNote = { ...note, id: note.id || id(), createdAt: index >= 0 ? this.data.personalNotes[index].createdAt : note.createdAt || timestamp, updatedAt: timestamp };
    if (index >= 0) this.data.personalNotes[index] = saved; else this.data.personalNotes.push(saved);
    return clone(saved);
  }
  async deletePersonalNote(noteId: string): Promise<void> { this.data.personalNotes = this.data.personalNotes.filter((item) => item.id !== noteId); }
  async saveAdBudget(budget: AdBudget): Promise<AdBudget> {
    const index = this.data.adBudgets.findIndex((item) => item.id === budget.id);
    const timestamp = now();
    const saved: AdBudget = { ...budget, id: budget.id || id(), createdAt: index >= 0 ? this.data.adBudgets[index].createdAt : budget.createdAt || timestamp, updatedAt: timestamp };
    if (index >= 0) this.data.adBudgets[index] = saved; else this.data.adBudgets.push(saved);
    return clone(saved);
  }
  async saveTask(task: TaskItem): Promise<TaskItem> {
    const index = this.data.tasks.findIndex((item) => item.id === task.id);
    const timestamp = now();
    const saved: TaskItem = index >= 0
      ? { ...this.data.tasks[index], ...task, updatedAt: timestamp, version: this.data.tasks[index].version + 1 }
      : { ...task, id: task.id || id(), createdAt: timestamp, updatedAt: timestamp, archivedAt: null, sortOrder: this.data.tasks.length, version: 1 };
    if (index >= 0) this.data.tasks[index] = saved; else this.data.tasks.push(saved);
    return clone(saved);
  }
  async deleteTask(taskId: string): Promise<void> { this.data.tasks = this.data.tasks.filter((item) => item.id !== taskId); }
  async listChatConversations(userId: string): Promise<ChatConversationSummary[]> {
    return clone(this.data.chatMembers.filter((member) => member.userId === userId).map((member) => this.chatSummary(member.conversationId, userId)).filter(Boolean).sort((a, b) => (b?.conversation.lastMessageAt ?? b?.conversation.updatedAt ?? "").localeCompare(a?.conversation.lastMessageAt ?? a?.conversation.updatedAt ?? "")) as ChatConversationSummary[]);
  }
  async listChatMessages(userId: string, conversationId: string, cursor?: string | null, limit = 40): Promise<ChatMessagePage> {
    this.requireChatMember(userId, conversationId);
    const boundedLimit = Math.min(Math.max(limit, 1), 80);
    const sorted = this.data.chatMessages.filter((message) => message.conversationId === conversationId && !message.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = cursor ? sorted.findIndex((message) => message.id === cursor) + 1 : 0;
    const page = sorted.slice(Math.max(start, 0), Math.max(start, 0) + boundedLimit);
    const nextCursor = page.length === boundedLimit ? page[page.length - 1]?.id ?? null : null;
    return clone({ messages: page.reverse(), nextCursor });
  }
  async createDirectChat(userId: string, peerUserId: string): Promise<ChatConversationSummary> {
    if (userId === peerUserId) throw new Error("گفتگوی مستقیم با خودتان ممکن نیست.");
    if (!this.data.userProfiles.some((profile) => profile.userId === peerUserId)) throw new Error("عضو تیم پیدا نشد.");
    const directKey = [userId, peerUserId].sort().join(":");
    const existing = this.data.chatConversations.find((conversation) => conversation.type === "DIRECT" && conversation.directKey === directKey);
    if (existing) return clone(this.chatSummary(existing.id, userId));
    const timestamp = now();
    const conversation: ChatConversation = { id: id(), type: "DIRECT", title: null, avatarUrl: null, createdBy: userId, createdAt: timestamp, updatedAt: timestamp, lastMessageAt: null, directKey };
    this.data.chatConversations.push(conversation);
    this.data.chatMembers.push({ conversationId: conversation.id, userId, role: "MEMBER", joinedAt: timestamp, lastReadAt: timestamp }, { conversationId: conversation.id, userId: peerUserId, role: "MEMBER", joinedAt: timestamp, lastReadAt: null });
    return clone(this.chatSummary(conversation.id, userId));
  }
  async createGroupChat(userId: string, title: string, memberIds: string[]): Promise<ChatConversationSummary> {
    const cleanTitle = sanitizeText(title).slice(0, 80);
    const uniqueMemberIds = [...new Set([userId, ...memberIds])].filter((memberId) => this.data.userProfiles.some((profile) => profile.userId === memberId));
    if (cleanTitle.length < 2) throw new Error("نام گروه باید حداقل دو کاراکتر باشد.");
    if (uniqueMemberIds.length < 2) throw new Error("گروه باید حداقل دو عضو داشته باشد.");
    const timestamp = now();
    const conversation: ChatConversation = { id: id(), type: "GROUP", title: cleanTitle, avatarUrl: null, createdBy: userId, createdAt: timestamp, updatedAt: timestamp, lastMessageAt: null, directKey: null };
    this.data.chatConversations.push(conversation);
    this.data.chatMembers.push(...uniqueMemberIds.map((memberId) => ({ conversationId: conversation.id, userId: memberId, role: (memberId === userId ? "OWNER" : "MEMBER") as ChatMemberRole, joinedAt: timestamp, lastReadAt: memberId === userId ? timestamp : null })));
    return clone(this.chatSummary(conversation.id, userId));
  }
  async sendChatMessage(userId: string, conversationId: string, body: string, clientMessageId: string, context?: { type: ChatContextType; id: string; metadata?: Record<string, string> | null }): Promise<ChatMessage> {
    this.requireChatMember(userId, conversationId);
    const cleanBody = sanitizeText(body).slice(0, 4000);
    if (!cleanBody) throw new Error("پیام خالی قابل ارسال نیست.");
    const duplicate = this.data.chatMessages.find((message) => message.conversationId === conversationId && message.senderId === userId && message.clientMessageId === clientMessageId);
    if (duplicate) return clone(duplicate);
    const timestamp = now();
    const message: ChatMessage = { id: id(), conversationId, senderId: userId, messageType: "TEXT", body: cleanBody, contextType: context?.type ?? null, contextId: context?.id ?? null, contextMetadata: context?.metadata ?? null, clientMessageId, createdAt: timestamp, editedAt: null, deletedAt: null };
    this.data.chatMessages.push(message);
    const conversation = this.data.chatConversations.find((item) => item.id === conversationId);
    if (conversation) { conversation.updatedAt = timestamp; conversation.lastMessageAt = timestamp; }
    const member = this.data.chatMembers.find((item) => item.conversationId === conversationId && item.userId === userId);
    if (member) member.lastReadAt = timestamp;
    this.data.chatMembers.filter((item) => item.conversationId === conversationId && item.userId !== userId && !item.mutedAt).forEach((recipient) => {
      this.data.notifications.unshift({ id: id(), userId: recipient.userId, type: "chat", title: "پیام جدید", body: cleanBody.slice(0, 160), relatedEntityType: "conversation", relatedEntityId: conversationId, actionUrl: "#/chat", priority: "normal", readAt: null, createdAt: timestamp, expiresAt: null });
    });
    return clone(message);
  }
  async markChatRead(userId: string, conversationId: string): Promise<void> {
    const member = this.requireChatMember(userId, conversationId);
    member.lastReadAt = now();
  }
  async purgeUserData(userId: string): Promise<void> {
    this.data.userProfiles = this.data.userProfiles.filter((item) => item.userId !== userId);
    this.data.personalNotes = this.data.personalNotes.filter((item) => item.userId !== userId);
    this.data.tasks = this.data.tasks.filter((item) => item.assigneeUserId !== userId && item.createdByUserId !== userId);
    this.data.highlights = this.data.highlights.filter((item) => item.userId !== userId);
    this.data.chatMessages = this.data.chatMessages.filter((item) => item.senderId !== userId);
    this.data.chatMembers = this.data.chatMembers.filter((item) => item.userId !== userId);
    const conversationIds = new Set(this.data.chatMembers.map((item) => item.conversationId));
    this.data.chatConversations = this.data.chatConversations.filter((item) => conversationIds.has(item.id));
    this.data.chatMessages = this.data.chatMessages.filter((item) => conversationIds.has(item.conversationId));
    this.data.reminders = this.data.reminders.filter((item) => item.userId !== userId && item.createdBy !== userId);
    this.data.pushSubscriptions = this.data.pushSubscriptions.filter((item) => item.userId !== userId);
    this.data.notifications = this.data.notifications.filter((item) => item.userId !== userId);
  }
  async listNotifications(userId: string, cursor?: string | null, limit = 30): Promise<{ notifications: AppNotification[]; unreadCount: number; nextCursor?: string | null }> {
    const boundedLimit = Math.min(Math.max(limit, 1), 80);
    const sorted = this.data.notifications.filter((item) => item.userId === userId && (!item.expiresAt || item.expiresAt > now())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = cursor ? sorted.findIndex((item) => item.id === cursor) + 1 : 0;
    const page = sorted.slice(Math.max(start, 0), Math.max(start, 0) + boundedLimit);
    return clone({ notifications: page, unreadCount: sorted.filter((item) => !item.readAt).length, nextCursor: page.length === boundedLimit ? page[page.length - 1]?.id ?? null : null });
  }
  async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    const item = this.data.notifications.find((notification) => notification.id === notificationId && notification.userId === userId);
    if (item && !item.readAt) item.readAt = now();
  }
  async markAllNotificationsRead(userId: string): Promise<void> {
    const timestamp = now();
    this.data.notifications.filter((item) => item.userId === userId && !item.readAt).forEach((item) => { item.readAt = timestamp; });
  }
  async saveReminder(reminder: Reminder): Promise<Reminder> {
    const index = this.data.reminders.findIndex((item) => item.id === reminder.id);
    const timestamp = now();
    const saved: Reminder = { ...reminder, id: reminder.id || id(), title: sanitizeText(reminder.title).slice(0, 160), body: reminder.body ? sanitizeText(reminder.body).slice(0, 500) : null, updatedAt: timestamp, createdAt: index >= 0 ? this.data.reminders[index].createdAt : reminder.createdAt || timestamp, deduplicationKey: reminder.deduplicationKey || `${reminder.userId}:${reminder.relatedEntityType}:${reminder.relatedEntityId ?? reminder.id}:${reminder.scheduledForUtc}` };
    if (index >= 0) this.data.reminders[index] = saved; else this.data.reminders.push(saved);
    return clone(saved);
  }
  async listReminders(userId: string, relatedEntityType?: ReminderRelatedEntityType, relatedEntityId?: string): Promise<Reminder[]> {
    return clone(this.data.reminders.filter((item) => item.userId === userId && (!relatedEntityType || item.relatedEntityType === relatedEntityType) && (!relatedEntityId || item.relatedEntityId === relatedEntityId)).sort((a, b) => a.scheduledForUtc.localeCompare(b.scheduledForUtc)));
  }
  async cancelReminder(userId: string, reminderId: string): Promise<void> {
    const item = this.data.reminders.find((reminder) => reminder.id === reminderId && reminder.userId === userId);
    if (item) { item.status = "CANCELLED"; item.cancelledAt = now(); item.updatedAt = now(); }
  }
  async snoozeReminder(userId: string, reminderId: string, minutes: number): Promise<Reminder> {
    const item = this.data.reminders.find((reminder) => reminder.id === reminderId && reminder.userId === userId);
    if (!item) throw new Error("یادآور پیدا نشد.");
    const date = new Date();
    date.setMinutes(date.getMinutes() + Math.max(1, minutes));
    item.status = "SNOOZED"; item.scheduledForUtc = date.toISOString(); item.updatedAt = now(); item.retryCount = 0;
    return clone(item);
  }
  async savePushSubscription(subscription: PushSubscriptionRecord): Promise<PushSubscriptionRecord> {
    const timestamp = now();
    const existing = this.data.pushSubscriptions.findIndex((item) => item.endpoint === subscription.endpoint);
    const saved: PushSubscriptionRecord = { ...subscription, id: existing >= 0 ? this.data.pushSubscriptions[existing].id : subscription.id || id(), createdAt: existing >= 0 ? this.data.pushSubscriptions[existing].createdAt : subscription.createdAt || timestamp, updatedAt: timestamp, failureCount: existing >= 0 ? this.data.pushSubscriptions[existing].failureCount : subscription.failureCount ?? 0, revokedAt: null };
    if (existing >= 0) this.data.pushSubscriptions[existing] = saved; else this.data.pushSubscriptions.push(saved);
    return clone(saved);
  }
  async revokePushSubscription(userId: string, subscriptionId: string): Promise<void> {
    const item = this.data.pushSubscriptions.find((subscription) => subscription.id === subscriptionId && subscription.userId === userId);
    if (item) { item.revokedAt = now(); item.updatedAt = now(); }
  }
  async listPushSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
    return clone(this.data.pushSubscriptions.filter((item) => item.userId === userId && !item.revokedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  async processDueReminders(atUtc = now()): Promise<{ processed: number; notificationsCreated: number; failed: number }> {
    const due = this.data.reminders.filter((item) => (item.status === "SCHEDULED" || item.status === "SNOOZED" || item.status === "FAILED") && item.scheduledForUtc <= atUtc).slice(0, 50);
    let notificationsCreated = 0;
    let failed = 0;
    for (const reminder of due) {
      if (this.data.notifications.some((item) => item.relatedEntityType === reminder.relatedEntityType && item.relatedEntityId === (reminder.relatedEntityId ?? reminder.id) && item.createdAt >= reminder.scheduledForUtc && item.userId === reminder.userId)) {
        reminder.status = "SENT"; reminder.sentAt = now(); reminder.updatedAt = now();
        continue;
      }
      try {
        reminder.status = "PROCESSING"; reminder.updatedAt = now();
        this.data.notifications.unshift({ id: id(), userId: reminder.userId, type: reminder.relatedEntityType === "task" ? "reminder" : "deadline", title: reminder.title, body: reminder.body ?? null, relatedEntityType: reminder.relatedEntityType, relatedEntityId: reminder.relatedEntityId ?? reminder.id, actionUrl: reminder.relatedEntityType === "task" ? "#/tasks" : "#/calendar", priority: reminder.priority, readAt: null, createdAt: now(), expiresAt: null });
        reminder.status = "SENT"; reminder.sentAt = now(); reminder.updatedAt = now();
        notificationsCreated += 1;
      } catch {
        reminder.status = "FAILED"; reminder.retryCount += 1; reminder.updatedAt = now(); failed += 1;
      }
    }
    return { processed: due.length, notificationsCreated, failed };
  }
  async monitoringOverview(): Promise<MonitoringOverview> {
    return clone(monitoringOverview(this.data));
  }
  async saveMonitoringSource(source: MonitoringSource, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<MonitoringSource> {
    if (viewer) requirePermission(viewer, "settings.update", "برای تغییر منابع مانیتورینگ دسترسی ندارید.");
    const validation = validateMonitoringSource(this.data, source);
    if (!validation.ok) throw new Error(validation.message);
    const timestamp = now();
    const index = this.data.monitoringSources.findIndex((item) => item.id === source.id);
    const existing = index >= 0 ? this.data.monitoringSources[index] : null;
    const saved: MonitoringSource = {
      ...source,
      id: source.id || id(),
      normalizedUrl: validation.normalizedUrl,
      createdAt: existing?.createdAt ?? source.createdAt ?? timestamp,
      updatedAt: timestamp,
      archivedAt: source.archivedAt ?? existing?.archivedAt ?? null,
      sortOrder: existing?.sortOrder ?? this.data.monitoringSources.length,
      version: (existing?.version ?? 0) + 1,
      createdBy: source.createdBy ?? viewer?.id ?? null,
    };
    if (existing && existing.normalizedUrl !== saved.normalizedUrl && !source.identityChangedAt) {
      saved.identityChangedAt = timestamp;
      saved.identityChangeNote = "آدرس منبع تغییر کرد؛ تاریخچه قبلی حفظ شده و تغییر هویت علامت گذاری شد.";
    }
    if (index >= 0) this.data.monitoringSources[index] = saved; else this.data.monitoringSources.push(saved);
    this.data.monitoringEvents.unshift({ id: id(), sourceId: saved.id, platformKey: saved.platformKey, eventType: index >= 0 ? "SOURCE_UPDATED" : "SOURCE_ADDED", title: index >= 0 ? "منبع مانیتورینگ ویرایش شد" : "منبع مانیتورینگ اضافه شد", metadata: { displayName: saved.displayName }, occurredAt: timestamp, createdAt: timestamp });
    return clone(saved);
  }
  async archiveMonitoringSource(sourceId: string, archived: boolean, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<void> {
    if (viewer) requirePermission(viewer, "settings.update", "برای بایگانی منابع مانیتورینگ دسترسی ندارید.");
    const source = this.data.monitoringSources.find((item) => item.id === sourceId);
    if (!source) return;
    source.archivedAt = archived ? now() : null;
    source.enabled = !archived;
    source.updatedAt = now();
  }
  async saveMonitoringPlatform(platform: MonitoringPlatform, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<MonitoringPlatform> {
    if (viewer) requirePermission(viewer, "settings.update", "برای تغییر پلتفرم های مانیتورینگ دسترسی ندارید.");
    const index = this.data.monitoringPlatforms.findIndex((item) => item.key === platform.key);
    const saved = { ...platform, updatedAt: now(), version: index >= 0 ? this.data.monitoringPlatforms[index].version + 1 : 1 };
    if (index >= 0) this.data.monitoringPlatforms[index] = saved; else this.data.monitoringPlatforms.push(saved);
    return clone(saved);
  }
  async runMonitoringCollection(triggerType: MonitoringJobTrigger = "MANUAL", sourceId?: string | null, viewer?: Pick<SafeUser, "id" | "permissions">): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (viewer && triggerType === "MANUAL") requirePermission(viewer, "settings.update", "برای اجرای دستی مانیتورینگ دسترسی ندارید.");
    return runMonitoringCollection(this.data, triggerType, sourceId);
  }
  async technicalHealth(viewer?: Pick<SafeUser, "id" | "permissions">): Promise<TechnicalHealthOverview> {
    if (viewer) requirePermission(viewer, "technical_health.read", "برای مشاهده سلامت سامانه دسترسی ندارید.");
    return clone(buildTechnicalHealthOverview(this.data));
  }
  private requireChatMember(userId: string, conversationId: string): ChatConversationMember {
    const member = this.data.chatMembers.find((item) => item.userId === userId && item.conversationId === conversationId);
    if (!member) throw new Error("به این گفتگو دسترسی ندارید.");
    return member;
  }
  private chatSummary(conversationId: string, viewerId: string): ChatConversationSummary {
    const conversation = this.data.chatConversations.find((item) => item.id === conversationId);
    if (!conversation) throw new Error("گفتگو پیدا نشد.");
    const members = this.data.chatMembers.filter((member) => member.conversationId === conversationId);
    const viewer = members.find((member) => member.userId === viewerId);
    if (!viewer) throw new Error("به این گفتگو دسترسی ندارید.");
    const messages = this.data.chatMessages.filter((message) => message.conversationId === conversationId && !message.deletedAt);
    const lastMessage = messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const unreadCount = messages.filter((message) => message.senderId !== viewerId && (!viewer.lastReadAt || message.createdAt > viewer.lastReadAt)).length;
    return { conversation, members, unreadCount, lastMessage };
  }
}

function sanitizeText(value: string): string {
  return value.replace(/[<>]/g, "").replace(/\s+$/g, "").trimStart();
}
