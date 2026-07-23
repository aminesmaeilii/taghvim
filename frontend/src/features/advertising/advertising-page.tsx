import { ChevronLeft, ChevronRight, Megaphone, Plus, Save, Wallet } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, Dialog, EmptyState, Field, IconButton, Input, Select, StatusBadge, Textarea } from "../../components/ui";
import { JalaliDateInput } from "../../components/jalali-date-input";
import { STATUS_META } from "@shared/constants/defaults";
import { useAuth } from "../../hooks/use-auth-context";
import { useActivityLogger, useCurrentProfile } from "../../hooks/use-profile";
import { useWorkspace, workspaceKey } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import { ForwardButton } from "../chat/forward-button";
import type { AdBudget, Content, ContentStatusKey, WorkspaceData } from "@shared/types/domain";
import { addJalaliMonths, formatJalaliDate, formatJalaliMonth, getCurrentJalaliMonth, isSameJalaliMonth, jalaliToIso, todayIso } from "@shared/utils/jalali";

export function AdvertisingPage() {
  const workspace = useWorkspace();
  const { user } = useAuth();
  const { profile } = useCurrentProfile();
  const logActivity = useActivityLogger();
  const queryClient = useQueryClient();
  const { pushToast } = useUIStore();
  const initial = getCurrentJalaliMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");
  const [editing, setEditing] = useState<Content | null>(null);
  const [creating, setCreating] = useState(false);

  if (workspace.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!workspace.data) return <div className="page"><EmptyState title="بخش تبلیغات در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const ads = workspace.data.contents.filter((item) => item.contentKind === "advertisement" && !item.archivedAt && isSameJalaliMonth(item.publicationDate, year, month)).sort((a, b) => a.publicationDate.localeCompare(b.publicationDate));
  const spent = ads.reduce((sum, item) => sum + (item.adBudgetAmount ?? 0), 0);
  const budget = workspace.data.adBudgets.find((item) => item.jalaliMonth === monthKey);
  const changeMonth = (delta: number) => { const next = addJalaliMonths(year, month, delta); setYear(next.year); setMonth(next.month); setBudgetAmount(""); setBudgetNotes(""); };

  const patchAds = (updater: (list: Content[]) => Content[]) => {
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, contents: updater(current.contents) } : current);
  };
  const patchBudgets = (updater: (list: AdBudget[]) => AdBudget[]) => {
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, adBudgets: updater(current.adBudgets) } : current);
  };

  const saveBudget = async () => {
    const amount = Number(budgetAmount || budget?.amount || 0);
    if (!amount) return;
    const now = new Date().toISOString();
    try {
      const saved = await contentRepository.saveAdBudget({ id: budget?.id ?? crypto.randomUUID(), jalaliMonth: monthKey, amount, notes: budgetNotes.trim() || budget?.notes || null, updatedByName: user ? `${user.firstName} ${user.lastName}`.trim() : null, updatedByRole: profile?.jobRole ?? null, createdAt: budget?.createdAt ?? now, updatedAt: now });
      patchBudgets((list) => [...list.filter((item) => item.id !== saved.id), saved]);
      setBudgetAmount(""); setBudgetNotes("");
      pushToast({ title: "بودجه ماهانه ذخیره شد." });
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "ذخیره بودجه ممکن نشد." });
    }
  };

  const saveAd = async (payload: Content) => {
    const isNew = !ads.some((item) => item.id === payload.id) && !workspace.data?.contents.some((item) => item.id === payload.id);
    const stamped: Content = { ...payload, contentKind: "advertisement", updatedByName: user ? `${user.firstName} ${user.lastName}`.trim() : null, updatedByRole: profile?.jobRole ?? null };
    try {
      const saved = await contentRepository.saveContent(stamped);
      patchAds((list) => [...list.filter((item) => item.id !== saved.id), saved]);
      logActivity(isNew ? "advertisement.create" : "advertisement.update", "advertisement", saved.id, saved.title);
      setCreating(false); setEditing(null);
      pushToast({ title: "تبلیغ ذخیره شد." });
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "ذخیره تبلیغ ممکن نشد." });
    }
  };

  return <div className="page advertising-page">
    <PageHeader title="تبلیغات" description="بودجه ماهانه را مشخص کنید و هر تبلیغ را جداگانه ثبت کنید؛ هر تبلیغ در تقویم محتوا و گردش کار هم نمایش داده می شود." actions={<Button onClick={() => setCreating(true)}><Plus size={18} />ثبت تبلیغ</Button>} />
    <section className="calendar-toolbar surface"><div className="calendar-navigation"><IconButton label="ماه قبل" onClick={() => changeMonth(-1)}><ChevronRight size={19} /></IconButton><strong>{formatJalaliMonth(year, month)}</strong><IconButton label="ماه بعد" onClick={() => changeMonth(1)}><ChevronLeft size={19} /></IconButton></div></section>
    <section className="surface ad-budget-panel">
      <header><Wallet size={20} /><div><h2>بودجه {formatJalaliMonth(year, month)}</h2><p>{budget ? `آخرین ثبت توسط ${budget.updatedByName ?? "-"}` : "هنوز بودجه ای برای این ماه ثبت نشده است."}</p></div></header>
      <div className="ad-budget-summary"><strong>{spent.toLocaleString("fa-IR")}</strong><span>از {(budget?.amount ?? 0).toLocaleString("fa-IR")} تومان بودجه</span></div>
      <div className="progress-track"><span style={{ width: `${budget?.amount ? Math.min(100, Math.round((spent / budget.amount) * 100)) : 0}%` }} /></div>
      <div className="ad-budget-form"><Input type="number" placeholder={budget ? String(budget.amount) : "مبلغ بودجه به تومان"} value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} /><Input placeholder="یادداشت اختیاری" value={budgetNotes} onChange={(event) => setBudgetNotes(event.target.value)} /><Button size="sm" onClick={() => void saveBudget()}><Save size={15} />ثبت بودجه</Button>{budget && <ForwardButton entity={{ type: "ad_budget", id: budget.id, title: `بودجه ${formatJalaliMonth(year, month)}`, label: "بودجه تبلیغات", description: `${budget.amount.toLocaleString("fa-IR")} تومان` }} />}</div>
    </section>
    {ads.length ? <section className="surface ad-list">{ads.map((ad) => { const status = STATUS_META[ad.status]; const platform = workspace.data?.platforms.find((item) => item.id === ad.platformId); return <button type="button" className="ad-row" key={ad.id} onClick={() => setEditing(ad)}>
      <Megaphone size={18} />
      <div><strong>{ad.title}</strong><small>{platform?.name ?? "بدون پلتفرم"} · {formatJalaliDate(ad.publicationDate)}</small></div>
      <StatusBadge status={ad.status} label={status.label} color={status.color} />
      <span className="ad-row-amount">{(ad.adBudgetAmount ?? 0).toLocaleString("fa-IR")} تومان</span>
    </button>; })}</section> : <EmptyState title="تبلیغی برای این ماه ثبت نشده" description="با دکمه «ثبت تبلیغ» اولین مورد این ماه را اضافه کنید." action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} />ثبت تبلیغ</Button>} />}
    <AdDialog open={creating || Boolean(editing)} ad={editing} defaultDate={jalaliToIso(year, month, 1)} workspace={workspace.data} onClose={() => { setCreating(false); setEditing(null); }} onSave={saveAd} />
  </div>;
}

