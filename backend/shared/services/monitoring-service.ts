import { DEFAULT_MONITORING_PLATFORM_CAPABILITIES, DEFAULT_MONITORING_PLATFORMS, DEFAULT_MONITORING_SOURCES } from "../constants/defaults.js";
import type { AppNotification, MonitoringCapabilityKey, MonitoringDataQuality, MonitoringEvent, MonitoringJob, MonitoringJobTrigger, MonitoringMetricValue, MonitoringOverview, MonitoringPlatform, MonitoringPlatformCapability, MonitoringSnapshot, MonitoringSource, MonitoringSourceCapability, WorkspaceData } from "../types/domain.js";

type ConnectorResult = {
  dataQuality: MonitoringDataQuality;
  collectionMethod: MonitoringSnapshot["collectionMethod"];
  metrics: MonitoringMetricValue[];
  capabilities: MonitoringSourceCapability[];
  safeErrorMessage?: string | null;
};

export interface MonitoringConnector {
  key: string;
  version: string;
  validateSourceInput(source: MonitoringSource, platform: MonitoringPlatform): { ok: true; normalizedUrl: string } | { ok: false; message: string };
  collect(source: MonitoringSource, platform: MonitoringPlatform, capabilities: MonitoringPlatformCapability[]): Promise<ConnectorResult>;
}

export function ensureMonitoringDefaults(workspace: WorkspaceData): boolean {
  let changed = false;
  workspace.monitoringPlatforms ??= [];
  workspace.monitoringPlatformCapabilities ??= [];
  workspace.monitoringSources ??= [];
  workspace.monitoringSourceCapabilities ??= [];
  workspace.monitoringSnapshots ??= [];
  workspace.monitoredContents ??= [];
  workspace.monitoredContentSnapshots ??= [];
  workspace.monitoringJobs ??= [];
  workspace.monitoringDailyAggregates ??= [];
  workspace.monitoringEvents ??= [];
  for (const platform of DEFAULT_MONITORING_PLATFORMS) {
    if (!workspace.monitoringPlatforms.some((item) => item.key === platform.key)) { workspace.monitoringPlatforms.push(structuredClone(platform)); changed = true; }
  }
  for (const capability of DEFAULT_MONITORING_PLATFORM_CAPABILITIES) {
    if (!workspace.monitoringPlatformCapabilities.some((item) => item.platformKey === capability.platformKey && item.capabilityKey === capability.capabilityKey)) { workspace.monitoringPlatformCapabilities.push(structuredClone(capability)); changed = true; }
  }
  for (const source of DEFAULT_MONITORING_SOURCES) {
    if (!workspace.monitoringSources.some((item) => item.id === source.id)) { workspace.monitoringSources.push(structuredClone(source)); changed = true; }
  }
  return changed;
}

export function monitoringOverview(workspace: WorkspaceData): MonitoringOverview {
  ensureMonitoringDefaults(workspace);
  const today = new Date().toISOString().slice(0, 10);
  const enabled = workspace.monitoringSources.filter((source) => source.enabled && !source.archivedAt);
  const latestSuccess = workspace.monitoringJobs.filter((job) => job.status === "SUCCESS" || job.status === "PARTIAL").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
  return {
    generatedAt: new Date().toISOString(),
    activeSources: enabled.length,
    supportedPlatforms: workspace.monitoringPlatforms.filter((item) => item.enabled).length,
    updatedToday: enabled.filter((source) => latestSnapshot(workspace, source.id)?.snapshotDate === today).length,
    awaitingCollection: enabled.filter((source) => isDueForCollection(workspace, source, new Date())).length,
    staleSources: enabled.filter((source) => isStale(workspace, source)).length,
    errorSources: enabled.filter((source) => latestJob(workspace, source.id)?.status === "FAILED").length,
    lastSuccessfulCollection: latestSuccess?.completedAt ?? null,
    nextScheduledBatch: nextDue(enabled),
    dataQuality: enabled.some((source) => isStale(workspace, source)) ? "STALE" : "PARTIAL",
    platforms: workspace.monitoringPlatforms.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    sources: enabled.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((source) => ({ ...source, platform: workspace.monitoringPlatforms.find((item) => item.key === source.platformKey), latestSnapshot: latestSnapshot(workspace, source.id), latestJob: latestJob(workspace, source.id), sparkline: sparkline(workspace, source.id), capabilities: workspace.monitoringSourceCapabilities.filter((item) => item.sourceId === source.id) })),
    events: workspace.monitoringEvents.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 30),
  };
}

