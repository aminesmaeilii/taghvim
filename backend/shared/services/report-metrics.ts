import { STATUS_META } from "../constants/defaults.js";
import type { SafeUser } from "../types/auth.js";
import type { ReportFilters, ReportInsight, ReportKpi, ReportMetricDefinition, ReportSnapshot, ReportTableRow, TaskItem, WorkspaceData } from "../types/domain.js";
import { todayIso } from "../utils/jalali.js";

const DAY = 86_400_000;
const terminalContent = new Set(["published", "archived", "cancelled"]);

export const REPORT_METRIC_CATALOG: ReportMetricDefinition[] = [
  { key: "planned_content", label: "محتوای برنامه ریزی شده", meaning: "تعداد محتواهای دارای تاریخ انتشار در بازه", formula: "محتوا با publicationDate داخل بازه", source: "contents", filters: ["date", "campaign", "platform", "type"], comparison: "absolute_change", permission: "reports.view", kind: "observed", completeness: "publicationDate" },
  { key: "completed_content", label: "محتوای تکمیل شده", meaning: "محتوای منتشرشده در بازه", formula: "status = published", source: "contents", filters: ["date", "campaign", "platform", "type"], comparison: "absolute_change", permission: "reports.view", kind: "observed", completeness: "status" },
  { key: "task_completion_rate", label: "نرخ انجام وظایف", meaning: "سهم وظایف انجام شده از کل وظایف واجد شرایط", formula: "done tasks / all filtered tasks * 100", source: "tasks", filters: ["date", "user", "team", "role", "taskStatus"], comparison: "percentage_point_change", permission: "reports.view", kind: "observed", completeness: "task status" },
  { key: "on_time_completion_rate", label: "نرخ انجام به موقع", meaning: "وظایف انجام شده ای که تا موعد مقرر تمام شده اند", formula: "done tasks with updatedAt <= dueDate / done tasks with dueDate * 100", source: "tasks", filters: ["date", "user", "team", "role", "taskStatus"], comparison: "percentage_point_change", permission: "reports.view", kind: "observed", completeness: "dueDate and updatedAt" },
  { key: "overdue_tasks", label: "وظایف عقب افتاده", meaning: "وظایف ناتمام با موعد گذشته", formula: "dueDate < today and status != done", source: "tasks", filters: ["date", "user", "team", "role", "taskStatus"], comparison: "absolute_change", permission: "reports.view", kind: "observed", completeness: "dueDate" },
  { key: "active_users", label: "کاربران فعال", meaning: "کاربرانی که در بازه فعالیت، پیام، وظیفه یا یادآور داشته اند", formula: "unique users from activityLog/chat/tasks/reminders", source: "activityLog, chatMessages, tasks, reminders", filters: ["date", "team", "role"], comparison: "absolute_change", permission: "reports.view", kind: "observed", completeness: "activity timestamps" },
  { key: "chat_messages", label: "پیام های تیمی", meaning: "حجم گفت وگو به عنوان نشانه فعالیت همکاری، نه بهره وری", formula: "chat messages in period", source: "chatMessages", filters: ["date", "user", "team"], comparison: "absolute_change", permission: "reports.view", kind: "observed", completeness: "message createdAt" },
  { key: "reminder_adoption", label: "پذیرش یادآور", meaning: "سهم کاربران فعال دارای یادآور", formula: "users with reminders / active users * 100", source: "reminders, active users", filters: ["date", "team", "role"], comparison: "percentage_point_change", permission: "reports.view", kind: "observed", completeness: "reminder userId" },
  { key: "pwa_devices", label: "دستگاه های PWA/Push", meaning: "دستگاه های ثبت شده برای اعلان Push", formula: "active push subscriptions", source: "pushSubscriptions", filters: ["user", "team", "role"], comparison: "none", permission: "reports.view", kind: "observed", completeness: "push subscription endpoint" },
];

