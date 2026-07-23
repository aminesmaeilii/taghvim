import { Archive, CalendarDays, CheckSquare, ClipboardCopy, ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { STATUS_META } from "@shared/constants/defaults";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import type { Content, WorkspaceData } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";
import { Button, Drawer, StatusBadge } from "../../components/ui";
import { LastEditedTag } from "../../components/last-edited-tag";
import { useActivityLogger } from "../../hooks/use-profile";
import { ForwardButton } from "../chat/forward-button";

export function ContentDetailDrawer({ content, workspace, onClose }: { content: Content | null; workspace: WorkspaceData; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { openContentDialog, pushToast } = useUIStore();
  const logActivity = useActivityLogger();
  if (!content) return null;
  const platform = workspace.platforms.find((item) => item.id === content.platformId);
  const type = workspace.types.find((item) => item.id === content.typeId);
  const campaign = workspace.campaigns.find((item) => item.id === content.campaignId);
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ["contents"] }); void queryClient.invalidateQueries({ queryKey: ["workspace"] }); };
  const duplicate = async () => { await contentRepository.duplicateContent(content.id); invalidate(); logActivity("content.duplicate", "content", content.id, content.title); pushToast({ title: "یک نسخه پیش نویس از محتوا ساخته شد." }); };
  const archive = async () => { await contentRepository.archiveContent(content.id); invalidate(); logActivity("content.archive", "content", content.id, content.title); onClose(); pushToast({ title: "محتوا بایگانی شد." }); };
  const remove = async () => { if (window.confirm("این محتوا برای همیشه حذف شود؟")) { await contentRepository.deleteContent(content.id); invalidate(); logActivity("content.delete", "content", content.id, content.title); onClose(); pushToast({ title: "محتوا حذف شد." }); } };
  const status = STATUS_META[content.status];
  return <Drawer open={Boolean(content)} title="جزئیات محتوا" onClose={onClose} placement="center">
    <div className="detail-drawer-content">
      <div className="detail-title"><StatusBadge status={content.status} label={status.label} color={status.color} /><h3>{content.title}</h3>{content.shortDescription && <p>{content.shortDescription}</p>}<LastEditedTag updatedByName={content.updatedByName} updatedByRole={content.updatedByRole} updatedAt={content.updatedAt} /></div>
      <div className="detail-meta"><span><CalendarDays size={16} />{formatJalaliDate(content.publicationDate)}{content.publicationTime && `، ${content.publicationTime}`}</span><span>{platform?.name ?? "پلتفرم حذف شده"}</span><span>{type?.name ?? "نوع حذف شده"}</span>{campaign && <span>{campaign.title}</span>}</div>
      <div className="detail-actions"><Button size="sm" onClick={() => { onClose(); openContentDialog({ contentId: content.id }); }}><Pencil size={16} />ویرایش</Button><Button size="sm" variant="secondary" onClick={() => void duplicate()}><ClipboardCopy size={16} />تکثیر</Button><ForwardButton entity={{ type: "content", id: content.id, title: content.title, label: content.contentKind === "advertisement" ? "تبلیغ" : "محتوا", description: content.shortDescription ?? content.caption ?? content.brief }} /></div>
      {content.brief && <DetailBlock title="خلاصه تولید" icon={<FileText size={17} />}>{content.brief}</DetailBlock>}
      {content.caption && <DetailBlock title="کپشن" icon={<FileText size={17} />}>{content.caption}</DetailBlock>}
      {content.mainCopy && <DetailBlock title="متن اصلی" icon={<FileText size={17} />}>{content.mainCopy}</DetailBlock>}
      {content.checklist.length > 0 && <DetailBlock title="چک لیست" icon={<CheckSquare size={17} />}><ul className="checklist">{content.checklist.map((item) => <li key={item.id} className={item.completed ? "done" : ""}>{item.title}</li>)}</ul></DetailBlock>}
      {content.notes && <DetailBlock title="یادداشت داخلی" icon={<FileText size={17} />}>{content.notes}</DetailBlock>}
      {content.link && <a className="external-link" href={content.link} target="_blank" rel="noreferrer"><ExternalLink size={16} />باز کردن لینک</a>}
      <div className="danger-zone"><Button size="sm" variant="secondary" onClick={() => void archive()}><Archive size={16} />بایگانی</Button><Button size="sm" variant="danger" onClick={() => void remove()}><Trash2 size={16} />حذف</Button></div>
    </div>
  </Drawer>;
}

function DetailBlock({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="detail-block"><h4>{icon}{title}</h4><div>{children}</div></section>;
}
