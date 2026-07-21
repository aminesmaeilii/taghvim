import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../../components/app-shell";
import { Button, IconButton } from "../../components/ui";
import { addJalaliMonths, formatJalaliDate, formatJalaliMonth, getCurrentJalaliMonth, isoToJalaliParts, isSameJalaliMonth, JALALI_WEEKDAYS, jalaliMonthDays, todayIso } from "@shared/utils/jalali";

export function JalaliCalendarPage() {
  const current = getCurrentJalaliMonth();
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const today = todayIso();
  const days = useMemo(() => jalaliMonthDays(year, month), [month, year]);
  const changeMonth = (delta: number) => {
    const next = addJalaliMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  };
  const goToday = () => { setYear(current.year); setMonth(current.month); };
  return <div className="page"><PageHeader title="تقویم شمسی" description={formatJalaliDate(today, { includeWeekday: true })} />
    <section className="surface calendar-toolbar"><div className="calendar-navigation"><IconButton label="ماه قبل" onClick={() => changeMonth(-1)}><ChevronRight size={19} /></IconButton><strong>{formatJalaliMonth(year, month)}</strong><IconButton label="ماه بعد" onClick={() => changeMonth(1)}><ChevronLeft size={19} /></IconButton><Button size="sm" variant="secondary" onClick={goToday}>امروز</Button></div></section>
    <section className="calendar-grid surface" aria-label={formatJalaliMonth(year, month)}><div className="calendar-weekdays">{JALALI_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{days.map((date) => { const parts = isoToJalaliParts(date); return <div className={`calendar-day ${isSameJalaliMonth(date, year, month) ? "" : "outside"} ${date === today ? "today" : ""}`} key={date}><div className="day-header"><span className="day-number">{parts.jd.toLocaleString("fa-IR")}</span></div></div>; })}</div></section>
  </div>;
}