function AdDialog({ open, ad, defaultDate, workspace, onClose, onSave }: { open: boolean; ad: Content | null; defaultDate: string; workspace: NonNullable<ReturnType<typeof useWorkspace>["data"]>; onClose: () => void; onSave: (content: Content) => Promise<void> }) {
  const [title, setTitle] = useState(ad?.title ?? "");
  const [platformId, setPlatformId] = useState(ad?.platformId ?? workspace.platforms[0]?.id ?? "");
  const [publicationDate, setPublicationDate] = useState(ad?.publicationDate ?? defaultDate);
  const [status, setStatus] = useState<ContentStatusKey>(ad?.status ?? "scheduled");
  const [amount, setAmount] = useState(String(ad?.adBudgetAmount ?? ""));
  const [note, setNote] = useState(ad?.adPlatformNote ?? "");
  const persist = async () => {
    if (title.trim().length < 2 || !platformId) return;
    const base: Content = ad ?? { id: crypto.randomUUID(), createdAt: "", updatedAt: "", archivedAt: null, sortOrder: 0, version: 0, contentVersion: 1, typeId: workspace.types[0]?.id ?? "", platformId: "", campaignId: null, pillarId: null, tagIds: [], owner: null, reviewer: null, publisher: null, priority: "normal", status: "draft", publicationDate: todayIso(), publicationTime: null, timezone: "Asia/Tehran", startDate: null, deadline: null, productionDate: null, reviewDate: null, recurrence: null, caption: null, mainCopy: null, hook: null, callToAction: null, hashtags: null, keywords: null, link: null, sourceLink: null, notes: null, checklist: [], attachments: [], performance: null, title: "" };
    await onSave({ ...base, title: title.trim(), platformId, publicationDate, status, adBudgetAmount: Number(amount) || 0, adPlatformNote: note.trim() || null, contentKind: "advertisement" });
  };
  return <Dialog open={open} title={ad ? "ویرایش تبلیغ" : "ثبت تبلیغ جدید"} onClose={onClose}>
    <div className="form-grid">
      <Field label="عنوان تبلیغ"><input className="input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="پلتفرم"><Select value={platformId} onChange={(event) => setPlatformId(event.target.value)}><option value="">انتخاب پلتفرم</option>{workspace.platforms.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      <Field label="تاریخ نمایش جلالی"><JalaliDateInput value={publicationDate} onChange={setPublicationDate} /></Field>
      <Field label="وضعیت"><Select value={status} onChange={(event) => setStatus(event.target.value as ContentStatusKey)}>{Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</Select></Field>
      <Field label="هزینه (تومان)"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
      <Field label="یادداشت تبلیغ" optional><Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </div>
    <footer className="dialog-footer"><Button variant="secondary" onClick={onClose}>انصراف</Button><Button onClick={() => void persist()}>ذخیره تبلیغ</Button></footer>
  </Dialog>;
}
