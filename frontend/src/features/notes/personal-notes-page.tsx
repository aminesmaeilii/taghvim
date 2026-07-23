import { Archive, ArchiveRestore, Bold, Edit3, Italic, Link2, List, Pin, PinOff, Plus, Search, Trash2, Underline, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, Dialog, EmptyState, Field, Input } from "../../components/ui";
import { useAuth } from "../../hooks/use-auth-context";
import { useWorkspace, workspaceKey } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import { ForwardButton } from "../chat/forward-button";
import type { PersonalNote, WorkspaceData } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";

const NOTE_COLORS = ["#FFD5DA", "#bfdbfe", "#bbf7d0", "#fef08a", "#e9d5ff"];
const DEFAULT_FOLDER = "عمومی";

function splitTags(raw: string): string[] { return raw.split(/[,،]/).map((item) => item.trim()).filter(Boolean); }
function isArchived(note: PersonalNote): boolean { return Boolean(note.archivedAt); }

export function PersonalNotesPage() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const { pushToast } = useUIStore();
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("همه");
  const [editing, setEditing] = useState<PersonalNote | null>(null);
  const [previewing, setPreviewing] = useState<PersonalNote | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const notes = useMemo(() => (workspace.data?.personalNotes ?? []).filter((item) => item.userId === user?.id), [workspace.data, user?.id]);
  const folders = useMemo(() => ["همه", ...new Set(notes.map((item) => item.folder))], [notes]);
  const filtered = notes
    .filter((item) => showArchived ? isArchived(item) : !isArchived(item))
    .filter((item) => folder === "همه" || item.folder === folder)
    .filter((item) => !search || `${item.title} ${item.body} ${item.tags.join(" ")}`.toLocaleLowerCase("fa").includes(search.toLocaleLowerCase("fa")))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || b.updatedAt.localeCompare(a.updatedAt));

  if (workspace.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!workspace.data || !user) return <div className="page"><EmptyState title="یادداشت ها در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;

  const patchNotes = (updater: (list: PersonalNote[]) => PersonalNote[]) => {
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, personalNotes: updater(current.personalNotes) } : current);
  };

  const save = async (note: PersonalNote) => {
    const saved = await contentRepository.savePersonalNote(note);
    patchNotes((list) => [...list.filter((item) => item.id !== saved.id), saved]);
    setCreating(false); setEditing(null); setPreviewing(saved);
    pushToast({ title: "یادداشت ذخیره شد." });
  };

  const remove = async (note: PersonalNote) => {
    if (!window.confirm(`«${note.title || "این یادداشت"}» حذف شود؟`)) return;
    await contentRepository.deletePersonalNote(note.id);
    patchNotes((list) => list.filter((item) => item.id !== note.id).map((item) => ({ ...item, linkedNoteIds: item.linkedNoteIds?.filter((id) => id !== note.id) })));
    setEditing(null); setPreviewing(null);
    pushToast({ title: "یادداشت حذف شد." });
  };

  const togglePin = async (note: PersonalNote) => { await save({ ...note, pinned: !note.pinned }); };
  const toggleArchive = async (note: PersonalNote) => {
    await save({ ...note, archivedAt: note.archivedAt ? null : new Date().toISOString(), pinned: note.archivedAt ? note.pinned : false });
    pushToast({ title: note.archivedAt ? "یادداشت از بایگانی برگشت." : "یادداشت بایگانی شد." });
  };
  const connectNotes = async (target: PersonalNote) => {
    const source = notes.find((item) => item.id === linkSourceId);
    setLinkSourceId(null);
    if (!source || source.id === target.id) return;
    const nextSource = { ...source, linkedNoteIds: [...new Set([...(source.linkedNoteIds ?? []), target.id])] };
    const nextTarget = { ...target, linkedNoteIds: [...new Set([...(target.linkedNoteIds ?? []), source.id])] };
    await Promise.all([contentRepository.savePersonalNote(nextSource), contentRepository.savePersonalNote(nextTarget)]);
    patchNotes((list) => list.map((item) => item.id === source.id ? nextSource : item.id === target.id ? nextTarget : item));
    pushToast({ title: "یادداشت ها به هم متصل شدند." });
  };
  const reorder = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const visibleIds = filtered.map((item) => item.id);
    const from = visibleIds.indexOf(draggingId);
    const to = visibleIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const ordered = [...filtered];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const updated = ordered.map((item, index) => ({ ...item, sortOrder: index, updatedAt: new Date().toISOString() }));
    patchNotes((list) => list.map((item) => updated.find((next) => next.id === item.id) ?? item));
    await Promise.all(updated.map((item) => contentRepository.savePersonalNote(item)));
    pushToast({ title: "ترتیب یادداشت ها ذخیره شد." });
  };

  return <div className="page personal-notes-page">
    <PageHeader title="یادداشت های شخصی" description="این یادداشت ها فقط برای شما قابل مشاهده است." actions={<Button onClick={() => setCreating(true)}><Plus size={18} />یادداشت جدید</Button>} />
    <section className="notes-toolbar surface">
      <label className="search-field wide"><Search size={17} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو در یادداشت ها" /></label>
      <div className="notes-folder-tabs">{folders.map((item) => <button key={item} type="button" className={folder === item ? "active" : ""} onClick={() => setFolder(item)}>{item}</button>)}</div>
      <Button size="sm" variant="secondary" onClick={() => setShowArchived((value) => !value)}>{showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}{showArchived ? "یادداشت های فعال" : "بایگانی"}</Button>
      {linkSourceId && <Button size="sm" variant="secondary" onClick={() => setLinkSourceId(null)}><X size={15} />لغو اتصال</Button>}
    </section>
    {filtered.length ? <section className="notes-board">
      <svg className="note-links" aria-hidden="true">{filtered.flatMap((note, index) => (note.linkedNoteIds ?? []).filter((id) => filtered.some((item) => item.id === id)).map((id) => {
        const targetIndex = filtered.findIndex((item) => item.id === id);
        if (targetIndex <= index) return null;
        const x1 = `${((index % 3) + 0.5) * 33.333}%`; const x2 = `${((targetIndex % 3) + 0.5) * 33.333}%`;
        const y1 = `${Math.floor(index / 3) * 190 + 80}px`; const y2 = `${Math.floor(targetIndex / 3) * 190 + 80}px`;
        return <line key={`${note.id}-${id}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
      }))}</svg>
      <div className="notes-grid">{filtered.map((note) => <article className={`note-card ${draggingId === note.id ? "dragging" : ""} ${linkSourceId === note.id ? "link-source" : ""}`} key={note.id} style={{ borderInlineStartColor: note.color }} draggable onDragStart={() => setDraggingId(note.id)} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => void reorder(note.id)} onClick={() => linkSourceId ? void connectNotes(note) : setPreviewing(note)}>
        <header><strong>{note.title || "بدون عنوان"}</strong><span className="note-card-actions"><button type="button" onClick={(event) => { event.stopPropagation(); setLinkSourceId(note.id); }} aria-label="اتصال به یادداشت دیگر"><Link2 size={15} /></button><button type="button" onClick={(event) => { event.stopPropagation(); void togglePin(note); }} aria-label={note.pinned ? "برداشتن پین" : "پین کردن"}>{note.pinned ? <Pin size={15} /> : <PinOff size={15} />}</button></span></header>
        <div className="note-card-body" dangerouslySetInnerHTML={{ __html: note.body || "<p></p>" }} />
        {note.tags.length > 0 && <div className="note-tags">{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        <footer><span>{note.folder}</span><span>{formatJalaliDate(note.updatedAt)}</span></footer>
      </article>)}</div>
    </section> : <EmptyState title="یادداشتی پیدا نشد" description="اولین یادداشت شخصی خود را بسازید." action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} />یادداشت جدید</Button>} />}
    <NotePreviewDialog note={previewing} notes={notes} onClose={() => setPreviewing(null)} onEdit={() => { setEditing(previewing); setPreviewing(null); }} onArchive={previewing ? () => void toggleArchive(previewing) : undefined} />
    <NoteDialog open={creating || Boolean(editing)} note={editing} userId={user.id} folders={folders.filter((item) => item !== "همه")} onClose={() => { setCreating(false); setEditing(null); }} onSave={save} onDelete={editing ? () => void remove(editing) : undefined} />
  </div>;
}

function NotePreviewDialog({ note, notes, onClose, onEdit, onArchive }: { note: PersonalNote | null; notes: PersonalNote[]; onClose: () => void; onEdit: () => void; onArchive?: () => void }) {
  const linked = note ? notes.filter((item) => note.linkedNoteIds?.includes(item.id)) : [];
  return <Dialog open={Boolean(note)} title={note?.title || "پیشنمایش یادداشت"} onClose={onClose} wide>
    {note && <div className="note-preview">
      <div className="note-preview-body" dangerouslySetInnerHTML={{ __html: note.body || "<p></p>" }} />
      {note.tags.length > 0 && <div className="note-tags">{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {linked.length > 0 && <div className="note-linked-list"><strong>یادداشت های متصل</strong>{linked.map((item) => <span key={item.id}>{item.title}</span>)}</div>}
    </div>}
    <footer className="dialog-footer"><Button variant="secondary" onClick={onClose}>بستن</Button>{note && <ForwardButton entity={{ type: "note", id: note.id, title: note.title, label: "یادداشت", description: stripHtml(note.body).slice(0, 180) }} />}{onArchive && <Button variant="secondary" onClick={onArchive}>{note?.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />}{note?.archivedAt ? "برگرداندن" : "بایگانی"}</Button>}<Button onClick={onEdit}><Edit3 size={15} />ویرایش</Button></footer>
  </Dialog>;
}

function NoteDialog({ open, note, userId, folders, onClose, onSave, onDelete }: { open: boolean; note: PersonalNote | null; userId: string; folders: string[]; onClose: () => void; onSave: (note: PersonalNote) => Promise<void>; onDelete?: () => void }) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState(DEFAULT_FOLDER);
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [tags, setTags] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? ""); setFolder(note?.folder ?? DEFAULT_FOLDER); setColor(note?.color ?? NOTE_COLORS[0]); setTags(note?.tags.join("، ") ?? "");
    if (editorRef.current) editorRef.current.innerHTML = note?.body ?? "";
  }, [note, open]);
  const format = (command: string) => { document.execCommand(command); editorRef.current?.focus(); };
  const persist = async () => {
    const now = new Date().toISOString();
    const body = sanitizeNoteHtml(editorRef.current?.innerHTML ?? "");
    await onSave({ id: note?.id ?? crypto.randomUUID(), userId, title: title.trim() || "بدون عنوان", body, folder: folder.trim() || DEFAULT_FOLDER, color, pinned: note?.pinned ?? false, tags: splitTags(tags), archivedAt: note?.archivedAt ?? null, sortOrder: note?.sortOrder ?? 0, linkedNoteIds: note?.linkedNoteIds ?? [], createdAt: note?.createdAt ?? now, updatedAt: now });
  };
  return <Dialog open={open} title={note ? "ویرایش یادداشت" : "یادداشت جدید"} onClose={onClose} wide>
    <div className="form-grid">
      <Field label="عنوان"><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="دسته بندی"><Input value={folder} onChange={(event) => setFolder(event.target.value)} placeholder={DEFAULT_FOLDER} list="note-folders" /><datalist id="note-folders">{folders.map((item) => <option key={item} value={item} />)}</datalist></Field>
      <Field label="برچسب ها" optional><Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="با کاما جدا کنید" /></Field>
      <Field label="رنگ"><div className="note-color-picker">{NOTE_COLORS.map((item) => <button key={item} type="button" className={color === item ? "active" : ""} style={{ backgroundColor: item }} onClick={() => setColor(item)} aria-label="انتخاب رنگ" />)}</div></Field>
      <div className="note-editor">
        <div className="note-editor-toolbar"><button type="button" onClick={() => format("bold")} aria-label="ضخیم"><Bold size={15} /></button><button type="button" onClick={() => format("italic")} aria-label="مورب"><Italic size={15} /></button><button type="button" onClick={() => format("underline")} aria-label="زیرخط"><Underline size={15} /></button><button type="button" onClick={() => format("insertUnorderedList")} aria-label="لیست"><List size={15} /></button></div>
        <div ref={editorRef} className="note-editor-body" contentEditable suppressContentEditableWarning />
      </div>
    </div>
    <footer className="dialog-footer">{onDelete && <Button variant="danger" onClick={onDelete}><Trash2 size={15} />حذف</Button>}<Button variant="secondary" onClick={onClose}>انصراف</Button><Button onClick={() => void persist()}>ذخیره یادداشت</Button></footer>
  </Dialog>;
}

function sanitizeNoteHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll<HTMLElement>("*").forEach((element) => {
    element.style.removeProperty("background");
    element.style.removeProperty("background-color");
    element.style.removeProperty("color");
    if (!element.getAttribute("style")) element.removeAttribute("style");
  });
  return template.innerHTML;
}

function stripHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.textContent ?? "";
}