export function defaultReportFilters(now = new Date()): ReportFilters {
  const toDate = isoDate(now);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - 29);
  return { fromDate: isoDate(from), toDate, comparisonMode: "previous_period", taskStatus: "all" };
}

export function buildReportSnapshot(workspace: WorkspaceData, filters: ReportFilters, viewer?: Pick<SafeUser, "id" | "role" | "team" | "dataScope" | "permissions">, page = 1, pageSize = 25): ReportSnapshot {
  const boundedPageSize = Math.min(Math.max(pageSize, 5), 80);
  const period = normalizePeriod(filters);
  const previous = filters.comparisonMode === "previous_period" ? previousPeriod(period.fromDate, period.toDate) : null;
  const scoped = scopeWorkspace(workspace, filters, viewer);
  const current = selectPeriod(scoped, period.fromDate, period.toDate);
  const prev = previous ? selectPeriod(scoped, previous.fromDate, previous.toDate) : null;
  const kpis = buildKpis(current, prev, scoped);
  const dataQuality = buildDataQuality(scoped);
  const insights = buildInsights(kpis, current, scoped);
  const risks = insights.filter((item) => item.severity === "risk");
  const rows = buildRows(current, scoped);
  const start = (Math.max(1, page) - 1) * boundedPageSize;
  const dataCompleteness = dataQuality.some((item) => item.count > 0) ? "partial" : rows.length ? "complete" : "insufficient";
  return {
    filters: { ...filters, fromDate: period.fromDate, toDate: period.toDate },
    generatedAt: new Date().toISOString(),
    comparisonPeriod: previous,
    dataCompleteness,
    summary: buildSummary(period, previous, kpis, insights, dataCompleteness),
    kpis,
    contentStatus: countBy(current.contents, (item) => STATUS_META[item.status]?.label ?? item.status),
    taskStatus: countBy(current.tasks, (item) => taskStatusLabel(item.status)),
    platforms: countBy(current.contents, (item) => scoped.platforms.find((platform) => platform.id === item.platformId)?.name ?? "بدون کانال"),
    contentTypes: countBy(current.contents, (item) => scoped.types.find((type) => type.id === item.typeId)?.name ?? "بدون نوع"),
    campaigns: countBy(current.contents, (item) => scoped.campaigns.find((campaign) => campaign.id === item.campaignId)?.title ?? "بدون کمپین"),
    teams: countBy(current.tasks, (item) => teamLabel(scoped, item.assigneeUserId)),
    workflowStages: countBy(current.contents, (item) => STATUS_META[item.status]?.label ?? item.status),
    collaboration: [
      { id: "direct", label: "گفت وگوی مستقیم", value: scoped.chatConversations.filter((item) => item.type === "DIRECT").length },
      { id: "group", label: "گفت وگوی گروهی", value: scoped.chatConversations.filter((item) => item.type === "GROUP").length },
      { id: "context", label: "پیام های دارای ارجاع", value: current.chatMessages.filter((item) => item.contextId).length },
    ],
    reminders: [
      { id: "created", label: "یادآور ثبت شده", value: current.reminders.length },
      { id: "sent", label: "ارسال شده", value: current.reminders.filter((item) => item.status === "SENT" || item.status === "PARTIALLY_SENT").length },
      { id: "failed", label: "ناموفق", value: current.reminders.filter((item) => item.status === "FAILED").length },
      { id: "snoozed", label: "تعویق خورده", value: current.reminders.filter((item) => item.status === "SNOOZED").length },
    ],
    trend: buildTrend(current, period.fromDate, period.toDate),
    insights,
    risks,
    table: { rows: rows.slice(start, start + boundedPageSize), total: rows.length, page: Math.max(1, page), pageSize: boundedPageSize },
    dataQuality,
    metricCatalog: REPORT_METRIC_CATALOG,
    privacy: { presentationSafe: true, hiddenFields: viewer?.role === "USER" || viewer?.role === "VIEWER" ? ["memberNames", "internalIds"] : ["internalIds"] },
  };
}

