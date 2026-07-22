import { isDesktopRuntime, platformInvoke } from "./platform";
import { API_BASE_URL, USE_REMOTE_API } from "./api-config";
import { MemoryRepository, type ContentRepository, type NewContent, type ReferenceEntity, type ReferenceKind } from "@shared/services/workspace-memory-repository";
import type { ActivityLogEntry, AdBudget, AppSettings, Campaign, Content, ContentFilters, ContentIdea, ContentTemplate, DashboardData, Highlight, LearningMaterial, PersonalNote, TaskItem, UserProfile, WorkspaceData } from "@shared/types/domain";

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
}

class ApiRepository implements ContentRepository {
  constructor(private readonly baseUrl: string) {}

  private async call<T>(method: keyof ContentRepository, args: unknown[] = []): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/workspace`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, args }),
    });
    const payload = await response.json().catch(() => null) as { data?: T; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "Backend request failed.");
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
}

export const contentRepository: ContentRepository = isDesktopRuntime
  ? new TauriRepository()
  : USE_REMOTE_API ? new ApiRepository(API_BASE_URL)
    : hasIndexedDb() ? new BrowserRepository() : new MemoryRepository();
