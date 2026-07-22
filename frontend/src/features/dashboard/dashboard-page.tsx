import { CalendarClock, CheckCircle2, ClipboardCheck, Clock3, Lightbulb, Plus, Save, Send, Settings2, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState, Input, StatusBadge } from "../../components/ui";
import { STATUS_META, MARKETING_ROLE_LABELS } from "@shared/constants/defaults";
import { useContents, useWorkspace, workspaceKey } from "../../hooks/use-workspace";
import { scoreIdea } from "../../services/idea-scoring";
import { useUIStore } from "../../stores/ui-store";
import { useAuth } from "../../hooks/use-auth-context";
import { useCurrentProfile } from "../../hooks/use-profile";
import { contentRepository } from "../../services/content-repository";
import { KPI_CATALOG, type KpiMetricDef } from "./kpi-catalog";
import type { Content, ContentIdea, KpiEntry, MarketingRole, WorkspaceData } from "@shared/types/domain";
import { formatJalaliDate, todayIso } from "@shared/utils/jalali";
import { ContentDetailDrawer } from "../content/content-detail-drawer";

const playbookTargets = [
  { label: "North Star", value: "Capture Rate", note: "هر ایده یا محتوا باید به خرید داخل زمبیل نزدیک شود." },
  { label: "تمرکز ۹۰ روزه", value: "Discover → Capture", note: "آگاهی عمومی اولویت نیست؛ مسیر خرید، اعتماد و فروشنده مهم ترند." },
  { label: "قاعده کمپین", value: "بدون acquisition خام", note: "تا وقتی capture و اعتماد بهتر نشده، کمپین صرفا بازدیدمحور ریسک دارد." },
];

