import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState } from "../../components/ui";
import { useAuth } from "../../hooks/use-auth-context";
import { useActivityLogger } from "../../hooks/use-profile";
import { useWorkspace, workspaceKey } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { uploadFile } from "../../services/blob-storage";
import { useUIStore } from "../../stores/ui-store";
import type { LearningMaterial, WorkspaceData } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";

export function EducationPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const logActivity = useActivityLogger();
  const { pushToast } = useUIStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const canManage = hasPermission("settings.update");
  if (workspace.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!workspace.data) return <div className="page"><EmptyState title="بخش آموزش در دسترس نیست" description="فضای کاری را دوباره باز کنید." /></div>;
  const materials = [...workspace.data.learningMaterials].sort((a, b) => a.sortOrder - b.sortOrder);

  const patchMaterials = (updater: (list: LearningMaterial[]) => LearningMaterial[]) => {
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, learningMaterials: updater(current.learningMaterials) } : current);
  };

  const upload = async (file?: File) => {
    if (!file || !user) return;
    if (file.type !== "application/pdf") { pushToast({ title: "فقط فایل PDF قابل آپلود است." }); return; }
    setUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);
    try {
      const blobUrl = await uploadFile(file, `learning/${crypto.randomUUID()}-${file.name}`, setUploadProgress);
      const material: LearningMaterial = { id: crypto.randomUUID(), title: file.name.replace(/\.pdf$/i, ""), blobUrl, uploadedByName: `${user.firstName} ${user.lastName}`.trim(), uploadedAt: new Date().toISOString(), sortOrder: materials.length };
      const saved = await contentRepository.saveLearningMaterial(material);
      patchMaterials((list) => [...list, saved]);
      logActivity("learning_material.upload", "learning_material", saved.id, saved.title);
      pushToast({ title: "فایل آموزشی اضافه شد." });
    } catch (error) { pushToast({ title: error instanceof Error ? `آپلود فایل ممکن نشد: ${error.message}` : "آپلود فایل ممکن نشد." }); }
    finally { setUploading(false); setUploadProgress(0); setUploadFileName(""); }
  };

  const remove = async (material: LearningMaterial) => {
    if (!window.confirm(`«${material.title}» حذف شود؟`)) return;
    await contentRepository.deleteLearningMaterial(material.id);
    patchMaterials((list) => list.filter((item) => item.id !== material.id));
    logActivity("learning_material.delete", "learning_material", material.id, material.title);
    pushToast({ title: "فایل آموزشی حذف شد." });
  };

  return <div className="page education-page">
    <PageHeader title="آموزش" description="فایل های آموزشی تیم را بخوانید، هایلایت کنید و یادداشت بگذارید." actions={canManage ? <><input ref={fileInput} type="file" accept="application/pdf" hidden onChange={(event) => void upload(event.target.files?.[0])} /><Button onClick={() => fileInput.current?.click()} disabled={uploading}><Plus size={18} />{uploading ? "در حال آپلود" : "افزودن فایل PDF"}</Button></> : undefined} />
    {uploading && <section className="surface upload-progress-panel"><div className="upload-progress-info"><span>{uploadFileName}</span><strong>{Math.round(uploadProgress).toLocaleString("fa-IR")}٪</strong></div><div className="progress-track"><span style={{ width: `${uploadProgress}%` }} /></div></section>}
    {materials.length ? <section className="surface education-list">{materials.map((material) => <div className="education-row" key={material.id}>
      <button type="button" className="education-row-main" onClick={() => navigate(`/education/${material.id}`)}><FileText size={20} /><div><strong>{material.title}</strong><small>افزوده شده توسط {material.uploadedByName} در {formatJalaliDate(material.uploadedAt)}</small></div></button>
      {canManage && <button type="button" className="education-row-delete" aria-label={`حذف ${material.title}`} onClick={() => void remove(material)}><Trash2 size={16} /></button>}
    </div>)}</section> : <EmptyState title="هنوز فایل آموزشی اضافه نشده" description="فایل های PDF آموزشی تیم را اینجا اضافه کنید تا همه بتوانند مطالعه کنند." action={canManage ? <Button size="sm" onClick={() => fileInput.current?.click()}><Upload size={16} />افزودن فایل</Button> : undefined} />}
  </div>;
}
