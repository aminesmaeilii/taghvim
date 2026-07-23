import type { MonitoringDataQuality, MonitoringJobStatus, WorkspaceData } from "../types/domain.js";

export type ObservabilityLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type TechnicalServiceStatus = "HEALTHY" | "WARNING" | "DEGRADED" | "DOWN" | "UNKNOWN" | "CHECKING";

export interface StructuredLogEntry {
  timestamp: string;
  level: ObservabilityLevel;
  environment: string;
  service: string;
  applicationVersion: string;
  commitSha?: string | null;
  event: string;
  requestId?: string | null;
  correlationId?: string | null;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  jobId?: string | null;
  batchId?: string | null;
  connectorKey?: string | null;
  sourceId?: string | null;
  errorCode?: string | null;
  retryCount?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ObservabilityMetric {
  name: string;
  value: number;
  unit: "count" | "ms" | "percent" | "seconds" | "items";
  labels?: Record<string, string>;
}

export interface TechnicalServiceHealth {
  key: string;
  labelFa: string;
  status: TechnicalServiceStatus;
  summary: string;
  lastCheckedAt: string;
  metrics: ObservabilityMetric[];
}

export interface TechnicalHealthOverview {
  generatedAt: string;
  environment: string;
  applicationVersion: string;
  commitSha?: string | null;
  overallStatus: TechnicalServiceStatus;
  services: TechnicalServiceHealth[];
  recentErrors: StructuredLogEntry[];
  alerts: Array<{ id: string; severity: "warning" | "critical"; title: string; service: string; deduplicationKey: string; createdAt: string }>;
}

const sensitiveKeyPattern = /(password|pass|token|secret|cookie|authorization|apikey|api_key|private|credential|vapid|p256dh|auth_secret|connectionstring|database_url|databaseurl)/i;
const maxCorrelationLength = 80;

export function createRequestId(prefix = "req"): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeCorrelationId(value?: string | null): string {
  const raw = value?.trim();
  if (!raw || raw.length > maxCorrelationLength || !/^[a-zA-Z0-9_.:-]+$/.test(raw)) return createRequestId();
  return raw;
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactSensitive(item),
  ]));
}

export function createLogEntry(entry: Omit<StructuredLogEntry, "timestamp" | "environment" | "service" | "applicationVersion" | "commitSha"> & { environment?: string; service?: string; applicationVersion?: string; commitSha?: string | null }): StructuredLogEntry {
  return {
    timestamp: new Date().toISOString(),
    environment: entry.environment ?? process.env.NODE_ENV ?? "development",
    service: entry.service ?? process.env.OBSERVABILITY_SERVICE_NAME ?? "taghvim",
    applicationVersion: entry.applicationVersion ?? process.env.APP_VERSION ?? "0.1.1",
    commitSha: entry.commitSha ?? process.env.COMMIT_SHA ?? null,
    ...entry,
    metadata: entry.metadata ? redactSensitive(entry.metadata) as Record<string, unknown> : undefined,
  };
}

export function serializeLog(entry: StructuredLogEntry): string {
  return JSON.stringify(redactSensitive(entry));
}