export function DashboardPage() {
  const workspace = useWorkspace();
  const contents = useContents();
  const { openContentDialog } = useUIStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Content | null>(null);
  if (workspace.isLoading || contents.isLoading) return <DashboardSkeleton />;
  if (!workspace.data || !contents.data) return <div className="page"><EmptyState title="فضای کاری بارگذاری نشد" description="دوباره برنامه را باز کنید یا از پشتیبان داده ها بازیابی کنید." /></div>;
  const today = todayIso();
  const plannedToday = contents.data.filter((item) => item.publicationDate === today);
  const upcoming = contents.data.filter((item) => item.publicationDate > today).slice(0, 6);
  const review = contents.data.filter((item) => item.status === "review");
  const revision = contents.data.filter((item) => item.status === "revision");
  const published = contents.data.filter((item) => item.status === "published");
  const scheduled = contents.data.filter((item) => item.status === "scheduled");
  const activeIdeas = workspace.data.ideas.filter((item) => !item.archivedAt);
  const ideaStats = getIdeaStats(activeIdeas);
  const topIdeas = [...activeIdeas].sort((a, b) => (b.score?.total ?? scoreIdea(b).total) - (a.score?.total ?? scoreIdea(a).total)).slice(0, 4);
  const hasContent = contents.data.length > 0;
  const dashboardRoles = profile?.dashboardRoles ?? [];
  const recordKpi = async (role: MarketingRole, metricKey: string, value: number) => {
    if (!user) return;
    const saved = await contentRepository.saveKpiEntry({ role, metricKey, value, recordedByUserId: user.id, recordedByName: `${user.firstName} ${user.lastName}`.trim() });
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, kpiEntries: [...current.kpiEntries, saved] } : current);
  };
  return <div className="page dashboard-page">
    <PageHeader title="داشبورد زمبیل" description={`${formatJalaliDate(today, { includeWeekday: true })} · داشبورد اختصاصی بر اساس نقش های شغلی شما`} />
    {!hasContent ? <section className="welcome-panel"><div><span className="eyebrow">شروع فضای کاری</span><h2>برنامه محتوای شما از همین جا شکل می گیرد.</h2><p>یک آیتم بسازید، تقویم را باز کنید یا داده های قبلی تان را وارد کنید.</p></div><div className="welcome-actions"><Button onClick={() => openContentDialog({ quick: true })}><Plus size={18} />ساخت اولین محتوا</Button><Button variant="secondary" onClick={() => navigate("/calendar")}>باز کردن تقویم</Button></div></section> : <>
      <section className="metric-grid" aria-label="خلاصه وضعیت محتوا">
        <Metric icon={<CalendarClock />} label="برنامه امروز" value={plannedToday.length} tone="teal" />
        <Metric icon={<ClipboardCheck />} label="نیازمند بررسی/اصلاح" value={review.length + revision.length} tone="amber" />
        <Metric icon={<Lightbulb />} label="میانگین نمره ایده" value={ideaStats.average} suffix="/۱۰۰" tone="red" />
        <Metric icon={<Send />} label="آماده انتشار" value={scheduled.length} tone="violet" />
      </section>
      <section className="section-heading dashboard-roles-heading"><div><h2>داشبورد اختصاصی من</h2><p>شاخص های نقش های دیجیتال مارکتینگی که برای خودتان انتخاب کرده اید.</p></div><Button size="sm" variant="secondary" onClick={() => navigate("/profile")}><Settings2 size={15} />انتخاب نقش ها</Button></section>
      {dashboardRoles.length ? <section className="kpi-role-grid">{dashboardRoles.map((role) => <RoleKpiPanel key={role} role={role} entries={workspace.data.kpiEntries} onRecord={(metricKey, value) => void recordKpi(role, metricKey, value)} />)}</section>
        : <div className="compact-empty surface"><Settings2 size={19} /><span>هنوز نقشی برای داشبورد خود انتخاب نکرده اید.</span><Button size="sm" onClick={() => navigate("/profile")}>انتخاب نقش ها</Button></div>}
      <section className="dashboard-grid">
        <ContentSection title="کارهای امروز" subtitle="امروز، بازبینی و اصلاح در اولویت هستند" items={[...plannedToday, ...review, ...revision].slice(0, 6)} onSelect={setSelected} emptyAction={<Button size="sm" onClick={() => openContentDialog({ date: today, quick: true })}><Plus size={15} />افزودن محتوا</Button>} />
        <section className="surface progress-panel"><div className="section-heading"><div><h2>سلامت تقویم</h2><p>تولید، بررسی و انتشار در یک نگاه</p></div><TrendingUp size={20} /></div><div className="progress-summary"><strong>{published.length}</strong><span>منتشر شده از {contents.data.length} محتوا</span></div><div className="progress-track"><span style={{ width: `${contents.data.length ? Math.round((published.length / contents.data.length) * 100) : 0}%` }} /></div><div className="distribution-list">{["draft", "in_progress", "review", "revision", "scheduled", "published"].map((key) => { const status = key as keyof typeof STATUS_META; const count = contents.data.filter((item) => item.status === status).length; return <div key={key}><StatusBadge status={status} label={STATUS_META[status].label} color={STATUS_META[status].color} /><strong>{count.toLocaleString("fa-IR")}</strong></div>; })}</div></section>
        <IdeaPanel ideas={topIdeas} average={ideaStats.average} />
        <PlaybookPanel />
        <ContentSection title="محتوای پیش رو" subtitle="انتشارهای نزدیک برای هماهنگی بین تیم ها" items={upcoming} onSelect={setSelected} />
        <ContentSection title="منتشرشده های اخیر" subtitle="برای PR، گزارش عملکرد و استفاده دوباره" items={published.slice(0, 6)} onSelect={setSelected} />
      </section>
    </>}
    <ContentDetailDrawer content={selected} workspace={workspace.data} onClose={() => setSelected(null)} />
  </div>;
}

function RoleKpiPanel({ role, entries, onRecord }: { role: MarketingRole; entries: KpiEntry[]; onRecord: (metricKey: string, value: number) => void }) {
  return <section className="surface role-kpi-panel">
    <header><h2>{MARKETING_ROLE_LABELS[role]}</h2></header>
    <div className="kpi-grid">{KPI_CATALOG[role].map((metric) => {
      const latest = entries.filter((item) => item.role === role && item.metricKey === metric.key).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
      return <KpiWidget key={metric.key} metric={metric} latest={latest} onRecord={(value) => onRecord(metric.key, value)} />;
    })}</div>
  </section>;
}

