import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, ListFilter, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState, IconButton, Input, Select, StatusBadge } from "../../components/ui";
import { STATUS_META } from "@shared/constants/defaults";
import { useContents, useWorkspace } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import type { Content, ContentFilters } from "@shared/types/domain";
import { addDays, addJalaliMonths, formatJalaliDate, formatJalaliMonth, getCurrentJalaliMonth, isoToJalaliParts, isSameJalaliMonth, JALALI_WEEKDAYS, jalaliMonthDays, startOfJalaliWeek, todayIso } from "@shared/utils/jalali";
import { ContentDetailDrawer } from "../content/content-detail-drawer";

type CalendarView = "month" | "week" | "day" | "agenda";

export function CalendarPage() {
  const initial = getCurrentJalaliMonth();
  const [view, setView] = useState<CalendarView>("month");
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [focusDate, setFocusDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Content["status"] | "">("");
  const [selected, setSelected] = useState<Content | null>(null);
  const { openContentDialog, pushToast } = useUIStore();
  const workspace = useWorkspace();
  const filters: ContentFilters = { search: search || undefined, status: status ? [status] : undefined };
  const contents = useContents(filters);
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  if (workspace.isLoading || contents.isLoading) return <CalendarLoading />;
  if (!workspace.data || !contents.data) return <div className="page"><EmptyState title="تقویم در دسترس نیست" description="داده های برنامه را دوباره بارگذاری کنید." /></div>;
  const changeMonth = (delta: number) => { const next = addJalaliMonths(year, month, delta); setYear(next.year); setMonth(next.month); };
  const goToday = () => { const current = getCurrentJalaliMonth(); setYear(current.year); setMonth(current.month); setFocusDate(todayIso()); };
  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || typeof active.id !== "string" || typeof over.id !== "string" || !over.id.startsWith("day:")) return;
    const content = contents.data.find((item) => item.id === active.id);
    const nextDate = over.id.slice(4);
    if (!content || content.publicationDate === nextDate) return;
    const previousDate = content.publicationDate;
    try {
      await contentRepository.moveContent(content.id, nextDate);
      await queryClient.invalidateQueries({ queryKey: ["contents"] });
      pushToast({ title: `«${content.title}» جابه جا شد.`, action: { label: "بازگردانی", onClick: () => { void contentRepository.moveContent(content.id, previousDate).then(() => queryClient.invalidateQueries({ queryKey: ["contents"] })); } } });
    } catch { pushToast({ title: "جابه جایی محتوا ممکن نشد." }); }
  };
  const selectDate = (date: string) => { setFocusDate(date); const parts = isoToJalaliParts(date); setYear(parts.jy); setMonth(parts.jm); };
  return <div className="page calendar-page">
    <PageHeader title="تقویم محتوا" description="برنامه انتشار را با تاریخ جلالی، پلتفرم و وضعیت پیگیری کنید." actions={<Button onClick={() => openContentDialog({ quick: true })}><Plus size={18} />افزودن محتوا</Button>} />
    <section className="calendar-toolbar surface">
      <div className="calendar-navigation"><IconButton label="ماه قبل" onClick={() => changeMonth(-1)}><ChevronRight size={19} /></IconButton><Button size="sm" variant="secondary" onClick={goToday}>امروز</Button><IconButton label="ماه بعد" onClick={() => changeMonth(1)}><ChevronLeft size={19} /></IconButton><strong>{formatJalaliMonth(year, month)}</strong></div>
      <div className="view-tabs" role="tablist" aria-label="نمای تقویم">{(["month", "week", "day", "agenda"] as CalendarView[]).map((item) => <button key={item} type="button" className={view === item ? "active" : ""} onClick={() => setView(item)}>{({ month: "ماه", week: "هفته", day: "روز", agenda: "فهرست" })[item]}</button>)}</div>
      <div className="calendar-controls"><label className="search-field"><Search size={17} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو" /></label><label className="filter-control"><ListFilter size={16} /><Select value={status} onChange={(event) => setStatus(event.target.value as Content["status"] | "")} aria-label="فیلتر وضعیت"><option value="">همه وضعیت ها</option>{Object.entries(STATUS_META).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</Select></label></div>
    </section>
    <DndContext sensors={sensors} onDragEnd={(event) => void onDragEnd(event)}>{view === "month" && <MonthView year={year} month={month} contents={contents.data} onAdd={(date) => openContentDialog({ date, quick: true })} onSelect={setSelected} onDateSelect={selectDate} />}{view === "week" && <ScheduleView dates={Array.from({ length: 7 }, (_, index) => addDays(startOfJalaliWeek(focusDate), index))} contents={contents.data} onAdd={(date) => openContentDialog({ date, quick: true })} onSelect={setSelected} />}{view === "day" && <ScheduleView dates={[focusDate]} contents={contents.data} onAdd={(date) => openContentDialog({ date, quick: true })} onSelect={setSelected} />}{view === "agenda" && <AgendaView contents={contents.data} onSelect={setSelected} />}</DndContext>
    <ContentDetailDrawer content={selected} workspace={workspace.data} onClose={() => setSelected(null)} />
  </div>;
}