export function buildTechnicalHealthOverview(workspace: WorkspaceData, options: { environment?: string; applicationVersion?: string; commitSha?: string | null } = {}): TechnicalHealthOverview {
  const generatedAt = new Date().toISOString();
  const monitoringJobs = workspace.monitoringJobs ?? [];
  const reminderDue = (workspace.reminders ?? []).filter((item) => ["SCHEDULED", "FAILED", "SNOOZED"].includes(item.status) && item.scheduledForUtc <= generatedAt);
  const unreadNotifications = (workspace.notifications ?? []).filter((item) => !item.readAt);
  const backupStatus = buildBackupStatus(generatedAt);
  const failedMonitoring = monitoringJobs.filter((job) => job.status === "FAILED");
  const staleSources = (workspace.monitoringSources ?? []).filter((source) => source.enabled && !source.archivedAt && isMonitoringSourceStale(workspace, source.id, source.freshnessThresholdHours));
  const recentErrors = monitoringJobs.filter((job) => job.status === "FAILED").slice(0, 8).map((job) => createLogEntry({
    level: "error",
    event: "monitoring_job_failed",
    service: "monitoring-worker",
    jobId: job.id,
    batchId: job.batchId,
    sourceId: job.sourceId,
    errorCode: job.errorCode ?? "MONITORING_JOB_FAILED",
    retryCount: job.retryCount,
    metadata: { safeErrorMessage: job.safeErrorMessage },
  }));
  const services: TechnicalServiceHealth[] = [
    service("frontend", "Frontend / PWA", "HEALTHY", "Build artifact and service worker are available after production build.", generatedAt, []),
    service("backend", "Backend API", "HEALTHY", "Liveness endpoint is available in the running backend process.", generatedAt, []),
    service("database", "Database", "UNKNOWN", "PostgreSQL runtime integration is not configured yet.", generatedAt, []),
    service("backup", "Backup status", backupStatus.status, backupStatus.summary, generatedAt, backupStatus.metrics),
    service("realtime", "Realtime", "UNKNOWN", "Realtime gateway is not implemented in this repository.", generatedAt, []),
    service("worker", "Worker", failedMonitoring.length ? "WARNING" : "UNKNOWN", failedMonitoring.length ? "Some background jobs have failed." : "Separate worker process is not implemented yet.", generatedAt, [
      metric("jobs_failed_total", failedMonitoring.length, "count", { jobType: "monitoring" }),
    ]),
    service("scheduler", "Scheduler", reminderDue.length ? "WARNING" : "UNKNOWN", reminderDue.length ? "Due reminders are waiting for processing." : "Scheduler endpoints exist; provider schedule must be configured externally.", generatedAt, [
      metric("reminders_due", reminderDue.length, "count"),
    ]),
    service("web_push", "Web Push", "UNKNOWN", "Push provider delivery metrics are not wired yet.", generatedAt, [
      metric("push_subscriptions_active", (workspace.pushSubscriptions ?? []).filter((item) => !item.revokedAt).length, "count"),
    ]),
    service("file_storage", "File storage", "UNKNOWN", "Blob upload endpoint exists; provider health is not checked from runtime.", generatedAt, []),
    service("social_monitoring", "Social Monitoring engine", staleSources.length || failedMonitoring.length ? "WARNING" : "HEALTHY", staleSources.length ? "Some monitored social sources are stale." : "Monitoring records are available.", generatedAt, [
      metric("monitoring_sources_stale", staleSources.length, "count"),
      metric("monitoring_jobs_failed_total", failedMonitoring.length, "count"),
    ]),
    service("notifications", "Notifications", unreadNotifications.length > 100 ? "WARNING" : "HEALTHY", "In-app notification records are available.", generatedAt, [
      metric("notifications_unread", unreadNotifications.length, "count"),
    ]),
  ];
  const alerts = [
    ...backupStatus.alerts,
    ...staleSources.map((source) => ({ id: `alert-stale-${source.id}`, severity: "warning" as const, title: "داده مانیتورینگ قدیمی شده است", service: "social_monitoring", deduplicationKey: `monitoring-stale:${source.id}`, createdAt: generatedAt })),
    ...failedMonitoring.slice(0, 5).map((job) => ({ id: `alert-job-${job.id}`, severity: "warning" as const, title: "یک کار پس زمینه ناموفق بود", service: "worker", deduplicationKey: `job-failed:${job.sourceId}:${job.errorCode ?? "unknown"}`, createdAt: job.completedAt ?? job.createdAt })),
  ];
  return {
    generatedAt,
    environment: options.environment ?? process.env.NODE_ENV ?? "development",
    applicationVersion: options.applicationVersion ?? process.env.APP_VERSION ?? "0.1.1",
    commitSha: options.commitSha ?? process.env.COMMIT_SHA ?? null,
    overallStatus: summarizeStatus(services),
    services,
    recentErrors,
    alerts,
  };
}

function metric(name: string, value: number, unit: ObservabilityMetric["unit"], labels?: Record<string, string>): ObservabilityMetric {
  return { name, value, unit, labels };
}

function service(key: string, labelFa: string, status: TechnicalServiceStatus, summary: string, lastCheckedAt: string, metrics: ObservabilityMetric[]): TechnicalServiceHealth {
  return { key, labelFa, status, summary, lastCheckedAt, metrics };
}

