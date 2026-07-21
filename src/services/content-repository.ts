import { DEFAULT_PILLARS, DEFAULT_PLATFORMS, DEFAULT_STATUSES, DEFAULT_TYPES } from "../constants/defaults";
import { isDesktopRuntime, platformInvoke } from "./platform";
import type { AppSettings, Campaign, Content, ContentFilters, ContentIdea, ContentTemplate, ContentPillar, ContentStatus, ContentType, DashboardData, Platform, Tag, WorkspaceData } from "../types/domain";
import { todayIso } from "../utils/jalali";

type NewContent = Omit<Content, "id" | "createdAt" | "updatedAt" | "archivedAt" | "sortOrder" | "version" | "contentVersion">;
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
}

function now(): string { return new Date().toISOString(); }
function id(): string { return crypto.randomUUID(); }
function clone<T>(value: T): T { return structuredClone(value); }

function createWorkspace(): WorkspaceData {
  return {
    contents: [],
    platforms: clone(DEFAULT_PLATFORMS),
    types: clone(DEFAULT_TYPES),
    statuses: clone(DEFAULT_STATUSES),
    campaigns: [], tags: [], pillars: clone(DEFAULT_PILLARS), ideas: [], templates: [],
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

class MemoryRepository implements ContentRepository {
  protected data = createWorkspace();
  protected settings: AppSettings | null = null;

  snapshot(): { workspace: WorkspaceData; settings: AppSettings | null } {
    return { workspace: clone(this.data), settings: clone(this.settings) };
  }

  restore(snapshot: { workspace: WorkspaceData; settings: AppSettings | null }): void {
    this.data = clone(snapshot.workspace);
    this.settings = clone(snapshot.settings);
  }

  ensureDefaults(): boolean { return ensureDefaultReferences(this.data); }
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
      const keys = ["contents", "platforms", "types", "statuses", "campaigns", "tags", "pillars", "ideas", "templates"] as const;
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
}

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
  exportWorkspace() { return this.run(() => this.memory.exportWorkspace()); }
  importWorkspace(raw: string) { return this.run(async () => this.memory.importWorkspace(raw).then(async (result) => { if (result.imported > 0) await writeBrowserSnapshot({ id: "workspace", ...this.memory.snapshot() }); return result; })); }
  backup() { return this.run(() => this.memory.backup()); }
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
  exportWorkspace() { return this.call<string>("export_workspace"); }
  importWorkspace(raw: string) { return this.call<{ imported: number; skipped: number; errors: string[] }>("import_workspace", { raw }); }
  backup() { return this.call<string>("create_backup"); }
}

export const contentRepository: ContentRepository = isDesktopRuntime
  ? new TauriRepository()
  : hasIndexedDb() ? new BrowserRepository() : new MemoryRepository();