export async function runMonitoringCollection(workspace: WorkspaceData, triggerType: MonitoringJobTrigger, sourceId?: string | null): Promise<{ processed: number; succeeded: number; failed: number }> {
  ensureMonitoringDefaults(workspace);
  const now = new Date();
  const due = workspace.monitoringSources.filter((source) => source.enabled && source.collectionEnabled && !source.archivedAt && (!sourceId || source.id === sourceId) && (triggerType === "MANUAL" || isDueForCollection(workspace, source, now))).slice(0, 30);
  let succeeded = 0;
  let failed = 0;
  for (const source of due) {
    const platform = workspace.monitoringPlatforms.find((item) => item.key === source.platformKey && item.enabled);
    if (!platform) { failed += 1; continue; }
    const connector = connectorRegistry[platform.connectorKey] ?? limitedConnector(platform.connectorKey, platform.connectorVersion);
    const validation = connector.validateSourceInput(source, platform);
    const job = createJob(source, platform, triggerType);
    workspace.monitoringJobs.unshift(job);
    if (!validation.ok) {
      finishJob(workspace, job, "FAILED", 0, "INVALID_URL", validation.message);
      failed += 1;
      continue;
    }
    source.normalizedUrl = validation.normalizedUrl;
    try {
      job.status = "RUNNING"; job.startedAt = new Date().toISOString();
      const result = await connector.collect(source, platform, workspace.monitoringPlatformCapabilities.filter((item) => item.platformKey === platform.key));
      const snapshot = saveSnapshot(workspace, source, job, result);
      finishJob(workspace, job, result.dataQuality === "INVALID" ? "FAILED" : result.dataQuality === "COMPLETE" ? "SUCCESS" : "PARTIAL", snapshot.normalizedMetrics.length, null, result.safeErrorMessage ?? null);
      mergeCapabilities(workspace, result.capabilities);
      addEvent(workspace, { sourceId: source.id, platformKey: platform.key, eventType: "COLLECTION_COMPLETED", title: `${source.displayName} به روزرسانی شد`, metadata: { triggerType, quality: result.dataQuality } });
      succeeded += 1;
    } catch (error) {
      finishJob(workspace, job, "FAILED", 0, "CONNECTOR_FAILURE", error instanceof Error ? error.message : "دریافت داده ممکن نشد.");
      addEvent(workspace, { sourceId: source.id, platformKey: platform.key, eventType: "COLLECTION_FAILED", title: `دریافت ${source.displayName} ناموفق بود`, metadata: { triggerType } });
      failed += 1;
    }
  }
  if (failed > 0) createFailureNotifications(workspace);
  return { processed: due.length, succeeded, failed };
}

export function validateMonitoringSource(workspace: WorkspaceData, source: MonitoringSource): { ok: true; normalizedUrl: string } | { ok: false; message: string } {
  ensureMonitoringDefaults(workspace);
  const platform = workspace.monitoringPlatforms.find((item) => item.key === source.platformKey && item.enabled);
  if (!platform) return { ok: false, message: "پلتفرم انتخاب شده فعال یا ثبت شده نیست." };
  return (connectorRegistry[platform.connectorKey] ?? limitedConnector(platform.connectorKey, platform.connectorVersion)).validateSourceInput(source, platform);
}