function buildBackupStatus(generatedAt: string): { status: TechnicalServiceStatus; summary: string; metrics: ObservabilityMetric[]; alerts: TechnicalHealthOverview["alerts"] } {
  const lastSuccess = process.env.BACKUP_LAST_SUCCESS_AT;
  const lastRestoreTest = process.env.BACKUP_LAST_RESTORE_TEST_AT;
  const rpoHours = Number(process.env.BACKUP_RPO_HOURS ?? 24);
  const restoreDrillDays = Number(process.env.BACKUP_RESTORE_DRILL_DAYS ?? 90);
  if (!lastSuccess) {
    return {
      status: "UNKNOWN",
      summary: "Backup automation exists, but no successful backup timestamp is published to runtime yet.",
      metrics: [],
      alerts: [{ id: "alert-backup-unknown", severity: "warning", title: "Backup status is not verified", service: "backup", deduplicationKey: "backup:unknown", createdAt: generatedAt }],
    };
  }
  const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(lastSuccess)) / 1000));
  const restoreAgeDays = lastRestoreTest ? Math.round((Date.now() - Date.parse(lastRestoreTest)) / 86_400_000) : Number.POSITIVE_INFINITY;
  const stale = ageSeconds > rpoHours * 3600;
  const drillOverdue = restoreAgeDays > restoreDrillDays;
  return {
    status: stale ? "DEGRADED" : drillOverdue ? "WARNING" : "HEALTHY",
    summary: stale ? "No valid backup is published inside the approved RPO window." : drillOverdue ? "Latest backup is recent, but restore drill is overdue." : "Latest backup and restore drill are inside the configured windows.",
    metrics: [
      metric("backup_age_seconds", ageSeconds, "seconds"),
      metric("restore_test_age_days", Number.isFinite(restoreAgeDays) ? restoreAgeDays : -1, "count"),
    ],
    alerts: stale ? [{ id: "alert-backup-stale", severity: "critical", title: "No valid backup inside RPO", service: "backup", deduplicationKey: "backup:stale", createdAt: generatedAt }] : drillOverdue ? [{ id: "alert-restore-drill-overdue", severity: "warning", title: "Backup restore drill is overdue", service: "backup", deduplicationKey: "backup:restore-drill-overdue", createdAt: generatedAt }] : [],
  };
}

function isMonitoringSourceStale(workspace: WorkspaceData, sourceId: string, thresholdHours: number): boolean {
  const latest = (workspace.monitoringSnapshots ?? []).filter((item) => item.sourceId === sourceId).sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))[0];
  if (!latest) return true;
  return Date.now() - new Date(latest.collectedAt).getTime() > thresholdHours * 3_600_000;
}

function summarizeStatus(services: TechnicalServiceHealth[]): TechnicalServiceStatus {
  if (services.some((item) => item.status === "DOWN")) return "DOWN";
  if (services.some((item) => item.status === "DEGRADED")) return "DEGRADED";
  if (services.some((item) => item.status === "WARNING")) return "WARNING";
  if (services.some((item) => item.status === "UNKNOWN")) return "UNKNOWN";
  return "HEALTHY";
}

export const TECHNICAL_DATA_UNAVAILABLE = "داده فنی در دسترس نیست";
export const TECHNICAL_QUALITY_BY_MONITORING_QUALITY: Record<MonitoringDataQuality, TechnicalServiceStatus> = {
  COMPLETE: "HEALTHY",
  PARTIAL: "WARNING",
  INCOMPLETE: "WARNING",
  STALE: "WARNING",
  INVALID: "DEGRADED",
};
export const JOB_STATUS_TO_TECHNICAL_STATUS: Record<MonitoringJobStatus, TechnicalServiceStatus> = {
  QUEUED: "CHECKING",
  CLAIMED: "CHECKING",
  RUNNING: "CHECKING",
  SUCCESS: "HEALTHY",
  PARTIAL: "WARNING",
  FAILED: "DEGRADED",
  RATE_LIMITED: "WARNING",
  CANCELLED: "UNKNOWN",
};
