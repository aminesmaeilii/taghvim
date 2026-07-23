import { AlertTriangle, Download, Eye, FileSpreadsheet, Gauge, Goal, Layers3, LineChart, Printer, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState, Field, Input, Select } from "../../components/ui";
import { JalaliDateInput } from "../../components/jalali-date-input";
import { useAuth } from "../../hooks/use-auth-context";
import { useWorkspace } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { defaultReportFilters } from "@shared/services/report-metrics";
import type { ReportBreakdownItem, ReportFilters, ReportKpi, ReportMode, ReportSnapshot, ReportTableRow, WorkspaceData } from "@shared/types/domain";
import { formatJalaliDate, toPersianDigits } from "@shared/utils/jalali";

const modeLabels: Record<ReportMode, string> = { overview: "نمای کلی", operations: "عملکرد عملیاتی", collaboration: "استفاده و همکاری" };
type Preset = "today" | "7" | "30" | "month" | "previous-month" | "quarter" | "custom";

export function ReportsPage() {
  const { user, hasPermission } = useAuth();
  const workspace = useWorkspace();
  const [mode, setMode] = useState<ReportMode>("overview");
  const [presentation, setPresentation] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<Preset>("30");
  const [filters, setFilters] = useState<ReportFilters>(() => readFilters());

  useEffect(() => sessionStorage.setItem("report-filters", JSON.stringify(filters)), [filters]);
  useEffect(() => setPage(1), [filters, query, mode]);
  useEffect(() => {
    if (preset === "custom") return;
    setFilters((current) => ({ ...current, ...presetRange(preset) }));
  }, [preset]);

  const report = useQuery({
    queryKey: ["report-snapshot", filters, user?.id, page],
    queryFn: () => contentRepository.reportSnapshot(filters, user ?? undefined, page, 25),
    enabled: Boolean(user?.permissions.includes("reports.view")),
    staleTime: 20_000,
  });

  const data = report.data;
  const filteredRows = useMemo(() => {
    const rows = data?.table.rows ?? [];
    const needle = query.trim().toLocaleLowerCase("fa");
    return needle ? rows.filter((row) => [row.title, row.owner, row.status, row.risk].join(" ").toLocaleLowerCase("fa").includes(needle)) : rows;
  }, [data?.table.rows, query]);

  if (!user?.permissions.includes("reports.view")) return <div className="page"><EmptyState title="دسترسی ندارید" description="برای مشاهده گزارش ها باید مجوز reports.view داشته باشید." /></div>;
  if (workspace.isLoading || report.isLoading) return <div className="page reports-page"><div className="skeleton heading-skeleton" /><div className="reports-skeleton-grid"><div className="skeleton panel-skeleton" /><div className="skeleton panel-skeleton" /><div className="skeleton panel-skeleton" /></div></div>;
  if (!workspace.data || !data) return <div className="page"><EmptyState title="گزارش در دسترس نیست" description="داده فضای کاری برای ساخت گزارش پیدا نشد." /></div>;

  const canExport = hasPermission("reports.export");
  return <div className={`page reports-page ${presentation ? "reports-presentation" : ""}`}>
    {!presentation && <PageHeader title="گزارش ها" description="داشبورد هوشمندی عملیاتی برای تصمیم گیری روزمره، مدیریتی و ارائه رسمی." actions={<>
      <Button variant="secondary" onClick={() => report.refetch()}><RefreshCw size={16} />به روزرسانی</Button>
      <Button variant="secondary" onClick={() => setPresentation(true)}><Eye size={16} />حالت ارائه</Button>
      <Button variant="secondary" onClick={() => window.print()}><Printer size={16} />چاپ</Button>
      <Button onClick={() => exportCsv(data, filteredRows)} disabled={!canExport}><Download size={16} />CSV</Button>
    </>} />}

    {presentation && <header className="presentation-header surface"><div><img src="/icon.jpg" alt="" /><span>زَمبیل</span></div><strong>{formatJalaliDate(data.filters.fromDate)} تا {formatJalaliDate(data.filters.toDate)}</strong><Button variant="secondary" size="sm" onClick={() => setPresentation(false)}>خروج از ارائه</Button></header>}

    {!presentation && <FilterBar workspace={workspace.data} filters={filters} preset={preset} setPreset={setPreset} onChange={setFilters} />}
    {!presentation && <div className="report-mode-tabs">{(Object.keys(modeLabels) as ReportMode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{modeLabels[item]}</button>)}</div>}

    <ExecutiveSummary data={data} />
    {mode === "overview" && <Overview data={data} presentation={presentation} />}
    {mode === "operations" && <Operations data={data} />}
    {mode === "collaboration" && <Collaboration data={data} />}
    {!presentation && <Details data={data} rows={filteredRows} query={query} setQuery={setQuery} page={page} setPage={setPage} canExport={canExport} />}
  </div>;
}