function MonthView({ year, month, contents, onAdd, onSelect, onDateSelect }: { year: number; month: number; contents: Content[]; onAdd: (date: string) => void; onSelect: (content: Content) => void; onDateSelect: (date: string) => void }) {
  const days = jalaliMonthDays(year, month);
  return <section className="calendar-grid surface" aria-label={formatJalaliMonth(year, month)}><div className="calendar-weekdays">{JALALI_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{days.map((date) => <CalendarDay key={date} date={date} inMonth={isSameJalaliMonth(date, year, month)} contents={contents.filter((item) => item.publicationDate === date)} onAdd={onAdd} onSelect={onSelect} onDateSelect={onDateSelect} />)}</div></section>;
}

function CalendarDay({ date, inMonth, contents, onAdd, onSelect, onDateSelect }: { date: string; inMonth: boolean; contents: Content[]; onAdd: (date: string) => void; onSelect: (content: Content) => void; onDateSelect: (date: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  const { jd } = isoToJalaliParts(date);
  const today = date === todayIso();
  return <div ref={setNodeRef} className={`calendar-day ${inMonth ? "" : "outside"} ${today ? "today" : ""} ${isOver ? "drag-over" : ""}`}><div className="day-header"><button type="button" className="day-number" onClick={() => onDateSelect(date)} aria-label={`نمایش ${formatJalaliDate(date)}`}>{jd.toLocaleString("fa-IR")}</button>{inMonth && <IconButton label={`افزودن محتوا در ${formatJalaliDate(date)}`} onClick={() => onAdd(date)}><Plus size={15} /></IconButton>}</div><div className="calendar-content-list">{contents.slice(0, 3).map((item) => <DraggableCard key={item.id} content={item} onClick={() => onSelect(item)} />)}{contents.length > 3 && <span className="more-count">{(contents.length - 3).toLocaleString("fa-IR")} مورد دیگر</span>}</div></div>;
}

function DraggableCard({ content, onClick }: { content: Content; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: content.id });
  const status = STATUS_META[content.status];
  return <button ref={setNodeRef} type="button" className="calendar-card" style={{ borderInlineStartColor: status.color, opacity: isDragging ? 0.45 : 1, transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }} onClick={onClick} {...listeners} {...attributes}><span>{content.publicationTime ?? ""}</span>{content.title}</button>;
}

function ScheduleView({ dates, contents, onAdd, onSelect }: { dates: string[]; contents: Content[]; onAdd: (date: string) => void; onSelect: (content: Content) => void }) {
  return <section className={`schedule-view surface ${dates.length === 1 ? "single-day" : ""}`}>{dates.map((date) => { const entries = contents.filter((item) => item.publicationDate === date); return <div className="schedule-column" key={date}><header><strong>{formatJalaliDate(date, { includeWeekday: true })}</strong><Button size="sm" variant="ghost" onClick={() => onAdd(date)}><Plus size={15} />افزودن</Button></header>{entries.length ? entries.map((item) => <ScheduleItem content={item} key={item.id} onClick={() => onSelect(item)} />) : <div className="schedule-empty">برنامه ای ندارد.</div>}</div>; })}</section>;
}

function ScheduleItem({ content, onClick }: { content: Content; onClick: () => void }) { const status = STATUS_META[content.status]; return <button type="button" className="schedule-item" onClick={onClick}><span className="schedule-time">{content.publicationTime ?? "بدون ساعت"}</span><strong>{content.title}</strong><StatusBadge status={content.status} label={status.label} color={status.color} /></button>; }

function AgendaView({ contents, onSelect }: { contents: Content[]; onSelect: (content: Content) => void }) { return <section className="agenda surface">{contents.length ? contents.map((item) => <ScheduleItem key={item.id} content={item} onClick={() => onSelect(item)} />) : <EmptyState title="محتوایی با این فیلتر پیدا نشد" description="فیلترها را پاک کنید یا یک محتوای جدید ایجاد کنید." />}</section>; }

function CalendarLoading() { return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton toolbar-skeleton" /><div className="skeleton calendar-skeleton" /></div>; }
