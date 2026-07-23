import { Activity, AlertTriangle, Archive, BarChart3, Clock, ExternalLink, Filter, History, Plus, RadioTower, RefreshCw, Search, Settings2, ShieldCheck, TrendingUp } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, Dialog, EmptyState, Field, Input, Select } from "../../components/ui";
import { contentRepository } from "../../services/content-repository";
import { useAuth } from "../../hooks/use-auth-context";
import { useUIStore } from "../../stores/ui-store";
import { workspaceKey } from "../../hooks/use-workspace";
import { MONITORING_CAPABILITY_LABELS } from "@shared/constants/defaults";
import type { MonitoringCapabilityKey, MonitoringOverview, MonitoringSource } from "@shared/types/domain";
import { toPersianDigits } from "@shared/utils/jalali";

const monitoringKey = ["monitoring-overview"] as const;
const unavailableText = "این داده از منبع فعلی قابل دریافت نیست";
const betaNotice = "نسخه بتا: میزان اطلاعات قابل دریافت از هر شبکه اجتماعی، با توجه به دسترسی عمومی، API و محدودیت های فنی آن پلتفرم متفاوت است.";

export function MonitoringPage() {
  const { sourceId } = useParams();
  const overview = useQuery({ queryKey: monitoringKey, queryFn: () => contentRepository.monitoringOverview(), staleTime: 20_000 });
  if (overview.isLoading) return <div className="page monitoring-page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!overview.data) return <div className="page"><EmptyState title="مانیتورینگ در دسترس نیست" description="داده های مانیتورینگ هنوز بارگذاری نشده اند." /></div>;
  return sourceId ? <MonitoringSourcePage overview={overview.data} sourceId={sourceId} /> : <MonitoringOverviewPage overview={overview.data} />;
}

