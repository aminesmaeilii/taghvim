import { Archive, ChevronLeft, ChevronRight, ClipboardCopy, Download, Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState, IconButton, Input, Select, StatusBadge } from "../../components/ui";
import { STATUS_META } from "@shared/constants/defaults";
import { useContents, useWorkspace } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import type { Content, ContentFilters } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";
import { ContentDetailDrawer } from "./content-detail-drawer";
import { LastEditedTag } from "../../components/last-edited-tag";
import { useActivityLogger } from "../../hooks/use-profile";

const PAGE_SIZE = 10;

export function ContentListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState<Content["status"] | "">("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState<"date" | "updated" | "title">("date");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const { openContentDialog, pushToast } = useUIStore();
  const workspace = useWorkspace();
  const filters: ContentFilters = { search: search || undefined, status: status ? [status] : undefined, platformIds: platform ? [platform] : undefined };
  const contents = useContents(filters);
  const queryClient = useQueryClient();
  const logActivity = useActivityLogger();
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ["contents"] }); void queryClient.invalidateQueries({ queryKey: ["workspace"] }); setSelectedIds([]); };
  const sorted = useMemo(() => [...(contents.data ?? [])].sort((a, b) => sort === "title" ? a.title.localeCompare(b.title, "fa") : sort === "updated" ? b.updatedAt.localeCompare(a.updatedAt) : `${a.publicationDate}${a.publicationTime ?? ""}`.localeCompare(`${b.publicationDate}${b.publicationTime ?? ""}`)), [contents.data, sort]);
  const rows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const setQuery = (value: string) => { setSearch(value); setPage(0); setSearchParams(value ? { q: value } : {}); };
  const selected = new Set(selectedIds);
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectPage = () => setSelectedIds(rows.every((item) => selected.has(item.id)) ? selectedIds.filter((id) => !rows.some((item) => item.id === id)) : [...new Set([...selectedIds, ...rows.map((item) => item.id)])]);
  const selectedContents = () => selectedIds.map((id) => contents.data?.find((item) => item.id === id)).filter((item): item is Content => Boolean(item));
  const applyStatus = async (nextStatus: Content["status"]) => { await Promise.all(selectedIds.map((id) => { const content = contents.data?.find((item) => item.id === id); return content ? contentRepository.moveContent(id, content.publicationDate, nextStatus) : Promise.resolve(); })); selectedContents().forEach((item) => logActivity("content.status_change", "content", item.id, item.title)); invalidate(); pushToast({ title: "وضعیت محتواهای انتخاب شده به روز شد." }); };
  const archive = async () => { const items = selectedContents(); await Promise.all(selectedIds.map((id) => contentRepository.archiveContent(id))); items.forEach((item) => logActivity("content.archive", "content", item.id, item.title)); invalidate(); pushToast({ title: "محتواهای انتخاب شده بایگانی شدند." }); };
  const duplicate = async () => { const items = selectedContents(); await Promise.all(selectedIds.map((id) => contentRepository.duplicateContent(id))); items.forEach((item) => logActivity("content.duplicate", "content", item.id, item.title)); invalidate(); pushToast({ title: "کپی پیش نویس محتواها ساخته شد." }); };
  const exportData = async () => { const raw = await contentRepository.exportWorkspace(); download("rooznegar-export.json", raw, "application/json"); pushToast({ title: "فایل خروجی آماده شد." }); };
  if (workspace.isLoading || contents.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton table-skeleton" /></div>;
  if (!workspace.data) return <div className="page"><EmptyState title="فهرست در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;
  return <div className="page content-list-page"><PageHeader title="فهرست محتوا" description="برای جستجو، مرتب سازی و مدیریت گروهی محتوا از این نما استفاده کنید." actions={<Button onClick={() => openContentDialog()}><Plus size={18} />محتوای جدید</Button>} />
    <section className="filter-bar surface"><label className="search-field wide"><Search size={18} /><Input value={search} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در عنوان، کپشن و یادداشت" /></label><label className="filter-control"><Filter size={16} /><Select value={status} onChange={(event) => { setStatus(event.target.value as Content["status"] | ""); setPage(0); }}><option value="">همه وضعیت ها</option>{Object.entries(STATUS_META).map(([key, label]) => <option key={key} value={key}>{label.label}</option>)}</Select></label><label className="filter-control"><Select value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(0); }}><option value="">همه پلتفرم ها</option>{workspace.data.platforms.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label><label className="filter-control"><SlidersHorizontal size={16} /><Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="date">تاریخ انتشار</option><option value="updated">آخرین تغییر</option><option value="title">عنوان</option></Select></label><Button size="sm" variant="secondary" onClick={() => void exportData()}><Download size={16} />خروجی</Button></section>
    {selectedIds.length > 0 && <section className="bulk-bar" aria-live="polite"><strong>{selectedIds.length.toLocaleString("fa-IR")} مورد انتخاب شده</strong><Select aria-label="تغییر وضعیت گروهی" defaultValue="" onChange={(event) => { if (event.target.value) void applyStatus(event.target.value as Content["status"]); event.currentTarget.value = ""; }}><option value="">تغییر وضعیت</option>{Object.entries(STATUS_META).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}</Select><Button size="sm" variant="secondary" onClick={() => void duplicate()}><ClipboardCopy size={16} />تکثیر</Button><Button size="sm" variant="secondary" onClick={() => void archive()}><Archive size={16} />بایگانی</Button><Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>لغو انتخاب</Button></section>}
    <section className="data-table-wrap surface">{rows.length ? <table className="data-table"><thead><tr><th><input type="checkbox" aria-label="انتخاب همه موارد صفحه" checked={rows.length > 0 && rows.every((item) => selected.has(item.id))} onChange={selectPage} /></th><th>عنوان</th><th>تاریخ و زمان</th><th>پلتفرم</th><th>نوع</th><th>وضعیت</th><th>اولویت</th><th>آخرین تغییر</th></tr></thead><tbody>{rows.map((item) => <ContentRow key={item.id} content={item} checked={selected.has(item.id)} onToggle={() => toggle(item.id)} onOpen={() => setSelectedContent(item)} workspace={workspace.data} />)}</tbody></table> : <EmptyState title="محتوایی پیدا نشد" description="فیلترها را تغییر دهید یا اولین محتوای خود را بسازید." action={<Button size="sm" onClick={() => openContentDialog()}><Plus size={16} />افزودن محتوا</Button>} />}</section>
    {rows.length > 0 && <footer className="pagination"><span>{sorted.length.toLocaleString("fa-IR")} محتوا</span><div><IconButton label="صفحه قبل" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronRight size={18} /></IconButton><span>صفحه {(page + 1).toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}</span><IconButton label="صفحه بعد" disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)}><ChevronLeft size={18} /></IconButton></div></footer>}
    <ContentDetailDrawer content={selectedContent} workspace={workspace.data} onClose={() => setSelectedContent(null)} />
  </div>;
}

