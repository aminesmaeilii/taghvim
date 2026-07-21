import { CalendarClock, CheckCircle2, CircleAlert, ClipboardCheck, Clock3, Lightbulb, Megaphone, Plus, Send, Sparkles, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState, StatusBadge } from "../../components/ui";
import { STATUS_META } from "@shared/constants/defaults";
import { useContents, useWorkspace } from "../../hooks/use-workspace";
import { scoreIdea } from "../../services/idea-scoring";
import { useUIStore } from "../../stores/ui-store";
import type { Content, ContentIdea } from "@shared/types/domain";
import { formatJalaliDate, todayIso } from "@shared/utils/jalali";
import { ContentDetailDrawer } from "../content/content-detail-drawer";

type DashboardRole = "cmo" | "creator" | "pr";

const roleLabels: Record<DashboardRole, string> = {
  cmo: "CMO",
  creator: "Content Creator",
  pr: "PR",
};

const playbookTargets = [
  { label: "North Star", value: "Capture Rate", note: "هر ایده یا محتوا باید به خرید داخل زمبیل نزدیک شود." },
  { label: "تمرکز ۹۰ روزه", value: "Discover → Capture", note: "آگاهی عمومی اولویت نیست؛ مسیر خرید، اعتماد و فروشنده مهم ترند." },
  { label: "قاعده کمپین", value: "بدون acquisition خام", note: "تا وقتی capture و اعتماد بهتر نشده، کمپین صرفا بازدیدمحور ریسک دارد." },
];

