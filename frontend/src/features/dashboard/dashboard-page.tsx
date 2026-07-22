import { CalendarClock, CheckSquare, ClipboardCheck, Clock3, Lightbulb, Paperclip, Plus, Send, UserPlus, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState, Input, StatusBadge } from "../../components/ui";
import { STATUS_META } from "@shared/constants/defaults";
import { useContents, useWorkspace, workspaceKey } from "../../hooks/use-workspace";
import { useUIStore } from "../../stores/ui-store";
import { useAuth } from "../../hooks/use-auth-context";
import { useActivityLogger } from "../../hooks/use-profile";
import { contentRepository } from "../../services/content-repository";
import { Sparkline, DonutGauge } from "./dashboard-charts";
import type { Content, ContentIdea, TaskItem, WorkspaceData } from "@shared/types/domain";
import { addDays, formatJalaliDate, getCurrentJalaliMonth, isSameJalaliMonth, todayIso } from "@shared/utils/jalali";
import { ContentDetailDrawer } from "../content/content-detail-drawer";

const PRIORITY_LABEL = { low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری" } as const;

export function DashboardPage() {
  const workspace = useWorkspace();
  const contents = useContents();
  const { openContentDialog } = useUIStore();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [selected, setSelected] = useState<Content | null>(null);
  if (workspace.isLoading || contents.isLoading) return <DashboardSkeleton />;
  if (!workspace.data || !contents.data) return <div className="page"><EmptyState title="فضای کاری بارگذاری نشد" description="دوباره برنامه را باز کنید یا از پشتیبان داده ها بازیابی کنید." /></div>;

  const today = todayIso();
  const plannedToday = contents.data.filter((item) => item.publicationDate === today);
  const overdue = contents.data.filter((item) => item.deadline && item.deadline < today && !["published", "cancelled", "archived"].includes(item.status));
  const upcoming = contents.data.filter((item) => item.publicationDate > today);
  const review = contents.data.filter((item) => item.status === "review");
  const revision = contents.data.filter((item) => item.status === "revision");
  const published = contents.data.filter((item) => item.status === "published");
  const hasContent = contents.data.length > 0;

  const last7Days = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
  const productionSpark = last7Days.map((day) => contents.data.filter((item) => item.publicationDate === day).length);
  const reviewSpark = last7Days.map((day) => contents.data.filter((item) => (item.reviewDate === day) && (item.status === "review" || item.status === "revision")).length);
  const publishRate = contents.data.length ? Math.round((published.length / contents.data.length) * 100) : 0;

  const { year: adYear, month: adMonth } = getCurrentJalaliMonth();
  const adMonthAds = contents.data.filter((item) => item.contentKind === "advertisement" && isSameJalaliMonth(item.publicationDate, adYear, adMonth));
  const adSpent = adMonthAds.reduce((sum, item) => sum + (item.adBudgetAmount ?? 0), 0);
  const adBudget = workspace.data.adBudgets.find((item) => item.jalaliMonth === `${adYear}-${String(adMonth).padStart(2, "0")}`);
  const adPercent = adBudget?.amount ? Math.min(100, Math.round((adSpent / adBudget.amount) * 100)) : 0;

  const roadmapItems = [...overdue, ...plannedToday, ...upcoming].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index).sort((a, b) => a.publicationDate.localeCompare(b.publicationDate)).slice(0, 8);

  const teamProfiles = [...workspace.data.userProfiles].sort((a, b) => a.displayName.localeCompare(b.displayName, "fa")).slice(0, 6);

  return <div className="page dashboard-page">
    <PageHeader
      title="داشبورد زمبیل"
      description={formatJalaliDate(today, { includeWeekday: true })}
      actions={<div className="dashboard-header-actions">
        <div className="avatar-stack">{teamProfiles.map((profile) => <span className="avatar-stack-item" key={profile.userId} title={profile.displayName}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initialsOf(profile.displayName)}</span>)}</div>
        {hasPermission("users.create") && <Button variant="secondary" size="sm" onClick={() => navigate("/settings")}><UserPlus size={16} />افزودن کاربر</Button>}
      </div>}
    />
    {!hasContent ? <section className="welcome-panel"><div><span className="eyebrow">شروع فضای کاری</span><h2>برنامه محتوای شما از همین جا شکل می گیرد.</h2><p>یک آیتم بسازید، تقویم را باز کنید یا داده های قبلی تان را وارد کنید.</p></div><div className="welcome-actions"><Button onClick={() => openContentDialog({ quick: true })}><Plus size={18} />ساخت اولین محتوا</Button><Button variant="secondary" onClick={() => navigate("/calendar")}>باز کردن تقویم</Button></div></section> : <>
      <section className="stat-grid" aria-label="خلاصه وضعیت محتوا">
        <article className="stat-card">
          <div className="stat-card-head"><span>تولید ۷ روز اخیر</span><CalendarClock size={16} /></div>
          <strong>{plannedToday.length.toLocaleString("fa-IR")}</strong><small>محتوای امروز</small>
          <Sparkline values={productionSpark} tone="primary" />
        </article>
        <article className="stat-card">
          <div className="stat-card-head"><span>بررسی و اصلاح</span><ClipboardCheck size={16} /></div>
          <strong>{(review.length + revision.length).toLocaleString("fa-IR")}</strong><small>نیازمند رسیدگی</small>
          <Sparkline values={reviewSpark} tone="amber" />
        </article>
        <article className="stat-card stat-card-money">
          <div className="stat-card-head"><span>بودجه تبلیغات {adBudget ? "" : "(ثبت نشده)"}</span><Wallet size={16} /></div>
          <strong>{adSpent.toLocaleString("fa-IR")}<small> از {(adBudget?.amount ?? 0).toLocaleString("fa-IR")} تومان</small></strong>
          <div className="progress-track"><span style={{ width: `${adPercent}%` }} /></div>
        </article>
        <article className="stat-card stat-card-donut">
          <div className="stat-card-head"><span>نرخ انتشار</span><Send size={16} /></div>
          <DonutGauge percent={publishRate} sublabel={`${published.length.toLocaleString("fa-IR")}/${contents.data.length.toLocaleString("fa-IR")}`} tone="teal" />
        </article>
      </section>
      <section className="dashboard-grid-v2">
        <div className="dashboard-main-col">
          <RoadmapPanel items={roadmapItems} onSelect={setSelected} emptyAction={<Button size="sm" onClick={() => openContentDialog({ date: today, quick: true })}><Plus size={15} />افزودن محتوا</Button>} />
          <ContentSection title="منتشرشده های اخیر" subtitle="برای گزارش عملکرد و استفاده دوباره" items={published.slice(0, 5)} onSelect={setSelected} />
        </div>
        <div className="dashboard-side-col">
          {user && <MyTasksWidget tasks={workspace.data.tasks} userId={user.id} userName={`${user.firstName} ${user.lastName}`.trim()} />}
          <IdeaPanel ideas={workspace.data.ideas.filter((item) => !item.archivedAt).slice(0, 4)} />
        </div>
      </section>
    </>}
    <ContentDetailDrawer content={selected} workspace={workspace.data} onClose={() => setSelected(null)} />
  </div>;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return (parts[0][0] ?? "") + (parts[1]?.[0] ?? "");
}