function limitedConnector(key: string, version: string): MonitoringConnector {
  return {
    key,
    version,
    validateSourceInput(source, platform) {
      try {
        const url = new URL(source.sourceUrl);
        if (url.protocol !== "https:") return { ok: false, message: "فقط آدرس امن https مجاز است." };
        if (!platform.allowedDomains.includes(url.hostname)) return { ok: false, message: "دامنه این آدرس در رجیستری پلتفرم مجاز نیست." };
        if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname) || url.hostname.endsWith(".local")) return { ok: false, message: "آدرس های محلی و خصوصی مجاز نیستند." };
        url.hash = "";
        return { ok: true, normalizedUrl: url.toString().replace(/\/$/, "") };
      } catch {
        return { ok: false, message: "ساختار آدرس معتبر نیست." };
      }
    },
    async collect(source, _platform, capabilities) {
      const supported = capabilities.filter((item) => item.supported).map((item) => item.capabilityKey);
      return {
        dataQuality: "PARTIAL",
        collectionMethod: "CONNECTOR_LIMITATION",
        safeErrorMessage: "در نسخه بتا داده عددی قابل اتکا از این منبع دریافت نشد؛ تاریخچه سلامت و دسترس پذیری ثبت شد.",
        metrics: [
          metric("PROFILE_INFORMATION", undefined, source.displayName, supported.includes("PROFILE_INFORMATION") ? "RESTRICTED" : "UNAVAILABLE"),
          metric("LATEST_CONTENT_DATE", undefined, null, "UNAVAILABLE"),
          metric("PUBLISHING_FREQUENCY", undefined, null, "UNAVAILABLE"),
        ],
        capabilities: capabilities.map((item) => ({ sourceId: source.id, capabilityKey: item.capabilityKey, supported: item.supported, supportLevel: item.supportLevel, lastDetectedAt: new Date().toISOString(), limitationReason: item.limitationReason ?? null })),
      };
    },
  };
}

const connectorRegistry: Record<string, MonitoringConnector> = Object.fromEntries(DEFAULT_MONITORING_PLATFORMS.map((platform) => [platform.connectorKey, limitedConnector(platform.connectorKey, platform.connectorVersion)]));

function createJob(source: MonitoringSource, platform: MonitoringPlatform, triggerType: MonitoringJobTrigger): MonitoringJob {
  const timestamp = new Date().toISOString();
  return { id: crypto.randomUUID(), platformKey: platform.key, sourceId: source.id, batchId: `${triggerType}:${timestamp.slice(0, 10)}`, triggerType, scheduledFor: timestamp, status: "QUEUED", startedAt: null, completedAt: null, recordsCollected: 0, retryCount: 0, errorCode: null, safeErrorMessage: null, createdAt: timestamp };
}

function saveSnapshot(workspace: WorkspaceData, source: MonitoringSource, job: MonitoringJob, result: ConnectorResult): MonitoringSnapshot {
  const timestamp = new Date().toISOString();
  const snapshotDate = timestamp.slice(0, 10);
  const existing = workspace.monitoringSnapshots.find((item) => item.sourceId === source.id && item.snapshotDate === snapshotDate);
  const snapshot: MonitoringSnapshot = { id: existing?.id ?? crypto.randomUUID(), sourceId: source.id, collectedAt: timestamp, snapshotDate, collectionJobId: job.id, dataQuality: result.dataQuality, collectionMethod: result.collectionMethod, normalizedMetrics: result.metrics, createdAt: existing?.createdAt ?? timestamp };
  if (existing) Object.assign(existing, snapshot); else workspace.monitoringSnapshots.push(snapshot);
  workspace.monitoringDailyAggregates = workspace.monitoringDailyAggregates.filter((item) => !(item.sourceId === source.id && item.date === snapshotDate));
  for (const item of result.metrics.filter((metricValue) => metricValue.numericValue !== undefined && metricValue.numericValue !== null)) {
    workspace.monitoringDailyAggregates.push({ sourceId: source.id, date: snapshotDate, metricKey: item.capabilityKey, openingValue: item.numericValue ?? null, closingValue: item.numericValue ?? null, minimumValue: item.numericValue ?? null, maximumValue: item.numericValue ?? null, changeValue: null, changePercentage: null, sampleCount: 1, dataCompleteness: result.dataQuality });
  }
  return snapshot;
}