function KpiWidget({ metric, latest, onRecord }: { metric: KpiMetricDef; latest?: KpiEntry; onRecord: (value: number) => void }) {
  const [value, setValue] = useState("");
  const submit = () => { const parsed = Number(value); if (!value.trim() || Number.isNaN(parsed)) return; onRecord(parsed); setValue(""); };
  return <div className="kpi-widget">
    <span className="kpi-widget-label">{metric.label}</span>
    <strong className="kpi-widget-value">{latest ? latest.value.toLocaleString("fa-IR") : "—"}{latest && metric.unit ? ` ${metric.unit}` : ""}</strong>
    {latest && <small className="kpi-widget-meta">ثبت {latest.recordedByName} در {formatJalaliDate(latest.recordedAt)}</small>}
    <div className="kpi-widget-input"><Input type="number" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="مقدار جدید" /><button type="button" onClick={submit} aria-label={`ثبت ${metric.label}`}><Save size={14} /></button></div>
  </div>;
}

function Metric({ icon, label, value, tone, suffix = "" }: { icon: ReactNode; label: string; value: number; tone: string; suffix?: string }) { return <section className={`metric metric-${tone}`}><span>{icon}</span><div><strong>{value.toLocaleString("fa-IR")}{suffix}</strong><p>{label}</p></div></section>; }

function ContentSection({ title, subtitle, items, onSelect, emptyAction }: { title: string; subtitle: string; items: Content[]; onSelect: (item: Content) => void; emptyAction?: ReactNode }) {
  return <section className="surface content-section"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{items.length ? <div className="content-mini-list">{items.map((item) => { const status = STATUS_META[item.status]; return <button className="mini-content" type="button" key={item.id} onClick={() => onSelect(item)}><span className="mini-time">{item.publicationTime ?? "بدون ساعت"}</span><span className="mini-title">{item.title}</span><StatusBadge status={item.status} label={status.label} color={status.color} /></button>; })}</div> : <div className="compact-empty"><Clock3 size={19} /><span>موردی برای نمایش نیست.</span>{emptyAction}</div>}</section>;
}

function getIdeaStats(ideas: ContentIdea[]) {
  const scores = ideas.map((idea) => idea.score?.total ?? scoreIdea(idea).total);
  return { average: scores.length ? Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length) : 0, strong: scores.filter((item) => item >= 70).length };
}

function IdeaPanel({ ideas, average }: { ideas: ContentIdea[]; average: number }) {
  return <section className="surface idea-dashboard-panel"><div className="section-heading"><div><h2>کیفیت ایده ها</h2><p>بر اساس Playbook زمبیل و معیارهای Capture</p></div><Lightbulb size={20} /></div><div className="idea-quality"><strong>{average.toLocaleString("fa-IR")}<small>/۱۰۰</small></strong><span>میانگین نمره</span></div>{ideas.length ? <div className="idea-rank-list">{ideas.map((idea) => { const score = idea.score ?? scoreIdea(idea); return <div key={idea.id}><span>{score.total.toLocaleString("fa-IR")}</span><strong>{idea.title}</strong><small>{score.label}</small></div>; })}</div> : <div className="compact-empty"><Lightbulb size={19} /><span>هنوز ایده ای ثبت نشده است.</span></div>}</section>;
}

function PlaybookPanel() {
  return <section className="surface playbook-panel"><div className="section-heading"><div><h2>قطب نمای Playbook</h2><p>سه یادآوری کوتاه برای تصمیم روزانه</p></div><CheckCircle2 size={20} /></div><div className="playbook-list">{playbookTargets.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div></section>;
}

function DashboardSkeleton() { return <div className="page"><div className="skeleton heading-skeleton" /><div className="metric-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton metric-skeleton" key={index} />)}</div><div className="dashboard-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton panel-skeleton" key={index} />)}</div></div>; }