function addDaysIso(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export function DashboardPage() {
  const workspace = useWorkspace();
  const contents = useContents();
  const { openContentDialog } = useUIStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Content | null>(null);
  const [role, setRole] = useState<DashboardRole>("cmo");
  if (workspace.isLoading || contents.isLoading) return <DashboardSkeleton />;
  if (!workspace.data || !contents.data) return <div className="page"><EmptyState title="فضای کاری بارگذاری نشد" description="دوباره برنامه را باز کنید یا از پشتیبان داده ها بازیابی کنید." /></div>;
  const today = todayIso();
  const weekEnd = addDaysIso(today, 7);
  const plannedToday = contents.data.filter((item) => item.publicationDate === today);
  const upcoming = contents.data.filter((item) => item.publicationDate > today).slice(0, 6);
  const thisWeek = contents.data.filter((item) => item.publicationDate >= today && item.publicationDate <= weekEnd);
  const review = contents.data.filter((item) => item.status === "review");
  const revision = contents.data.filter((item) => item.status === "revision");
  const overdue = contents.data.filter((item) => item.deadline && item.deadline < today && !["published", "cancelled"].includes(item.status));
  const published = contents.data.filter((item) => item.status === "published");
  const scheduled = contents.data.filter((item) => item.status === "scheduled");
  const activeIdeas = workspace.data.ideas.filter((item) => !item.archivedAt);
  const ideaStats = getIdeaStats(activeIdeas);
  const roleFocus = getRoleFocus(role, { plannedToday, thisWeek, review, revision, overdue, scheduled, published, ideas: activeIdeas, ideaStats });
  const topIdeas = [...activeIdeas].sort((a, b) => (b.score?.total ?? scoreIdea(b).total) - (a.score?.total ?? scoreIdea(a).total)).slice(0, 4);
  const hasContent = contents.data.length > 0;
  return <div className="page dashboard-page">
    <PageHeader title="داشبورد زمبیل" description={`${formatJalaliDate(today, { includeWeekday: true })} · نمای کاری PR، تولید محتوا و CMO`} actions={<Button onClick={() => openContentDialog({ quick: true })}><Plus size={18} />محتوای جدید</Button>} />
    {!hasContent ? <section className="welcome-panel"><div><span className="eyebrow">شروع فضای کاری</span><h2>برنامه محتوای شما از همین جا شکل می گیرد.</h2><p>یک آیتم بسازید، تقویم را باز کنید یا داده های قبلی تان را وارد کنید.</p></div><div className="welcome-actions"><Button onClick={() => openContentDialog({ quick: true })}><Plus size={18} />ساخت اولین محتوا</Button><Button variant="secondary" onClick={() => navigate("/calendar")}>باز کردن تقویم</Button></div></section> : <>
      <section className="role-switch surface" aria-label="نمای نقش">
        {(Object.keys(roleLabels) as DashboardRole[]).map((item) => <button key={item} type="button" className={role === item ? "active" : ""} onClick={() => setRole(item)}>{roleLabels[item]}</button>)}
      </section>
      <section className="metric-grid" aria-label="خلاصه وضعیت محتوا">
        <Metric icon={<CalendarClock />} label="برنامه امروز" value={plannedToday.length} tone="teal" />
        <Metric icon={<ClipboardCheck />} label="نیازمند بررسی/اصلاح" value={review.length + revision.length} tone="amber" />
        <Metric icon={<Lightbulb />} label="میانگین نمره ایده" value={ideaStats.average} suffix="/۱۰۰" tone="red" />
        <Metric icon={<Send />} label="آماده انتشار" value={scheduled.length} tone="violet" />
      </section>
      <section className="role-brief surface">
        <div><span className="eyebrow">{roleLabels[role]}</span><h2>{roleFocus.title}</h2><p>{roleFocus.description}</p></div>
        <div className="role-actions">{roleFocus.actions.map((action) => <button type="button" key={action.label} onClick={action.onClick}>{action.icon}<span>{action.label}</span><strong>{action.value.toLocaleString("fa-IR")}</strong></button>)}</div>
      </section>
      <section className="dashboard-grid">
        <ContentSection title={roleFocus.primaryListTitle} subtitle={roleFocus.primaryListSubtitle} items={roleFocus.primaryItems} onSelect={setSelected} emptyAction={<Button size="sm" onClick={() => openContentDialog({ date: today, quick: true })}><Plus size={15} />افزودن محتوا</Button>} />
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

function Metric({ icon, label, value, tone, suffix = "" }: { icon: ReactNode; label: string; value: number; tone: string; suffix?: string }) { return <section className={`metric metric-${tone}`}><span>{icon}</span><div><strong>{value.toLocaleString("fa-IR")}{suffix}</strong><p>{label}</p></div></section>; }

function ContentSection({ title, subtitle, items, onSelect, emptyAction }: { title: string; subtitle: string; items: Content[]; onSelect: (item: Content) => void; emptyAction?: ReactNode }) {
  return <section className="surface content-section"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{items.length ? <div className="content-mini-list">{items.map((item) => { const status = STATUS_META[item.status]; return <button className="mini-content" type="button" key={item.id} onClick={() => onSelect(item)}><span className="mini-time">{item.publicationTime ?? "بدون ساعت"}</span><span className="mini-title">{item.title}</span><StatusBadge status={item.status} label={status.label} color={status.color} /></button>; })}</div> : <div className="compact-empty"><Clock3 size={19} /><span>موردی برای نمایش نیست.</span>{emptyAction}</div>}</section>;
}

function getIdeaStats(ideas: ContentIdea[]) {
  const scores = ideas.map((idea) => idea.score?.total ?? scoreIdea(idea).total);
  return { average: scores.length ? Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length) : 0, strong: scores.filter((item) => item >= 70).length };
}

function getRoleFocus(role: DashboardRole, data: { plannedToday: Content[]; thisWeek: Content[]; review: Content[]; revision: Content[]; overdue: Content[]; scheduled: Content[]; published: Content[]; ideas: ContentIdea[]; ideaStats: { average: number; strong: number } }) {
  if (role === "creator") return {
    title: "صف تولید امروز",
    description: "برای تولیدکننده محتوا، مهم ترین چیز خروجی های قابل انتشار و آیتم های گیرکرده در بازبینی است.",
    primaryListTitle: "کارهای تولید محتوا",
    primaryListSubtitle: "امروز، بازبینی و اصلاح در اولویت هستند",
    primaryItems: [...data.plannedToday, ...data.review, ...data.revision].slice(0, 6),
    actions: [
      { label: "امروز", value: data.plannedToday.length, icon: <CalendarClock size={17} />, onClick: () => undefined },
      { label: "اصلاح", value: data.revision.length, icon: <CircleAlert size={17} />, onClick: () => undefined },
      { label: "هفته", value: data.thisWeek.length, icon: <ClipboardCheck size={17} />, onClick: () => undefined },
    ],
  };
  if (role === "pr") return {
    title: "صف خبر و بازنشر",
    description: "برای PR، محتوای منتشرشده، محتواهای آماده انتشار و ایده های قوی بهترین ورودی برای روایت بیرونی هستند.",
    primaryListTitle: "فرصت های PR",
    primaryListSubtitle: "آماده انتشار و منتشرشده های قابل بازنشر",
    primaryItems: [...data.scheduled, ...data.published].slice(0, 6),
    actions: [
      { label: "آماده", value: data.scheduled.length, icon: <Send size={17} />, onClick: () => undefined },
      { label: "منتشر", value: data.published.length, icon: <Megaphone size={17} />, onClick: () => undefined },
      { label: "ایده قوی", value: data.ideaStats.strong, icon: <Sparkles size={17} />, onClick: () => undefined },
    ],
  };
  return {
    title: "کنترل استراتژیک محتوا",
    description: "برای CMO، داشبورد باید نشان دهد تیم روی Capture، اعتماد، فروشنده و ایده های قابل سنجش حرکت می کند یا نه.",
    primaryListTitle: "اولویت های مدیریتی",
    primaryListSubtitle: "آیتم هایی که امروز تصمیم یا پیگیری می خواهند",
    primaryItems: [...data.review, ...data.revision, ...data.plannedToday].slice(0, 6),
    actions: [
      { label: "مهلت گذشته", value: data.overdue.length, icon: <CircleAlert size={17} />, onClick: () => undefined },
      { label: "بررسی", value: data.review.length, icon: <ClipboardCheck size={17} />, onClick: () => undefined },
      { label: "نمره ایده", value: data.ideaStats.average, icon: <Lightbulb size={17} />, onClick: () => undefined },
    ],
  };
}

function IdeaPanel({ ideas, average }: { ideas: ContentIdea[]; average: number }) {
  return <section className="surface idea-dashboard-panel"><div className="section-heading"><div><h2>کیفیت ایده ها</h2><p>بر اساس Playbook زمبیل و معیارهای Capture</p></div><Lightbulb size={20} /></div><div className="idea-quality"><strong>{average.toLocaleString("fa-IR")}<small>/۱۰۰</small></strong><span>میانگین نمره</span></div>{ideas.length ? <div className="idea-rank-list">{ideas.map((idea) => { const score = idea.score ?? scoreIdea(idea); return <div key={idea.id}><span>{score.total.toLocaleString("fa-IR")}</span><strong>{idea.title}</strong><small>{score.label}</small></div>; })}</div> : <div className="compact-empty"><Lightbulb size={19} /><span>هنوز ایده ای ثبت نشده است.</span></div>}</section>;
}

function PlaybookPanel() {
  return <section className="surface playbook-panel"><div className="section-heading"><div><h2>قطب نمای Playbook</h2><p>سه یادآوری کوتاه برای تصمیم روزانه</p></div><CheckCircle2 size={20} /></div><div className="playbook-list">{playbookTargets.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div></section>;
}

function DashboardSkeleton() { return <div className="page"><div className="skeleton heading-skeleton" /><div className="metric-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton metric-skeleton" key={index} />)}</div><div className="dashboard-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton panel-skeleton" key={index} />)}</div></div>; }
