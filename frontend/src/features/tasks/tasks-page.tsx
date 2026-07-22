import { AlertCircle, CalendarClock, CheckSquare, Plus, Square, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, Dialog, EmptyState, Field, Select, Textarea } from "../../components/ui";
import { JalaliDateInput } from "../../components/jalali-date-input";
import { contentRepository } from "../../services/content-repository";
import { useWorkspace, workspaceKey } from "../../hooks/use-workspace";
import { useUIStore } from "../../stores/ui-store";
import { useAuth } from "../../hooks/use-auth-context";
import { useActivityLogger } from "../../hooks/use-profile";
import type { Priority, TaskItem, UserProfile, WorkspaceData } from "@shared/types/domain";
import { formatJalaliDate, todayIso } from "@shared/utils/jalali";

const PRIORITY_LABEL: Record<Priority, string> = { low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری" };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return (parts[0][0] ?? "") + (parts[1]?.[0] ?? "");
}

export function TasksPage() {
  const workspace = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useUIStore();
  const logActivity = useActivityLogger();
  const [dialogFor, setDialogFor] = useState<{ profile: UserProfile; task: TaskItem | null } | null>(null);

  if (workspace.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!workspace.data || !user) return <div className="page"><EmptyState title="وظایف در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;

  const profiles = [...workspace.data.userProfiles].sort((a, b) => a.displayName.localeCompare(b.displayName, "fa"));
  const tasks = workspace.data.tasks;

  const patchTasks = (updater: (list: TaskItem[]) => TaskItem[]) => {
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, tasks: updater(current.tasks) } : current);
  };

  const canManage = (task: TaskItem) => task.assigneeUserId === user.id || task.createdByUserId === user.id;

  const save = async (task: TaskItem) => {
    try {
      const isNew = !tasks.some((item) => item.id === task.id);
      const saved = await contentRepository.saveTask(task);
      patchTasks((list) => [...list.filter((item) => item.id !== saved.id), saved]);
      logActivity(isNew ? "task.create" : "task.update", "task", saved.id, saved.title);
      setDialogFor(null);
      pushToast({ title: "وظیفه ذخیره شد." });
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "ذخیره وظیفه ممکن نشد." });
    }
  };

  const toggleDone = async (task: TaskItem) => {
    if (!canManage(task)) return;
    await save({ ...task, status: task.status === "done" ? "todo" : "done" });
  };

  const remove = async (task: TaskItem) => {
    if (!canManage(task)) return;
    if (!window.confirm(`«${task.title}» حذف شود؟`)) return;
    try {
      await contentRepository.deleteTask(task.id);
      patchTasks((list) => list.filter((item) => item.id !== task.id));
      pushToast({ title: "وظیفه حذف شد." });
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "حذف وظیفه ممکن نشد." });
    }
  };

  return <div className="page tasks-page">
    <PageHeader title="تودو لیست تیم" description="هر عضو تیم یک ستون اختصاصی دارد؛ وظیفه با تاریخ سررسید می‌تواند بعداً به تقویم محتوا متصل شود." />
    {profiles.length === 0
      ? <EmptyState title="هنوز عضوی در تیم ثبت نشده" description="از بخش تنظیمات، کاربران تیم را اضافه کنید تا ستون وظایف آن‌ها این‌جا نمایش داده شود." />
      : <section className="tasks-board">
        {profiles.map((profile) => {
          const columnTasks = tasks.filter((item) => item.assigneeUserId === profile.userId && !item.archivedAt).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
          const isMe = profile.userId === user.id;
          return <div className="tasks-column" key={profile.userId}>
            <header>
              <span className="tasks-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initialsOf(profile.displayName)}</span>
              <div><strong>{profile.displayName}{isMe && " (شما)"}</strong><small>{columnTasks.length.toLocaleString("fa-IR")} وظیفه</small></div>
              <button type="button" className="tasks-add-button" aria-label={`افزودن وظیفه برای ${profile.displayName}`} onClick={() => setDialogFor({ profile, task: null })}><Plus size={15} /></button>
            </header>
            <div className="tasks-cards">
              {columnTasks.map((task) => {
                const overdue = Boolean(task.dueDate && task.dueDate < todayIso() && task.status !== "done");
                const editable = canManage(task);
                return <article className={`task-card priority-${task.priority}${task.status === "done" ? " done" : ""}`} key={task.id}>
                  <button type="button" className="task-check" disabled={!editable} onClick={() => void toggleDone(task)} aria-label={task.status === "done" ? "علامت‌گذاری به عنوان انجام‌نشده" : "علامت‌گذاری به عنوان انجام‌شده"}>{task.status === "done" ? <CheckSquare size={18} /> : <Square size={18} />}</button>
                  <button type="button" className="task-body" disabled={!editable} onClick={() => editable && setDialogFor({ profile, task })}>
                    <strong>{task.title}</strong>
                    {task.notes && <p>{task.notes}</p>}
                    <div className="task-meta">
                      {task.dueDate && <span className={overdue ? "task-overdue" : ""}><CalendarClock size={12} />{formatJalaliDate(task.dueDate)}</span>}
                      <span className="task-priority-tag">{PRIORITY_LABEL[task.priority]}</span>
                    </div>
                  </button>
                  {editable && <button type="button" className="task-delete" aria-label="حذف وظیفه" onClick={() => void remove(task)}><Trash2 size={13} /></button>}
                </article>;
              })}
              {columnTasks.length === 0 && <div className="tasks-empty"><User size={16} /><span>وظیفه‌ای ثبت نشده</span></div>}
            </div>
          </div>;
        })}
      </section>}
    {dialogFor && <TaskDialog
      profile={dialogFor.profile}
      task={dialogFor.task}
      currentUserId={user.id}
      currentUserName={`${user.firstName} ${user.lastName}`.trim()}
      onClose={() => setDialogFor(null)}
      onSave={save}
    />}
  </div>;
}