function RoadmapPanel({ items, onSelect, emptyAction }: { items: Content[]; onSelect: (item: Content) => void; emptyAction: ReactNode }) {
  const today = todayIso();
  return <section className="surface roadmap-panel">
    <div className="section-heading"><div><h2>نقشه راه محتوا</h2><p>محتواهای عقب‌افتاده، امروز و پیش‌ رو در یک نگاه</p></div></div>
    {items.length ? <div className="roadmap-list">{items.map((item) => {
      const status = STATUS_META[item.status];
      const overdue = Boolean(item.deadline && item.deadline < today && !["published", "cancelled"].includes(item.status));
      const doneChecks = item.checklist.filter((check) => check.completed).length;
      return <button type="button" className="roadmap-row" key={item.id} onClick={() => onSelect(item)}>
        <span className="roadmap-date">{formatJalaliDate(item.publicationDate)}{overdue && <em>عقب‌افتاده</em>}</span>
        <span className="roadmap-bar" style={{ background: status.color }}>
          <strong>{item.title}</strong>
          <span className="roadmap-meta">
            {item.checklist.length > 0 && <span><ClipboardCheck size={11} />{doneChecks}/{item.checklist.length}</span>}
            {item.attachments.length > 0 && <span><Paperclip size={11} />{item.attachments.length}</span>}
          </span>
        </span>
        <StatusBadge status={item.status} label={status.label} color={status.color} />
      </button>;
    })}</div> : <div className="compact-empty"><Clock3 size={19} /><span>موردی برای نمایش نیست.</span>{emptyAction}</div>}
  </section>;
}