function buildKpis(current: WorkspaceData, previous: WorkspaceData | null, scoped: WorkspaceData): ReportKpi[] {
  const taskCompletion = percent(current.tasks.filter((task) => task.status === "done").length, current.tasks.length);
  const prevTaskCompletion = previous ? percent(previous.tasks.filter((task) => task.status === "done").length, previous.tasks.length) : null;
  const doneWithDue = current.tasks.filter((task) => task.status === "done" && task.dueDate);
  const onTime = percent(doneWithDue.filter((task) => task.updatedAt.slice(0, 10) <= (task.dueDate ?? "")).length, doneWithDue.length);
  const prevDoneWithDue = previous?.tasks.filter((task) => task.status === "done" && task.dueDate) ?? [];
  const prevOnTime = previous ? percent(prevDoneWithDue.filter((task) => task.updatedAt.slice(0, 10) <= (task.dueDate ?? "")).length, prevDoneWithDue.length) : null;
  const overdue = current.tasks.filter(isOverdueTask).length;
  const activeUserIds = activeUsers(current);
  const reminderUsers = new Set(current.reminders.map((item) => item.userId));
  return [
    kpi("planned_content", "برنامه ریزی شده", current.contents.length, previous?.contents.length ?? null, "count", "حجم کار محتوایی ثبت شده در بازه", current.contents.length ? "neutral" : "missing"),
    kpi("completed_content", "تکمیل شده", current.contents.filter((item) => item.status === "published").length, previous?.contents.filter((item) => item.status === "published").length ?? null, "count", "محتوای منتشرشده با داده واقعی وضعیت", "good"),
    kpi("task_completion_rate", "نرخ انجام وظایف", taskCompletion, prevTaskCompletion, "percent", current.tasks.length ? "نسبت وظایف انجام شده به کل وظایف بازه" : "داده کافی برای محاسبه وجود ندارد", taskCompletion === null ? "missing" : taskCompletion >= 70 ? "good" : "watch", current.tasks.length),
    kpi("on_time_completion_rate", "انجام به موقع", onTime, prevOnTime, "percent", doneWithDue.length ? "بر اساس موعد و زمان آخرین به روزرسانی وظیفه" : "برای این سنجه موعد معتبر کافی نیست", onTime === null ? "missing" : onTime >= 80 ? "good" : "watch", doneWithDue.length),
    kpi("overdue_tasks", "عقب افتاده", overdue, previous?.tasks.filter(isOverdueTask).length ?? null, "count", "وظایف ناتمام با موعد گذشته", overdue > 0 ? "risk" : "good"),
    kpi("active_users", "کاربران فعال", activeUserIds.size, previous ? activeUsers(previous).size : null, "count", "فعال یعنی کاربر دارای فعالیت، پیام، وظیفه یا یادآور در بازه", activeUserIds.size ? "good" : "missing"),
    kpi("chat_messages", "پیام های تیمی", current.chatMessages.length, previous?.chatMessages.length ?? null, "count", "حجم پیام فقط نشانه فعالیت همکاری است", "neutral"),
    kpi("reminder_adoption", "پذیرش یادآور", percent([...reminderUsers].filter((id) => activeUserIds.has(id)).length, activeUserIds.size), null, "percent", "کاربران فعال دارای یادآور؛ رابطه است نه علت", activeUserIds.size ? "neutral" : "missing"),
    kpi("pwa_devices", "دستگاه های Push", scoped.pushSubscriptions.filter((item) => !item.revokedAt).length, null, "count", "دستگاه های ثبت شده برای اعلان", scoped.pushSubscriptions.length ? "good" : "watch"),
  ];
}

function kpi(key: string, label: string, value: number | null, previousValue: number | null, unit: ReportKpi["unit"], insight: string, status: ReportKpi["status"], sampleSize?: number): ReportKpi {
  return { key, label, value, previousValue, change: value !== null && previousValue !== null ? value - previousValue : null, unit, insight, status, sampleSize };
}

