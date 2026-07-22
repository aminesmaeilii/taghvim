import { CalendarRange, ChevronLeft, ChevronRight, Filter, Megaphone, Search, Smartphone } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/app-shell";
import { EmptyState, Input, Select } from "../../components/ui";
import { ContentDetailDrawer } from "../content/content-detail-drawer";
import { STATUS_META } from "@shared/constants/defaults";
import { useContents, useWorkspace } from "../../hooks/use-workspace";
import type { Campaign, Content } from "@shared/types/domain";
import { addDays, addJalaliMonths, formatJalaliDate, formatJalaliMonth, getCurrentJalaliMonth, isoToJalaliParts, jalaliToIso, todayIso } from "@shared/utils/jalali";

function monthDays(year: number, month: number): string[] {
  const start = jalaliToIso(year, month, 1);
  const next = addJalaliMonths(year, month, 1);
  const end = jalaliToIso(next.year, next.month, 1);
  const days: string[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

function contentSpan(content: Content): { start: string; end: string } {
  const candidates = [content.startDate, content.productionDate, content.publicationDate, content.deadline].filter((value): value is string => Boolean(value));
  return { start: candidates.reduce((min, value) => (value < min ? value : min)), end: candidates.reduce((max, value) => (value > max ? value : max)) };
}

function overlaps(start: string, end: string, rangeStart: string, rangeEnd: string): boolean { return end >= rangeStart && start <= rangeEnd; }

function isWeekend(day: string): boolean { return (new Date(`${day}T12:00:00`).getDay() + 1) % 7 === 6; }

function barStyle(days: string[], start: string, end: string): { gridColumn: string } | null {
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];
  if (!overlaps(start, end, rangeStart, rangeEnd)) return null;
  const clippedStart = start < rangeStart ? rangeStart : start;
  const clippedEnd = end > rangeEnd ? rangeEnd : end;
  const startIndex = days.indexOf(clippedStart);
  const endIndex = days.indexOf(clippedEnd);
  if (startIndex === -1 || endIndex === -1) return null;
  return { gridColumn: `${startIndex + 1} / ${endIndex + 2}` };
}

type GanttRow =
  | { kind: "group"; key: string; campaign: Campaign | null }
  | { kind: "content"; key: string; content: Content };

export function GanttPage() {
  const workspace = useWorkspace();
  const contents = useContents();
  const navigate = useNavigate();
  const initial = getCurrentJalaliMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState<Content["status"] | "">("");
  const [selected, setSelected] = useState<Content | null>(null);

  if (workspace.isLoading || contents.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!workspace.data || !contents.data) return <div className="page"><EmptyState title="گانت چارت در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;

  const days = monthDays(year, month);
  const today = todayIso();
  const todayIndex = days.indexOf(today);
  const changeMonth = (delta: number) => { const next = addJalaliMonths(year, month, delta); setYear(next.year); setMonth(next.month); };
  const goToday = () => { const current = getCurrentJalaliMonth(); setYear(current.year); setMonth(current.month); };

  const filtered = contents.data.filter((item) =>
    !item.archivedAt &&
    (!search || item.title.toLocaleLowerCase("fa").includes(search.toLocaleLowerCase("fa"))) &&
    (!platform || item.platformId === platform) &&
    (!status || item.status === status) &&
    overlaps(contentSpan(item).start, contentSpan(item).end, days[0], days[days.length - 1]),
  );

  const rows: GanttRow[] = [];
  for (const campaign of workspace.data.campaigns.filter((item) => !item.archivedAt)) {
    const items = filtered.filter((item) => item.campaignId === campaign.id);
    const campaignSpans = campaign.startDate && campaign.endDate && overlaps(campaign.startDate, campaign.endDate, days[0], days[days.length - 1]);
    if (!items.length && !campaignSpans) continue;
    rows.push({ kind: "group", key: `group-${campaign.id}`, campaign });
    for (const item of items) rows.push({ kind: "content", key: item.id, content: item });
  }
  const orphan = filtered.filter((item) => !item.campaignId);
  if (orphan.length) {
    rows.push({ kind: "group", key: "group-none", campaign: null });
    for (const item of orphan) rows.push({ kind: "content", key: item.id, content: item });
  }
  const legendStatuses = [...new Set(filtered.map((item) => item.status))];
  const weekendColumns = days.reduce<number[]>((acc, day, index) => { if (isWeekend(day)) acc.push(index); return acc; }, []);

  return <div className="page gantt-page">
    <PageHeader title="گانت چارت کمپین‌ها و محتوا" description="روند تولید تا انتشار محتوا و بازه کمپین‌ها را در یک نگاه ببینید؛ برای جزئیات روی هر ردیف کلیک کنید." />
    <div className="gantt-mobile-hint"><Smartphone size={16} /><span>این نما برای صفحه‌های بزرگ‌تر بهینه‌تر است؛ برای دیدن کامل هر ماه به‌صورت افقی اسکرول کنید.</span></div>
    <section className="calendar-toolbar surface">
      <div className="calendar-navigation"><button type="button" className="icon-button" aria-label="ماه قبل" onClick={() => changeMonth(-1)}><ChevronRight size={19} /></button><strong>{formatJalaliMonth(year, month)}</strong><button type="button" className="icon-button" aria-label="ماه بعد" onClick={() => changeMonth(1)}><ChevronLeft size={19} /></button><button type="button" className="button button-secondary button-sm" onClick={goToday}>امروز</button></div>
      <div className="calendar-controls"><label className="search-field"><Search size={17} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو" /></label><label className="filter-control"><Filter size={16} /><Select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="">همه پلتفرم‌ها</option>{workspace.data.platforms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label className="filter-control"><CalendarRange size={16} /><Select value={status} onChange={(event) => setStatus(event.target.value as Content["status"] | "")}><option value="">همه وضعیت‌ها</option>{Object.entries(STATUS_META).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</Select></label></div>
    </section>
    {rows.length ? <section className="surface gantt-chart">
      {legendStatuses.length > 0 && <div className="gantt-legend">{legendStatuses.map((key) => <span key={key}><i style={{ backgroundColor: STATUS_META[key].color }} />{STATUS_META[key].label}</span>)}{filtered.some((item) => item.contentKind === "advertisement") && <span><Megaphone size={11} />تبلیغ</span>}</div>}
      <div className="gantt-header" style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(26px, 1fr))` }}>
        <span className="gantt-corner" />
        {days.map((day) => { const { jd } = isoToJalaliParts(day); return <span key={day} className={day === today ? "gantt-day-today" : isWeekend(day) ? "gantt-day-weekend" : ""}>{jd.toLocaleString("fa-IR")}</span>; })}
      </div>
      <div className="gantt-body" style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(26px, 1fr))` }}>
        {weekendColumns.map((index) => <span key={index} className="gantt-weekend-col" style={{ gridColumn: `${index + 2} / ${index + 3}` }} />)}
        {todayIndex >= 0 && <span className="gantt-today-line" style={{ gridColumn: `${todayIndex + 2} / ${todayIndex + 3}` }} />}
        {rows.map((row) => {
          if (row.kind === "group") {
            const campaign = row.campaign;
            const campaignStyle = campaign?.startDate && campaign.endDate ? barStyle(days, campaign.startDate, campaign.endDate) : null;
            return <div className="gantt-row gantt-row-group" key={row.key}>
              <button type="button" className="gantt-row-label" disabled={!campaign} onClick={() => campaign && navigate("/campaigns")}>{campaign?.title ?? "بدون کمپین"}</button>
              {campaignStyle ? <button type="button" className="gantt-bar gantt-bar-campaign" style={campaignStyle} onClick={() => navigate("/campaigns")} title={`${formatJalaliDate(campaign?.startDate ?? "")} تا ${formatJalaliDate(campaign?.endDate ?? "")}`} /> : <span className="gantt-row-track" style={{ gridColumn: `2 / ${days.length + 2}` }} />}
            </div>;
          }
          const { content } = row;
          const span = contentSpan(content);
          const style = barStyle(days, span.start, span.end);
          const meta = STATUS_META[content.status];
          const isAd = content.contentKind === "advertisement";
          return <div className="gantt-row" key={row.key}><span className="gantt-row-label gantt-row-label-sub">{content.title}</span>{style && <button type="button" className={`gantt-bar ${isAd ? "gantt-bar-ad" : ""}`} style={{ ...style, backgroundColor: meta.color }} onClick={() => setSelected(content)} title={`${content.title} · ${formatJalaliDate(span.start)} تا ${formatJalaliDate(span.end)}`}>{isAd && <Megaphone size={11} />}</button>}</div>;
        })}
      </div>
    </section> : <EmptyState title="موردی در این ماه پیدا نشد" description="فیلترها را تغییر دهید یا ماه دیگری را انتخاب کنید." />}
    <ContentDetailDrawer content={selected} workspace={workspace.data} onClose={() => setSelected(null)} />
  </div>;
}