function FilterBar({ workspace, filters, preset, setPreset, onChange }: { workspace: WorkspaceData; filters: ReportFilters; preset: Preset; setPreset: (preset: Preset) => void; onChange: (filters: ReportFilters) => void }) {
  const update = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });
  const teams = [...new Set(workspace.userProfiles.map((profile) => profile.displayName.split(" ")[0]).filter(Boolean))];
  return <section className="surface report-filter-bar">
    <Field label="بازه" optional><Select value={preset} onChange={(event) => setPreset(event.target.value as Preset)}><option value="today">امروز</option><option value="7">۷ روز اخیر</option><option value="30">۳۰ روز اخیر</option><option value="month">ماه جاری</option><option value="previous-month">ماه قبل</option><option value="quarter">فصل جاری</option><option value="custom">بازه دلخواه</option></Select></Field>
    <Field label="از تاریخ" optional><JalaliDateInput value={filters.fromDate} onChange={(value) => { setPreset("custom"); update({ fromDate: value }); }} /></Field>
    <Field label="تا تاریخ" optional><JalaliDateInput value={filters.toDate} onChange={(value) => { setPreset("custom"); update({ toDate: value }); }} /></Field>
    <Field label="تیم" optional><Select value={filters.team ?? ""} onChange={(event) => update({ team: event.target.value || undefined })}><option value="">همه تیم ها</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</Select></Field>
    <Field label="عضو" optional><Select value={filters.userId ?? ""} onChange={(event) => update({ userId: event.target.value || undefined })}><option value="">همه اعضا</option>{workspace.userProfiles.map((profile) => <option key={profile.userId} value={profile.userId}>{profile.displayName}</option>)}</Select></Field>
    <Field label="کمپین" optional><Select value={filters.campaignId ?? ""} onChange={(event) => update({ campaignId: event.target.value || undefined })}><option value="">همه کمپین ها</option>{workspace.campaigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></Field>
    <Field label="کانال" optional><Select value={filters.platformId ?? ""} onChange={(event) => update({ platformId: event.target.value || undefined })}><option value="">همه کانال ها</option>{workspace.platforms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
    <Field label="نوع محتوا" optional><Select value={filters.typeId ?? ""} onChange={(event) => update({ typeId: event.target.value || undefined })}><option value="">همه نوع ها</option>{workspace.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
    <Field label="وضعیت وظیفه" optional><Select value={filters.taskStatus ?? "all"} onChange={(event) => update({ taskStatus: event.target.value as ReportFilters["taskStatus"] })}><option value="all">همه</option><option value="todo">برای انجام</option><option value="in_progress">در حال انجام</option><option value="done">انجام شده</option></Select></Field>
    <Field label="مقایسه" optional><Select value={filters.comparisonMode} onChange={(event) => update({ comparisonMode: event.target.value as ReportFilters["comparisonMode"] })}><option value="previous_period">دوره قبل</option><option value="none">بدون مقایسه</option></Select></Field>
    <Button variant="secondary" onClick={() => { setPreset("30"); onChange(defaultReportFilters()); }}>بازنشانی</Button>
  </section>;
}

function ExecutiveSummary({ data }: { data: ReportSnapshot }) {
  const completeness = data.dataCompleteness === "complete" ? "کامل" : data.dataCompleteness === "partial" ? "نسبی" : "ناکافی";
  return <section className="surface executive-summary"><div><span>خلاصه مدیریتی</span><h2>{data.summary}</h2></div><dl><div><dt>دوره گزارش</dt><dd>{formatJalaliDate(data.filters.fromDate)} تا {formatJalaliDate(data.filters.toDate)}</dd></div><div><dt>دوره مقایسه</dt><dd>{data.comparisonPeriod ? `${formatJalaliDate(data.comparisonPeriod.fromDate)} تا ${formatJalaliDate(data.comparisonPeriod.toDate)}` : "غیرفعال"}</dd></div><div><dt>آخرین به روزرسانی</dt><dd>{formatJalaliDate(data.generatedAt)}</dd></div><div><dt>کیفیت داده</dt><dd>{completeness}</dd></div></dl></section>;
}

function Overview({ data, presentation }: { data: ReportSnapshot; presentation: boolean }) {
  const hero = data.kpis.find((item) => item.key === "on_time_completion_rate") ?? data.kpis[0];
  return <><section className="report-bento">
    <HeroCard item={hero} trend={data.trend} />
    <SplitCard title="برنامه / تکمیل" a={data.kpis.find((item) => item.key === "planned_content")} b={data.kpis.find((item) => item.key === "completed_content")} />
    <RiskCard risks={data.risks} />
    <ProgressCard item={data.kpis.find((item) => item.key === "task_completion_rate")} />
    <InsightCard insight={data.insights.find((item) => item.id === "achievement")} />
  </section>{!presentation && <section className="report-grid-pro"><Breakdown title="وضعیت محتوا" items={data.contentStatus} /><Breakdown title="وضعیت وظایف" items={data.taskStatus} /><DataQuality data={data} /></section>}</>;
}

function Operations({ data }: { data: ReportSnapshot }) {
  return <><section className="report-grid-pro"><Breakdown title="گردش کار محتوا" items={data.workflowStages} /><Breakdown title="خروجی بر اساس کانال" items={data.platforms} /><Breakdown title="نوع محتوا" items={data.contentTypes} /><Breakdown title="کمپین های فعال" items={data.campaigns} /></section><TrendPanel data={data} /><section className="report-grid-pro"><ProgressCard item={data.kpis.find((item) => item.key === "on_time_completion_rate")} /><RiskCard risks={data.risks} /><InsightCard insight={data.insights.find((item) => item.id === "workflow")} /></section></>;
}

function Collaboration({ data }: { data: ReportSnapshot }) {
  return <><section className="report-bento"><HeroCard item={data.kpis.find((item) => item.key === "active_users") ?? data.kpis[0]} trend={data.trend} /><SplitCard title="چت / یادآور" a={data.kpis.find((item) => item.key === "chat_messages")} b={data.kpis.find((item) => item.key === "reminder_adoption")} /><ProgressCard item={data.kpis.find((item) => item.key === "reminder_adoption")} /><InsightCard insight={{ id: "usage-note", title: "تعریف کاربر فعال", body: "کاربر فعال یعنی فردی که در بازه فعالیت، پیام، وظیفه یا یادآور ثبت شده دارد؛ صرف باز شدن صفحه به عنوان فعالیت حساب نشده است.", severity: "neutral", inspectKey: "active_users" }} /></section><section className="report-grid-pro"><Breakdown title="همکاری تیمی" items={data.collaboration} /><Breakdown title="یادآورها و اعلان ها" items={data.reminders} /><Breakdown title="بار کاری تیم" items={data.teams} /><DataQuality data={data} /></section></>;
}

function HeroCard({ item, trend }: { item: ReportKpi; trend: ReportSnapshot["trend"] }) {
  return <section className={`surface report-hero-card ${item.status}`}><div><Gauge size={22} /><span>شاخص کلیدی</span></div><strong>{formatMetric(item)}</strong><h2>{item.label}</h2><p>{item.insight}</p><small>{formatChange(item)}</small><Sparkline points={trend.map((point) => point.completed + point.planned)} /></section>;
}

function SplitCard({ title, a, b }: { title: string; a?: ReportKpi; b?: ReportKpi }) {
  return <section className="surface report-split-card"><header><Layers3 size={19} /><span>{title}</span></header><div><MetricMini item={a} /><MetricMini item={b} /></div></section>;
}

function ProgressCard({ item }: { item?: ReportKpi }) {
  const value = item?.value ?? null;
  return <section className="surface report-progress-card"><header><Goal size={19} /><span>{item?.label ?? "هدف"}</span></header><div className="progress-ring" style={{ "--value": `${value ?? 0}%` } as CSSProperties}><strong>{value === null ? "ندارد" : `${toPersianDigits(value)}٪`}</strong></div><p>{item?.insight ?? "هدفی تعیین نشده است"}</p></section>;
}

function RiskCard({ risks }: { risks: ReportSnapshot["risks"] }) {
  const risk = risks[0];
  return <section className={`surface report-risk-card ${risk ? "has-risk" : ""}`}><header><AlertTriangle size={19} /><span>ریسک نیازمند توجه</span></header><h3>{risk?.title ?? "ریسک فوری دیده نشد"}</h3><p>{risk?.body ?? "بر اساس داده فعلی مورد بحرانی در بازه انتخابی وجود ندارد."}</p></section>;
}

function InsightCard({ insight }: { insight?: ReportSnapshot["insights"][number] }) {
  return <section className="surface report-insight-card"><header><Sparkles size={19} /><span>بینش قابل ارائه</span></header><h3>{insight?.title ?? "داده کافی وجود ندارد"}</h3><p>{insight?.body ?? "برای استخراج بینش، داده عملیاتی بیشتری لازم است."}</p></section>;
}

function Breakdown({ title, items }: { title: string; items: ReportBreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return <section className="surface report-breakdown"><h2>{title}</h2>{items.length ? items.slice(0, 7).map((item) => <div key={item.id} className="report-breakdown-row"><span><i style={{ background: item.color }} />{item.label}</span><strong>{toPersianDigits(item.value)}</strong><div><b style={{ width: `${total ? (item.value / total) * 100 : 0}%`, background: item.color }} /></div></div>) : <p>داده کافی وجود ندارد.</p>}</section>;
}

function TrendPanel({ data }: { data: ReportSnapshot }) {
  return <section className="surface report-trend-panel"><header><LineChart size={20} /><div><h2>روند تولید و همکاری</h2><p>ترند از تاریخ های واقعی محتوا، پیام و یادآور ساخته شده است.</p></div></header><div className="trend-bars">{data.trend.slice(-30).map((point) => <span key={point.date} title={`${point.date}: ${point.planned} برنامه، ${point.completed} تکمیل، ${point.messages} پیام`}><i style={{ height: `${Math.max(5, point.planned * 14)}px` }} /><b style={{ height: `${Math.max(4, point.completed * 18)}px` }} /></span>)}</div></section>;
}

function DataQuality({ data }: { data: ReportSnapshot }) {
  return <section className="surface data-quality-panel"><header><ShieldCheck size={19} /><h2>کیفیت داده</h2></header>{data.dataQuality.map((item) => <div key={item.key}><strong>{toPersianDigits(item.count)}</strong><span>{item.label}</span><small>{item.explanation}</small></div>)}</section>;
}

function Details({ data, rows, query, setQuery, page, setPage, canExport }: { data: ReportSnapshot; rows: ReportTableRow[]; query: string; setQuery: (value: string) => void; page: number; setPage: (value: number) => void; canExport: boolean }) {
  return <section className="surface report-detail-table"><header><div><FileSpreadsheet size={19} /><h2>جدول جزئیات قابل بررسی</h2></div><label><Search size={15} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در ردیف ها" /></label></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>نوع</th><th>عنوان</th><th>مسئول</th><th>وضعیت</th><th>تاریخ</th><th>ریسک</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.kind}-${row.id}`} className="data-row"><td data-label="نوع">{kindLabel(row.kind)}</td><td data-label="عنوان"><strong>{row.title}</strong></td><td data-label="مسئول">{row.owner}</td><td data-label="وضعیت">{row.status}</td><td data-label="تاریخ">{formatJalaliDate(row.date)}</td><td data-label="ریسک">{row.risk ?? "ندارد"}</td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="ردیفی پیدا نشد" description="فیلتر یا عبارت جستجو را تغییر دهید." />}<footer><span>{toPersianDigits(data.table.total)} ردیف واقعی</span><div><Button variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>قبلی</Button><Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page * data.table.pageSize >= data.table.total}>بعدی</Button><Button size="sm" onClick={() => exportCsv(data, rows)} disabled={!canExport}>خروجی ردیف ها</Button></div></footer></section>;
}

function MetricMini({ item }: { item?: ReportKpi }) { return <article><span>{item?.label ?? "نامشخص"}</span><strong>{item ? formatMetric(item) : "داده کافی وجود ندارد"}</strong><small>{item ? formatChange(item) : "هدف/داده ای ثبت نشده است"}</small></article>; }
function Sparkline({ points }: { points: number[] }) { const max = Math.max(1, ...points); return <div className="report-sparkline">{points.slice(-18).map((point, index) => <span key={index} style={{ height: `${Math.max(8, (point / max) * 100)}%` }} />)}</div>; }
function formatMetric(item: ReportKpi): string { if (item.value === null) return "داده کافی وجود ندارد"; const value = toPersianDigits(item.value); return item.unit === "percent" ? `${value}٪` : item.unit === "days" ? `${value} روز` : item.unit === "hours" ? `${value} ساعت` : value; }
function formatChange(item: ReportKpi): string { if (item.change === null || item.change === undefined) return "مقایسه در دسترس نیست"; const sign = item.change > 0 ? "+" : ""; return `${toPersianDigits(`${sign}${Math.round(item.change * 10) / 10}`)} نسبت به دوره قبل`; }
function kindLabel(kind: ReportTableRow["kind"]): string { return ({ task: "وظیفه", content: "محتوا", campaign: "کمپین", chat: "چت", reminder: "یادآور", notification: "اعلان" })[kind]; }
function readFilters(): ReportFilters { try { const raw = sessionStorage.getItem("report-filters"); return raw ? JSON.parse(raw) as ReportFilters : defaultReportFilters(); } catch { return defaultReportFilters(); } }
function presetRange(preset: Preset): Pick<ReportFilters, "fromDate" | "toDate"> {
  const now = new Date(); const today = now.toISOString().slice(0, 10); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (preset === "today") return { fromDate: today, toDate: today };
  if (preset === "7" || preset === "30") { start.setUTCDate(start.getUTCDate() - Number(preset) + 1); return { fromDate: start.toISOString().slice(0, 10), toDate: today }; }
  if (preset === "month") return { fromDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10), toDate: today };
  if (preset === "previous-month") return { fromDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10), toDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10) };
  const quarterStart = Math.floor(now.getUTCMonth() / 3) * 3;
  return { fromDate: new Date(Date.UTC(now.getUTCFullYear(), quarterStart, 1)).toISOString().slice(0, 10), toDate: today };
}
function exportCsv(data: ReportSnapshot, rows: ReportTableRow[]) {
  const csv = [["period", data.filters.fromDate, data.filters.toDate], ["generatedAt", data.generatedAt], [], ["kind", "title", "owner", "status", "date", "risk"], ...rows.map((row) => [kindLabel(row.kind), row.title, row.owner, row.status, row.date, row.risk ?? ""])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `taghvim-report-${data.filters.fromDate}-${data.filters.toDate}.csv`; anchor.click(); URL.revokeObjectURL(url);
}