function buildInsights(kpis: ReportKpi[], current: WorkspaceData, scoped: WorkspaceData): ReportInsight[] {
  const completed = kpis.find((item) => item.key === "completed_content");
  const overdue = kpis.find((item) => item.key === "overdue_tasks");
  const topStage = countBy(current.contents, (item) => STATUS_META[item.status]?.label ?? item.status).sort((a, b) => b.value - a.value)[0];
  const topCampaign = countBy(current.contents.filter((item) => item.campaignId), (item) => scoped.campaigns.find((campaign) => campaign.id === item.campaignId)?.title ?? "کمپین نامشخص").sort((a, b) => b.value - a.value)[0];
  return [
    { id: "achievement", title: "دستاورد اصلی", body: (completed?.value ?? 0) > 0 ? `${completed?.value} محتوای منتشرشده در بازه ثبت شده است.` : "هنوز محتوای منتشرشده ای در این بازه ثبت نشده است.", severity: (completed?.value ?? 0) > 0 ? "positive" : "neutral", inspectKey: "completed_content" },
    { id: "risk", title: "ریسک مدیریتی", body: (overdue?.value ?? 0) > 0 ? `${overdue?.value} وظیفه عقب افتاده نیاز به پیگیری دارد.` : "در داده فعلی وظیفه عقب افتاده دیده نمی شود.", severity: (overdue?.value ?? 0) > 0 ? "risk" : "positive", inspectKey: "overdue_tasks" },
    { id: "workflow", title: "تمرکز گردش کار", body: topStage ? `بیشترین تراکم محتوا در مرحله ${topStage.label} است.` : "برای تحلیل گردش کار داده کافی وجود ندارد.", severity: "neutral", inspectKey: "workflowStages" },
    { id: "campaign", title: "فعال ترین کمپین", body: topCampaign ? `${topCampaign.label} با ${topCampaign.value} آیتم محتوایی فعال ترین کمپین بازه است.` : "رابطه کمپین و محتوا برای این بازه کافی نیست.", severity: topCampaign ? "positive" : "neutral", inspectKey: "campaigns" },
  ];
}

function buildSummary(period: { fromDate: string; toDate: string }, previous: { fromDate: string; toDate: string } | null, kpis: ReportKpi[], insights: ReportInsight[], completeness: ReportSnapshot["dataCompleteness"]): string {
  const onTime = kpis.find((item) => item.key === "on_time_completion_rate");
  const positive = insights.find((item) => item.severity === "positive")?.body ?? "دستاورد برجسته ای در داده فعلی قابل تشخیص نیست.";
  const risk = insights.find((item) => item.severity === "risk")?.body ?? "ریسک فوری بر اساس داده فعلی مشاهده نمی شود.";
  const compare = previous ? `در مقایسه با ${previous.fromDate} تا ${previous.toDate}` : "بدون مقایسه دوره ای";
  const quality = completeness === "complete" ? "کامل" : completeness === "partial" ? "نسبی" : "ناکافی";
  return `در بازه ${period.fromDate} تا ${period.toDate}، ${compare}، نرخ انجام به موقع ${onTime?.value === null ? "قابل محاسبه نیست" : `${Math.round(onTime?.value ?? 0)} درصد`} است. ${positive} ${risk} وضعیت کیفیت داده ${quality} ارزیابی شده است.`;
}

function buildDataQuality(workspace: WorkspaceData) {
  return [
    { key: "tasks_without_due", label: "وظایف بدون موعد", count: workspace.tasks.filter((item) => !item.dueDate).length, explanation: "برای محاسبه دقیق تعهد به مهلت، dueDate لازم است." },
    { key: "content_without_campaign", label: "محتوای بدون کمپین", count: workspace.contents.filter((item) => !item.campaignId).length, explanation: "تحلیل کمپین زمانی دقیق تر است که محتوا به کمپین وصل باشد." },
    { key: "content_without_type", label: "محتوای بدون نوع معتبر", count: workspace.contents.filter((item) => !workspace.types.some((type) => type.id === item.typeId)).length, explanation: "برای تحلیل خروجی بر اساس نوع محتوا، typeId معتبر لازم است." },
    { key: "inactive_usage_tracking", label: "ردیابی استفاده محدود", count: workspace.activityLog.length ? 0 : 1, explanation: "فعالیت محصول فقط با رویدادهای موجود، چت، تسک و یادآور سنجیده می شود." },
  ];
}

