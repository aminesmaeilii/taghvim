import { DEFAULT_PILLARS, DEFAULT_PLATFORMS, DEFAULT_STATUSES, DEFAULT_TYPES } from "../constants/defaults.js";
import type { ActivityLogEntry, AdBudget, AppSettings, Campaign, Content, ContentFilters, ContentIdea, ContentTemplate, ContentPillar, ContentStatus, ContentType, DashboardData, Highlight, KpiEntry, LearningMaterial, PersonalNote, Platform, Tag, UserProfile, WorkspaceData } from "../types/domain.js";
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
  exportWorkspace(): Promise<string>;
  importWorkspace(raw: string): Promise<{ imported: number; skipped: number; errors: string[] }>;
  backup(): Promise<string>;
  saveProfile(profile: UserProfile): Promise<UserProfile>;
  logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">): Promise<ActivityLogEntry>;
  saveKpiEntry(entry: Omit<KpiEntry, "id" | "recordedAt">): Promise<KpiEntry>;
  saveLearningMaterial(material: LearningMaterial): Promise<LearningMaterial>;
  deleteLearningMaterial(id: string): Promise<void>;
  saveHighlight(highlight: Omit<Highlight, "id" | "createdAt">): Promise<Highlight>;
  deleteHighlight(id: string): Promise<void>;
  savePersonalNote(note: PersonalNote): Promise<PersonalNote>;
  deletePersonalNote(id: string): Promise<void>;
  saveAdBudget(budget: AdBudget): Promise<AdBudget>;
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
    userProfiles: [], activityLog: [], kpiEntries: [],
    learningMaterials: [], highlights: [], personalNotes: [], adBudgets: [],
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
      score: null,
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
      score: null,
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
    this.data.kpiEntries ??= [];
    this.data.learningMaterials ??= [];
    this.data.highlights ??= [];
    this.data.personalNotes ??= [];
    this.data.adBudgets ??= [];
    this.settings = clone(snapshot.settings);
  }

  ensureDefaults(): boolean { return ensureDefaultReferences(this.data) || seedStarterWorkspace(this.data); }
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
  async exportWorkspace(): Promise<string> { return JSON.stringify({ version: 1, exportedAt: now(), workspace: this.data, settings: this.settings }, null, 2); }
  async importWorkspace(raw: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    try {
      const parsed = JSON.parse(raw) as { workspace?: Partial<WorkspaceData>; settings?: AppSettings | null };
      if (!parsed.workspace || typeof parsed.workspace !== "object") throw new Error("ساختار فایل پشتیبان معتبر نیست.");
      const keys = ["contents", "platforms", "types", "statuses", "campaigns", "tags", "pillars", "ideas", "templates", "userProfiles", "activityLog", "kpiEntries", "learningMaterials", "highlights", "personalNotes", "adBudgets"] as const;
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
  async saveKpiEntry(entry: Omit<KpiEntry, "id" | "recordedAt">): Promise<KpiEntry> {
    const saved: KpiEntry = { ...entry, id: id(), recordedAt: now() };
    this.data.kpiEntries.push(saved);
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
}