function ContentRow({ content, checked, onToggle, onOpen, workspace }: { content: Content; checked: boolean; onToggle: () => void; onOpen: () => void; workspace: NonNullable<ReturnType<typeof useWorkspace>["data"]> }) { const platform = workspace.platforms.find((item) => item.id === content.platformId); const type = workspace.types.find((item) => item.id === content.typeId); const status = STATUS_META[content.status]; return <tr className="data-row" onClick={onOpen}><td onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`انتخاب ${content.title}`} checked={checked} onChange={onToggle} /></td><td><strong>{content.title}</strong>{content.campaignId && <small>{workspace.campaigns.find((item) => item.id === content.campaignId)?.title}</small>}</td><td>{formatJalaliDate(content.publicationDate)}<small dir="ltr">{content.publicationTime ?? ""}</small></td><td>{platform?.name ?? "-"}</td><td>{type?.name ?? "-"}</td><td><StatusBadge status={content.status} label={status.label} color={status.color} /></td><td>{({ low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری" })[content.priority]}</td><td>{content.updatedByName ? <LastEditedTag updatedByName={content.updatedByName} updatedByRole={content.updatedByRole} updatedAt={content.updatedAt} /> : new Intl.DateTimeFormat("fa-IR", { dateStyle: "short" }).format(new Date(content.updatedAt))}</td></tr>; }

function download(fileName: string, value: string, mimeType: string) { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([value], { type: `${mimeType};charset=utf-8` })); anchor.download = fileName; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(anchor.href); }