function MonitoringOverviewPage({ overview }: { overview: MonitoringOverview }) {
  const { user, hasPermission } = useAuth();
  const { pushToast } = useUIStore();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canManage = hasPermission("settings.update");
  const filtered = overview.sources.filter((source) => (platform === "all" || source.platformKey === platform) && `${source.displayName} ${source.handle ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const refresh = async (sourceId?: string) => {
    const result = await contentRepository.runMonitoringCollection("MANUAL", sourceId ?? null, user ?? undefined);
    await queryClient.invalidateQueries({ queryKey: monitoringKey });
    await queryClient.invalidateQueries({ queryKey: workspaceKey });
    pushToast({ title: `مانیتورینگ اجرا شد: ${toPersianDigits(result.succeeded)} موفق، ${toPersianDigits(result.failed)} ناموفق` });
  };
  return <div className="page monitoring-page">
    <PageHeader title="مانیتورینگ" description="پایش بتای کانال های رسمی زمبیل با تاریخچه روزانه و معماری قابل توسعه." actions={<>
      <span className="beta-badge">بتا</span>
      {canManage && <Button variant="secondary" onClick={() => setSettingsOpen(true)}><Settings2 size={16} />تنظیمات</Button>}
      {canManage && <Button onClick={() => void refresh()}><RefreshCw size={16} />به روزرسانی دستی</Button>}
    </>} />
    <p className="monitoring-beta">{betaNotice}</p>
    <section className="monitoring-summary">
      <Metric title="منابع فعال" value={overview.activeSources} icon={RadioTower} />
      <Metric title="پلتفرم های پشتیبانی شده" value={overview.supportedPlatforms} icon={ShieldCheck} />
      <Metric title="به روز شده امروز" value={overview.updatedToday} icon={RefreshCw} />
      <Metric title="در انتظار دریافت" value={overview.awaitingCollection} icon={Clock} />
      <Metric title="داده قدیمی" value={overview.staleSources} icon={AlertTriangle} />
      <Metric title="خطای دریافت" value={overview.errorSources} icon={Activity} />
    </section>
    <section className="surface monitoring-toolbar"><Search size={17} /><Input placeholder="جستجوی منبع یا هندل" value={query} onChange={(event) => setQuery(event.target.value)} /><Filter size={17} /><Select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="all">همه پلتفرم ها</option>{overview.platforms.map((item) => <option key={item.key} value={item.key}>{item.displayNameFa}</option>)}</Select></section>
    <section className="monitoring-grid">{filtered.map((source) => <SourceCard key={source.id} source={source} onRefresh={canManage ? () => void refresh(source.id) : undefined} />)}</section>
    {filtered.length === 0 && <EmptyState title="منبعی پیدا نشد" description="فیلترها را تغییر دهید یا یک کانال جدید اضافه کنید." />}
    <section className="monitoring-two-col">
      <Panel title="سلامت اتصال ها" icon={ShieldCheck}>{overview.platforms.map((item) => <div className="monitoring-row" key={item.key}><span style={{ background: item.accentColor }} /><strong>{item.displayNameFa}</strong><small>{healthLabel(item.healthStatus)} · {item.connectorVersion}</small></div>)}</Panel>
      <Panel title="رویدادهای اخیر" icon={History}>{overview.events.slice(0, 8).map((event) => <div className="monitoring-event" key={event.id}><strong>{event.title}</strong><small>{new Date(event.occurredAt).toLocaleString("fa-IR")}</small></div>)}</Panel>
    </section>
    <MonitoringSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} overview={overview} />
  </div>;
}

function MonitoringSourcePage({ overview, sourceId }: { overview: MonitoringOverview; sourceId: string }) {
  const source = overview.sources.find((item) => item.id === sourceId);
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useUIStore();
  if (!source) return <div className="page"><EmptyState title="کانال پیدا نشد" description="این منبع مانیتورینگ وجود ندارد یا بایگانی شده است." /></div>;
  const metrics = source.latestSnapshot?.normalizedMetrics ?? [];
  const refresh = async () => {
    const result = await contentRepository.runMonitoringCollection("MANUAL", source.id, user ?? undefined);
    await queryClient.invalidateQueries({ queryKey: monitoringKey });
    pushToast({ title: result.failed ? "دریافت کانال کامل نبود." : "کانال به روز شد." });
  };
  return <div className="page monitoring-page">
    <PageHeader title={source.displayName} description={`${source.platform?.displayNameFa ?? source.platformKey} · ${source.handle ?? source.externalId ?? source.normalizedUrl}`} actions={<>
      <Link className="button button-secondary button-md" to="/monitoring">بازگشت</Link>
      <a className="button button-secondary button-md" href={source.normalizedUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />لینک عمومی</a>
      {hasPermission("settings.update") && <Button onClick={() => void refresh()}><RefreshCw size={16} />رفرش</Button>}
    </>} />
    <p className="monitoring-beta">{betaNotice}</p>
    <section className="source-header-card surface" style={{ borderColor: source.platform?.accentColor }}>
      <div className="source-avatar" style={{ background: source.platform?.accentColor }}>{(source.platform?.displayNameEn ?? "?").slice(0, 1)}</div>
      <div><h2>{source.displayName}</h2><p>{source.normalizedUrl}</p></div>
      <span>{statusLabel(source.latestJob?.status)} · {qualityLabel(source.latestSnapshot?.dataQuality)}</span>
    </section>
    <section className="monitoring-summary">
      {(["FOLLOWER_COUNT", "MEMBER_COUNT", "SUBSCRIBER_COUNT", "TOTAL_POST_COUNT", "LATEST_CONTENT_DATE", "PUBLISHING_FREQUENCY"] as MonitoringCapabilityKey[]).map((key) => <Metric key={key} title={MONITORING_CAPABILITY_LABELS[key]} value={metricValue(metrics, key)} icon={BarChart3} muted={!metricObserved(metrics, key)} />)}
    </section>
    <section className="monitoring-two-col">
      <Panel title="روند تاریخی" icon={TrendingUp}><div className="monitoring-chart">{source.sparkline.length ? source.sparkline.map((point, index) => <span key={index} style={{ height: `${Math.max(12, point * 7)}px` }} />) : <p>{unavailableText}</p>}</div><small>نقاط خالی به معنی نبود اندازه گیری معتبر است، نه صفر.</small></Panel>
      <Panel title="سلامت مانیتورینگ" icon={ShieldCheck}>{source.capabilities.slice(0, 12).map((capability) => <div className="monitoring-row" key={capability.capabilityKey}><span className={capability.supported ? "ok" : "off"} /><strong>{MONITORING_CAPABILITY_LABELS[capability.capabilityKey]}</strong><small>{supportLabel(capability.supportLevel)}</small></div>)}</Panel>
    </section>
    <Panel title="بینش های کانال" icon={Activity}><div className="insight-list"><p>{source.latestSnapshot ? "آخرین داده ذخیره شده بدون حذف تاریخچه قبلی نمایش داده می شود." : "هنوز اولین دریافت موفق برای این کانال ثبت نشده است."}</p><p>{source.latestJob?.status === "FAILED" ? "این منبع شکست دریافت اخیر دارد و نیازمند بررسی است." : "خرابی یک اتصال، سایر پلتفرم ها را متوقف نمی کند."}</p><p>{source.latestSnapshot?.dataQuality === "PARTIAL" ? "بخشی از داده ها به علت محدودیت عمومی پلتفرم در دسترس نیست." : unavailableText}</p></div></Panel>
  </div>;
}

function SourceCard({ source, onRefresh }: { source: MonitoringOverview["sources"][number]; onRefresh?: () => void }) {
  return <article className="surface source-card" style={{ borderColor: source.platform?.accentColor }}>
    <header><span className="platform-dot" style={{ background: source.platform?.accentColor }} /><div><h2>{source.displayName}</h2><small>{source.platform?.displayNameFa} · {source.handle ?? source.externalId ?? "بدون هندل"}</small></div></header>
    <strong>{metricValue(source.latestSnapshot?.normalizedMetrics ?? [], "FOLLOWER_COUNT")}</strong>
    <p>{source.latestJob?.safeErrorMessage ?? unavailableText}</p>
    <div className="mini-spark">{source.sparkline.map((point, index) => <span key={index} style={{ height: `${Math.max(8, point * 5)}px` }} />)}</div>
    <footer><Link className="button button-secondary button-sm" to={`/monitoring/sources/${source.id}`}>صفحه کانال</Link>{onRefresh && <Button size="sm" variant="secondary" onClick={onRefresh}><RefreshCw size={14} />رفرش</Button>}</footer>
  </article>;
}

function MonitoringSettingsDialog({ open, onClose, overview }: { open: boolean; onClose: () => void; overview: MonitoringOverview }) {
  const blank = overview.sources[0];
  const { user } = useAuth();
  const { pushToast } = useUIStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MonitoringSource | null>(null);
  const source = form ?? blank;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!source) return;
    await contentRepository.saveMonitoringSource({ ...source, id: form?.id ?? crypto.randomUUID(), createdAt: form?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null, sortOrder: form?.sortOrder ?? overview.sources.length, version: form?.version ?? 1 }, user ?? undefined);
    await queryClient.invalidateQueries({ queryKey: monitoringKey });
    setForm(null);
    pushToast({ title: "منبع مانیتورینگ ذخیره شد." });
  };
  return <Dialog open={open} onClose={onClose} title="تنظیمات مانیتورینگ شبکه های اجتماعی" description="منابع قابل ویرایش هستند؛ اتصال جدید از پلتفرم پشتیبانی شده نیاز به کدنویسی ندارد." wide>
    <div className="monitoring-settings-list">{overview.sources.map((item) => <button type="button" key={item.id} onClick={() => setForm(item)}><strong>{item.displayName}</strong><small>{item.platform?.displayNameFa} · {item.normalizedUrl}</small><Archive size={15} /></button>)}</div>
    <form className="form-grid monitoring-form" onSubmit={(event) => void save(event)}>
      <Field label="پلتفرم"><Select value={source?.platformKey ?? "INSTAGRAM"} onChange={(event) => setForm({ ...(source ?? blank), platformKey: event.target.value })}>{overview.platforms.map((item) => <option key={item.key} value={item.key}>{item.displayNameFa}</option>)}</Select></Field>
      <Field label="نام نمایشی"><Input value={source?.displayName ?? ""} onChange={(event) => setForm({ ...(source ?? blank), displayName: event.target.value })} /></Field>
      <Field label="آدرس کانال"><Input dir="ltr" value={source?.sourceUrl ?? ""} onChange={(event) => setForm({ ...(source ?? blank), sourceUrl: event.target.value })} /></Field>
      <Field label="هندل" optional><Input dir="ltr" value={source?.handle ?? ""} onChange={(event) => setForm({ ...(source ?? blank), handle: event.target.value || null })} /></Field>
      <Field label="شناسه خارجی" optional><Input dir="ltr" value={source?.externalId ?? ""} onChange={(event) => setForm({ ...(source ?? blank), externalId: event.target.value || null })} /></Field>
      <Field label="ساعت دریافت روزانه"><Input type="time" value={source?.dailyCollectionTime ?? "06:00"} onChange={(event) => setForm({ ...(source ?? blank), dailyCollectionTime: event.target.value })} /></Field>
      <label className="switch-row"><span><strong>فعال</strong><small>دریافت فقط در بک اند انجام می شود.</small></span><input type="checkbox" checked={source?.enabled ?? true} onChange={(event) => setForm({ ...(source ?? blank), enabled: event.target.checked, collectionEnabled: event.target.checked })} /></label>
      <footer className="dialog-footer"><Button variant="secondary" type="button" onClick={() => setForm({ ...blank, id: "", displayName: "", sourceUrl: "", normalizedUrl: "", handle: "", externalId: null })}><Plus size={16} />منبع جدید</Button><Button type="submit">ذخیره</Button></footer>
    </form>
  </Dialog>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) { return <section className="surface monitoring-panel"><header><Icon size={19} /><h2>{title}</h2></header>{children}</section>; }
function Metric({ title, value, icon: Icon, muted = false }: { title: string; value: number | string; icon: typeof Activity; muted?: boolean }) { return <article className={`surface monitoring-metric ${muted ? "muted" : ""}`}><Icon size={18} /><span>{title}</span><strong>{typeof value === "number" ? toPersianDigits(value) : value}</strong></article>; }
function metricValue(metrics: { capabilityKey: MonitoringCapabilityKey; numericValue?: number | null; textValue?: string | null; observed: boolean }[], key: MonitoringCapabilityKey) { const item = metrics.find((metric) => metric.capabilityKey === key); return item?.numericValue ?? item?.textValue ?? unavailableText; }
function metricObserved(metrics: { capabilityKey: MonitoringCapabilityKey; observed: boolean }[], key: MonitoringCapabilityKey) { return Boolean(metrics.find((metric) => metric.capabilityKey === key)?.observed); }
function statusLabel(status?: string) { return ({ QUEUED: "در صف", RUNNING: "در حال دریافت", SUCCESS: "به روز", PARTIAL: "دریافت ناقص", FAILED: "ناموفق", RATE_LIMITED: "دسترسی محدود", CANCELLED: "لغو شده" } as Record<string, string>)[status ?? ""] ?? "داده قدیمی"; }
function supportLabel(status: string) { return ({ AVAILABLE: "Available", UNAVAILABLE: "Unavailable", RESTRICTED: "Restricted", TEMPORARILY_FAILED: "Temporarily failed", STALE: "Stale", ESTIMATED: "Estimated" } as Record<string, string>)[status] ?? status; }
function qualityLabel(status?: string) { return ({ COMPLETE: "کامل", PARTIAL: "نسبی", INCOMPLETE: "ناقص", STALE: "قدیمی", INVALID: "نامعتبر" } as Record<string, string>)[status ?? ""] ?? "بدون دریافت"; }
function healthLabel(status: string) { return ({ HEALTHY: "سالم", LIMITED: "محدود", NEEDS_REVIEW: "نیازمند بررسی", DOWN: "قطع", DISABLED: "غیرفعال" } as Record<string, string>)[status] ?? status; }

export default MonitoringPage;