function MyTasksWidget({ tasks, userId, userName }: { tasks: TaskItem[]; userId: string; userName: string }) {
  const queryClient = useQueryClient();
  const { pushToast } = useUIStore();
  const logActivity = useActivityLogger();
  const [quickTitle, setQuickTitle] = useState("");
  const mine = tasks.filter((item) => item.assigneeUserId === userId && item.status !== "done" && !item.archivedAt).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")).slice(0, 5);

  const patchTasks = (updater: (list: TaskItem[]) => TaskItem[]) => {
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, tasks: updater(current.tasks) } : current);
  };

  const toggleDone = async (task: TaskItem) => {
    try {
      const saved = await contentRepository.saveTask({ ...task, status: "done" });
      patchTasks((list) => [...list.filter((item) => item.id !== saved.id), saved]);
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "به‌روزرسانی وظیفه ممکن نشد." });
    }
  };

  const quickAdd = async () => {
    if (quickTitle.trim().length < 2) return;
    const now = new Date().toISOString();
    try {
      const saved = await contentRepository.saveTask({ id: crypto.randomUUID(), title: quickTitle.trim(), notes: null, assigneeUserId: userId, status: "todo", priority: "normal", dueDate: null, createdByUserId: userId, createdByName: userName, createdAt: now, updatedAt: now, archivedAt: null, sortOrder: 0, version: 1 });
      patchTasks((list) => [...list, saved]);
      logActivity("task.create", "task", saved.id, saved.title);
      setQuickTitle("");
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "افزودن وظیفه ممکن نشد." });
    }
  };

  return <section className="surface my-tasks-widget">
    <div className="section-heading"><div><h2>تودو لیست من</h2><p>وظایف شخصی و قابل اتصال به تقویم</p></div><CheckSquare size={20} /></div>
    <div className="my-tasks-quick-add"><Input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="وظیفه سریع..." onKeyDown={(event) => { if (event.key === "Enter") void quickAdd(); }} /><button type="button" onClick={() => void quickAdd()} aria-label="افزودن وظیفه"><Plus size={15} /></button></div>
    {mine.length ? <div className="my-tasks-list">{mine.map((task) => <div className={`my-task-row priority-${task.priority}`} key={task.id}>
      <button type="button" onClick={() => void toggleDone(task)} aria-label="انجام شد"><CheckSquare size={16} /></button>
      <div><strong>{task.title}</strong>{task.dueDate && <small>{formatJalaliDate(task.dueDate)}</small>}</div>
      <span>{PRIORITY_LABEL[task.priority]}</span>
    </div>)}</div> : <div className="compact-empty"><CheckSquare size={19} /><span>وظیفه‌ای برای شما ثبت نشده.</span></div>}
    <a className="my-tasks-link" href="#/tasks">مشاهده تودو لیست کامل تیم</a>
  </section>;
}

function ContentSection({ title, subtitle, items, onSelect }: { title: string; subtitle: string; items: Content[]; onSelect: (item: Content) => void }) {
  return <section className="surface content-section"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{items.length ? <div className="content-mini-list">{items.map((item) => { const status = STATUS_META[item.status]; return <button className="mini-content" type="button" key={item.id} onClick={() => onSelect(item)}><span className="mini-time">{item.publicationTime ?? "بدون ساعت"}</span><span className="mini-title">{item.title}</span><StatusBadge status={item.status} label={status.label} color={status.color} /></button>; })}</div> : <div className="compact-empty"><Clock3 size={19} /><span>موردی برای نمایش نیست.</span></div>}</section>;
}

function IdeaPanel({ ideas }: { ideas: ContentIdea[] }) {
  return <section className="surface idea-dashboard-panel"><div className="section-heading"><div><h2>ایده های اخیر</h2><p>ایده های خام آماده برای تبدیل به محتوا</p></div><Lightbulb size={20} /></div>{ideas.length ? <div className="idea-rank-list">{ideas.map((idea) => <div key={idea.id}><strong>{idea.title}</strong><small>{PRIORITY_LABEL[idea.priority]}</small></div>)}</div> : <div className="compact-empty"><Lightbulb size={19} /><span>هنوز ایده ای ثبت نشده است.</span></div>}</section>;
}

function DashboardSkeleton() { return <div className="page"><div className="skeleton heading-skeleton" /><div className="stat-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton metric-skeleton" key={index} />)}</div><div className="dashboard-grid-v2">{Array.from({ length: 3 }, (_, index) => <div className="skeleton panel-skeleton" key={index} />)}</div></div>; }
