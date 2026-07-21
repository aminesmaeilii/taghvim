import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Filter, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState, Input, Select, StatusBadge } from "../../components/ui";
import { STATUS_META } from "@shared/constants/defaults";
import { useContents, useWorkspace } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import type { Content, ContentStatusKey } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";
import { ContentDetailDrawer } from "../content/content-detail-drawer";

const boardStatuses: ContentStatusKey[] = ["draft", "in_progress", "review", "revision", "approved", "scheduled", "published"];

export function WorkflowPage() {
  const workspace = useWorkspace();
  const contents = useContents();
  const { openContentDialog, pushToast } = useUIStore();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [selected, setSelected] = useState<Content | null>(null);
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  if (workspace.isLoading || contents.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton board-skeleton" /></div>;
  if (!workspace.data || !contents.data) return <div className="page"><EmptyState title="برد در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;
  const filtered = contents.data.filter((item) => (!search || item.title.toLocaleLowerCase("fa").includes(search.toLocaleLowerCase("fa"))) && (!platform || item.platformId === platform));
  const move = async ({ active, over }: DragEndEvent) => { if (!over || typeof active.id !== "string" || typeof over.id !== "string" || !over.id.startsWith("status:")) return; const content = filtered.find((item) => item.id === active.id); const next = over.id.slice(7) as ContentStatusKey; if (!content || content.status === next) return; const previous = content.status; try { await contentRepository.moveContent(content.id, content.publicationDate, next); await queryClient.invalidateQueries({ queryKey: ["contents"] }); pushToast({ title: `وضعیت «${content.title}» به روز شد.`, action: { label: "بازگردانی", onClick: () => { void contentRepository.moveContent(content.id, content.publicationDate, previous).then(() => queryClient.invalidateQueries({ queryKey: ["contents"] })); } } }); } catch { pushToast({ title: "تغییر وضعیت ممکن نشد." }); } };
  return <div className="page workflow-page"><PageHeader title="گردش کار" description="محتوا را بین مرحله های تولید و انتشار جابه جا کنید." actions={<Button onClick={() => openContentDialog({ quick: true })}><Plus size={18} />محتوای جدید</Button>} />
    <section className="filter-bar surface"><label className="search-field wide"><Search size={17} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو در برد" /></label><label className="filter-control"><Filter size={16} /><Select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="">همه پلتفرم ها</option>{workspace.data.platforms.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label></section>
    <DndContext sensors={sensors} onDragEnd={(event) => void move(event)}><section className="kanban-board" aria-label="برد گردش کار">{boardStatuses.map((status) => <WorkflowColumn key={status} status={status} contents={filtered.filter((item) => item.status === status)} onSelect={setSelected} />)}</section></DndContext>
    <ContentDetailDrawer content={selected} workspace={workspace.data} onClose={() => setSelected(null)} />
  </div>;
}

function WorkflowColumn({ status, contents, onSelect }: { status: ContentStatusKey; contents: Content[]; onSelect: (content: Content) => void }) { const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` }); const meta = STATUS_META[status]; return <section ref={setNodeRef} className={`kanban-column ${isOver ? "drag-over" : ""}`}><header><StatusBadge status={status} label={meta.label} color={meta.color} /><span>{contents.length.toLocaleString("fa-IR")}</span></header><div className="kanban-cards">{contents.map((content) => <WorkflowCard key={content.id} content={content} onSelect={onSelect} />)}{contents.length === 0 && <div className="kanban-empty">محتوایی ندارد</div>}</div></section>; }

function WorkflowCard({ content, onSelect }: { content: Content; onSelect: (content: Content) => void }) { const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: content.id }); return <button ref={setNodeRef} type="button" className="kanban-card" onClick={() => onSelect(content)} style={{ opacity: isDragging ? 0.45 : 1, transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }} {...listeners} {...attributes}><strong>{content.title}</strong><span>{formatJalaliDate(content.publicationDate)}{content.publicationTime && ` · ${content.publicationTime}`}</span><small>{({ low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری" })[content.priority]}</small></button>; }