function TaskDialog({ profile, task, currentUserId, currentUserName, onClose, onSave }: { profile: UserProfile; task: TaskItem | null; currentUserId: string; currentUserName: string; onClose: () => void; onSave: (task: TaskItem) => Promise<void> }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "normal");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const persist = async () => {
    if (title.trim().length < 2) return;
    const now = new Date().toISOString();
    await onSave({
      id: task?.id ?? crypto.randomUUID(),
      title: title.trim(),
      notes: notes.trim() || null,
      assigneeUserId: profile.userId,
      status: task?.status ?? "todo",
      priority,
      dueDate: dueDate || null,
      createdByUserId: task?.createdByUserId ?? currentUserId,
      createdByName: task?.createdByName ?? currentUserName,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
      archivedAt: task?.archivedAt ?? null,
      sortOrder: task?.sortOrder ?? 0,
      version: task?.version ?? 1,
    });
  };
  return <Dialog open title={task ? "ویرایش وظیفه" : `وظیفه جدید برای ${profile.displayName}`} onClose={onClose}>
    <div className="form-grid">
      <Field label="عنوان وظیفه"><input className="input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="اولویت"><Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="low">کم</option><option value="normal">عادی</option><option value="high">زیاد</option><option value="urgent">فوری</option></Select></Field>
      <Field label="تاریخ سررسید (برای اتصال به تقویم)" optional><JalaliDateInput value={dueDate} onChange={setDueDate} /></Field>
      <Field label="یادداشت" optional><Textarea rows={3} value={notes ?? ""} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>
    <div className="editor-note"><AlertCircle size={16} /><div><strong>محرمانگی</strong><p>فقط شما یا فردی که این وظیفه را ساخته می‌توانید آن را ویرایش یا حذف کنید؛ بقیه اعضا فقط عنوان و وضعیت را می‌بینند.</p></div></div>
    <footer className="dialog-footer"><Button variant="secondary" onClick={onClose}>انصراف</Button><Button onClick={() => void persist()}>ذخیره وظیفه</Button></footer>
  </Dialog>;
}