function finishJob(workspace: WorkspaceData, job: MonitoringJob, status: MonitoringJob["status"], records: number, code: string | null, message: string | null) {
  job.status = status; job.recordsCollected = records; job.errorCode = code; job.safeErrorMessage = message; job.completedAt = new Date().toISOString();
  workspace.monitoringJobs = workspace.monitoringJobs.slice(0, 500);
}

function mergeCapabilities(workspace: WorkspaceData, capabilities: MonitoringSourceCapability[]) {
  for (const capability of capabilities) {
    const index = workspace.monitoringSourceCapabilities.findIndex((item) => item.sourceId === capability.sourceId && item.capabilityKey === capability.capabilityKey);
    if (index >= 0) workspace.monitoringSourceCapabilities[index] = capability; else workspace.monitoringSourceCapabilities.push(capability);
  }
}

function metric(capabilityKey: MonitoringCapabilityKey, numericValue?: number, textValue?: string | null, qualityStatus: MonitoringMetricValue["qualityStatus"] = "UNAVAILABLE"): MonitoringMetricValue {
  return { capabilityKey, numericValue: numericValue ?? null, textValue: textValue ?? null, unit: null, observed: qualityStatus !== "UNAVAILABLE", estimated: false, qualityStatus };
}

function latestSnapshot(workspace: WorkspaceData, sourceId: string) { return workspace.monitoringSnapshots.filter((item) => item.sourceId === sourceId).sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))[0] ?? null; }
function latestJob(workspace: WorkspaceData, sourceId: string) { return workspace.monitoringJobs.filter((item) => item.sourceId === sourceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null; }
function isDueForCollection(workspace: WorkspaceData, source: MonitoringSource, now: Date): boolean {
  const latest = latestSnapshot(workspace, source.id);
  if (!latest) return true;
  return now.getTime() - new Date(latest.collectedAt).getTime() >= source.collectionIntervalMinutes * 60_000;
}
function isStale(workspace: WorkspaceData, source: MonitoringSource): boolean {
  const latest = latestSnapshot(workspace, source.id);
  if (!latest) return true;
  return Date.now() - new Date(latest.collectedAt).getTime() > source.freshnessThresholdHours * 3_600_000;
}
function nextDue(sources: MonitoringSource[]): string | null {
  if (!sources.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return `${today}T${sources[0].dailyCollectionTime}:00.000Z`;
}
function sparkline(workspace: WorkspaceData, sourceId: string): number[] {
  return workspace.monitoringSnapshots.filter((item) => item.sourceId === sourceId).sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)).slice(-14).map((_item, index) => index + 1);
}
function addEvent(workspace: WorkspaceData, event: Omit<MonitoringEvent, "id" | "occurredAt" | "createdAt">) {
  const timestamp = new Date().toISOString();
  workspace.monitoringEvents.unshift({ ...event, id: crypto.randomUUID(), occurredAt: timestamp, createdAt: timestamp });
  workspace.monitoringEvents = workspace.monitoringEvents.slice(0, 300);
}
function createFailureNotifications(workspace: WorkspaceData) {
  const admins = workspace.userProfiles.slice(0, 3);
  const timestamp = new Date().toISOString();
  admins.forEach((profile) => {
    const duplicate = workspace.notifications.some((item) => item.userId === profile.userId && item.type === "campaign" && item.title.includes("مانیتورینگ") && item.createdAt.slice(0, 10) === timestamp.slice(0, 10));
    if (!duplicate) {
      const notification: AppNotification = { id: crypto.randomUUID(), userId: profile.userId, type: "campaign", title: "خطای مانیتورینگ شبکه ها", body: "یک یا چند منبع مانیتورینگ نیازمند بررسی است.", relatedEntityType: null, relatedEntityId: null, actionUrl: "#/monitoring", priority: "normal", readAt: null, createdAt: timestamp, expiresAt: null };
      workspace.notifications.unshift(notification);
    }
  });
}