function buildRows(current: WorkspaceData, scoped: WorkspaceData): ReportTableRow[] {
  return [
    ...current.tasks.map((task) => ({ id: task.id, kind: "task" as const, title: task.title, owner: profileFor(scoped, task.assigneeUserId)?.displayName ?? "نامشخص", status: taskStatusLabel(task.status), date: task.dueDate ?? task.updatedAt.slice(0, 10), priority: task.priority, risk: isOverdueTask(task) ? "عقب افتاده" : null })),
    ...current.contents.map((item) => ({ id: item.id, kind: "content" as const, title: item.title, owner: item.owner ?? "نامشخص", status: STATUS_META[item.status]?.label ?? item.status, date: item.publicationDate, priority: item.priority, risk: item.deadline && item.deadline < todayIso() && !terminalContent.has(item.status) ? "مهلت گذشته" : null })),
    ...current.reminders.map((item) => ({ id: item.id, kind: "reminder" as const, title: item.title, owner: profileFor(scoped, item.userId)?.displayName ?? "نامشخص", status: item.status, date: item.scheduledForUtc.slice(0, 10), priority: item.priority, risk: item.status === "FAILED" ? "ارسال ناموفق" : null })),
    ...current.notifications.map((item) => ({ id: item.id, kind: "notification" as const, title: item.title, owner: profileFor(scoped, item.userId)?.displayName ?? "نامشخص", status: item.readAt ? "خوانده شده" : "خوانده نشده", date: item.createdAt.slice(0, 10), priority: item.priority, risk: null })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

function buildTrend(workspace: WorkspaceData, fromDate: string, toDate: string) {
  const days = eachDay(fromDate, toDate);
  return days.map((date) => ({
    date,
    planned: workspace.contents.filter((item) => item.publicationDate === date).length,
    completed: workspace.contents.filter((item) => item.publicationDate === date && item.status === "published").length,
    messages: workspace.chatMessages.filter((item) => item.createdAt.slice(0, 10) === date).length,
    reminders: workspace.reminders.filter((item) => item.createdAt.slice(0, 10) === date).length,
  }));
}

function scopeWorkspace(workspace: WorkspaceData, filters: ReportFilters, viewer?: Pick<SafeUser, "id" | "role" | "team" | "dataScope" | "permissions">): WorkspaceData {
  const userIds = new Set(workspace.userProfiles.filter((profile) => (!filters.team || profileForTeam(profile, filters.team)) && (!filters.userId || profile.userId === filters.userId)).map((profile) => profile.userId));
  const restrictedToSelf = viewer?.role === "USER" || viewer?.role === "VIEWER" || viewer?.dataScope === "OWN" || viewer?.dataScope === "ASSIGNED";
  const allowedUserIds = restrictedToSelf && viewer ? new Set([viewer.id]) : userIds.size ? userIds : null;
  const content = workspace.contents.filter((item) => (!filters.platformId || item.platformId === filters.platformId) && (!filters.typeId || item.typeId === filters.typeId) && (!filters.campaignId || item.campaignId === filters.campaignId));
  const tasks = workspace.tasks.filter((item) => (!allowedUserIds || allowedUserIds.has(item.assigneeUserId) || allowedUserIds.has(item.createdByUserId)) && (!filters.taskStatus || filters.taskStatus === "all" || item.status === filters.taskStatus));
  return { ...workspace, contents: content, tasks, reminders: workspace.reminders.filter((item) => !allowedUserIds || allowedUserIds.has(item.userId)), notifications: workspace.notifications.filter((item) => !allowedUserIds || allowedUserIds.has(item.userId)), pushSubscriptions: workspace.pushSubscriptions.filter((item) => !allowedUserIds || allowedUserIds.has(item.userId)), chatMessages: workspace.chatMessages.filter((item) => !allowedUserIds || allowedUserIds.has(item.senderId)) };
}

function selectPeriod(workspace: WorkspaceData, fromDate: string, toDate: string): WorkspaceData {
  return {
    ...workspace,
    contents: workspace.contents.filter((item) => between(item.publicationDate, fromDate, toDate)),
    campaigns: workspace.campaigns.filter((item) => between(item.startDate ?? item.createdAt.slice(0, 10), fromDate, toDate) || between(item.endDate ?? item.updatedAt.slice(0, 10), fromDate, toDate)),
    tasks: workspace.tasks.filter((item) => between(item.dueDate ?? item.createdAt.slice(0, 10), fromDate, toDate)),
    chatMessages: workspace.chatMessages.filter((item) => between(item.createdAt.slice(0, 10), fromDate, toDate)),
    reminders: workspace.reminders.filter((item) => between(item.createdAt.slice(0, 10), fromDate, toDate) || between(item.scheduledForUtc.slice(0, 10), fromDate, toDate)),
    notifications: workspace.notifications.filter((item) => between(item.createdAt.slice(0, 10), fromDate, toDate)),
    activityLog: workspace.activityLog.filter((item) => between(item.createdAt.slice(0, 10), fromDate, toDate)),
  };
}

function activeUsers(workspace: WorkspaceData): Set<string> {
  return new Set([
    ...workspace.activityLog.map((item) => item.actorUserId),
    ...workspace.chatMessages.map((item) => item.senderId),
    ...workspace.tasks.flatMap((item) => [item.assigneeUserId, item.createdByUserId]),
    ...workspace.reminders.map((item) => item.userId),
  ].filter(Boolean));
}

function countBy<T>(items: T[], labelFor: (item: T) => string) {
  const map = new Map<string, number>();
  items.forEach((item) => map.set(labelFor(item), (map.get(labelFor(item)) ?? 0) + 1));
  return [...map.entries()].map(([label, value], index) => ({ id: label, label, value, color: palette[index % palette.length] })).sort((a, b) => b.value - a.value);
}

const palette = ["#0f766e", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#15803d", "#475569", "#c2410c"];
function percent(part: number, total: number): number | null { return total > 0 ? Math.round((part / total) * 1000) / 10 : null; }
function isOverdueTask(task: TaskItem): boolean { return Boolean(task.dueDate && task.dueDate < todayIso() && task.status !== "done"); }
function taskStatusLabel(status: TaskItem["status"]): string { return status === "done" ? "انجام شده" : status === "in_progress" ? "در حال انجام" : "برای انجام"; }
function profileFor(workspace: WorkspaceData, userId: string) { return workspace.userProfiles.find((item) => item.userId === userId); }
function teamLabel(workspace: WorkspaceData, userId: string): string {
  const profile = profileFor(workspace, userId);
  return profile?.displayName.split(" ")[0] || "بدون تیم";
}
function profileForTeam(profile: { displayName: string }, team: string): boolean { return JSON.stringify(profile).includes(team); }
function between(value: string, from: string, to: string): boolean { return value >= from && value <= to; }
function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function normalizePeriod(filters: ReportFilters) { return filters.fromDate <= filters.toDate ? { fromDate: filters.fromDate, toDate: filters.toDate } : { fromDate: filters.toDate, toDate: filters.fromDate }; }
function previousPeriod(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  const length = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY) + 1);
  to.setUTCDate(from.getUTCDate() - 1);
  from.setUTCDate(from.getUTCDate() - length);
  return { fromDate: isoDate(from), toDate: isoDate(to) };
}
function eachDay(fromDate: string, toDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  while (cursor <= end && dates.length < 120) { dates.push(isoDate(cursor)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return dates;
}
