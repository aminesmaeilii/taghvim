import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { PageHeader } from "../../components/app-shell";
import { EmptyState, Field, Input, Select } from "../../components/ui";
import { JalaliDateInput } from "../../components/jalali-date-input";
import { useWorkspace } from "../../hooks/use-workspace";
import { MARKETING_ROLE_LABELS } from "@shared/constants/defaults";
import { MARKETING_ROLES, type MarketingRole } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";

const ACTION_LABELS: Record<string, string> = {
  "content.create": "ایجاد محتوا", "content.update": "ویرایش محتوا", "content.move": "جابه جایی محتوا",
  "content.status_change": "تغییر وضعیت محتوا", "content.archive": "بایگانی محتوا", "content.delete": "حذف محتوا", "content.duplicate": "تکثیر محتوا",
  "campaign.create": "ایجاد کمپین", "campaign.update": "ویرایش کمپین",
  "idea.create": "ایجاد ایده", "idea.update": "ویرایش ایده",
  "template.create": "ایجاد قالب", "template.update": "ویرایش قالب",
  "advertisement.create": "ثبت تبلیغ", "advertisement.update": "ویرایش تبلیغ",
};

function actionLabel(action: string): string { return ACTION_LABELS[action] ?? action; }

export function ActivityPage() {
  const workspace = useWorkspace();
  const [actor, setActor] = useState("");
  const [role, setRole] = useState<MarketingRole | "">("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const entries = useMemo(() => workspace.data?.activityLog ?? [], [workspace.data]);
  const actions = useMemo(() => [...new Set(entries.map((item) => item.action))], [entries]);
  if (workspace.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!workspace.data) return <div className="page"><EmptyState title="تاریخچه در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;
  const filtered = entries.filter((item) => {
    if (actor && !item.actorName.toLocaleLowerCase("fa").includes(actor.toLocaleLowerCase("fa"))) return false;
    if (role && item.actorRole !== role) return false;
    if (action && item.action !== action) return false;
    const date = item.createdAt.slice(0, 10);
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
  return <div className="page activity-page">
    <PageHeader title="تاریخچه تغییرات" description="تمام رویدادهای ثبت شده توسط اعضای تیم را به ترتیب زمانی ببینید." />
    <section className="filter-bar surface report-filters">
      <Field label="نام کاربر" optional><Input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="جستجوی نام" /></Field>
      <Field label="نقش شغلی" optional><Select value={role} onChange={(event) => setRole(event.target.value as MarketingRole | "")}><option value="">همه نقش ها</option>{MARKETING_ROLES.map((item) => <option key={item} value={item}>{MARKETING_ROLE_LABELS[item]}</option>)}</Select></Field>
      <Field label="نوع عملیات" optional><Select value={action} onChange={(event) => setAction(event.target.value)}><option value="">همه عملیات ها</option>{actions.map((item) => <option key={item} value={item}>{actionLabel(item)}</option>)}</Select></Field>
      <Field label="از تاریخ جلالی" optional><JalaliDateInput value={from} onChange={setFrom} /></Field>
      <Field label="تا تاریخ جلالی" optional><JalaliDateInput value={to} onChange={setTo} /></Field>
    </section>
    <section className="surface activity-list">
      {filtered.length ? filtered.map((item) => <div className="activity-row" key={item.id}>
        <History size={16} />
        <div><strong>{actionLabel(item.action)}</strong><span>{item.entityLabel}</span></div>
        <div className="activity-actor"><strong>{item.actorName}</strong>{item.actorRole && <small>{MARKETING_ROLE_LABELS[item.actorRole]}</small>}</div>
        <span className="activity-time">{formatJalaliDate(item.createdAt, { includeWeekday: false })}</span>
      </div>) : <EmptyState title="رویدادی پیدا نشد" description="فیلترها را تغییر دهید یا منتظر ثبت اولین تغییر بمانید." />}
    </section>
  </div>;
}
