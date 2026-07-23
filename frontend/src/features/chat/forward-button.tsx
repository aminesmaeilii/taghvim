import { Forward, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "../../components/ui";
import { useAuth } from "../../hooks/use-auth-context";
import { useWorkspace } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import type { ChatContextType, ChatConversationSummary, UserProfile } from "@shared/types/domain";

export type ForwardableEntity = {
  type: ChatContextType;
  id: string;
  title: string;
  label: string;
  description?: string | null;
};

export function ForwardButton({ entity, compact = true }: { entity: ForwardableEntity; compact?: boolean }) {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const { pushToast } = useUIStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<ChatConversationSummary[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const profiles = useMemo(() => (workspace.data?.userProfiles ?? []).filter((profile) => profile.userId !== user?.id), [user?.id, workspace.data?.userProfiles]);
  const filteredProfiles = profiles.filter((profile) => profile.displayName.toLocaleLowerCase("fa").includes(query.toLocaleLowerCase("fa"))).slice(0, 8);

  useEffect(() => {
    if (!open || !user) return;
    void contentRepository.listChatConversations(user.id).then((items) => setRecent(items.slice(0, 3)));
  }, [open, user]);
  useEffect(() => {
    const handler = (event: MouseEvent) => { if (open && popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const messageBody = `فوروارد ${entity.label}: ${entity.title}${entity.description ? `\n${entity.description}` : ""}`;
  const sendToConversation = async (conversationId: string) => {
    if (!user) return;
    setSending(conversationId);
    try {
      await contentRepository.sendChatMessage(user.id, conversationId, messageBody, crypto.randomUUID(), { type: entity.type, id: entity.id, metadata: { title: entity.title, label: entity.label } });
      pushToast({ title: "برای گفتگو ارسال شد." });
      setOpen(false);
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "ارسال ممکن نشد." });
    } finally {
      setSending(null);
    }
  };
  const sendToProfile = async (profile: UserProfile) => {
    if (!user) return;
    setSending(profile.userId);
    try {
      const conversation = await contentRepository.createDirectChat(user.id, profile.userId);
      await sendToConversation(conversation.conversation.id);
    } finally {
      setSending(null);
    }
  };

  if (!user) return null;
  return <span className="forward-menu" ref={popoverRef}>
    <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}><Forward size={15} />{compact ? "ارسال" : "فوروارد"}</Button>
    {open && <div className="forward-popover" onClick={(event) => event.stopPropagation()}>
      <label className="forward-search"><Search size={15} /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی اعضای تیم" /></label>
      {recent.length > 0 && <div className="forward-section"><strong>آخرین گفتگوها</strong>{recent.map((item) => <button type="button" key={item.conversation.id} disabled={Boolean(sending)} onClick={() => void sendToConversation(item.conversation.id)}><Avatar title={conversationTitle(item, user.id, workspace.data?.userProfiles ?? [])} /><span>{conversationTitle(item, user.id, workspace.data?.userProfiles ?? [])}</span></button>)}</div>}
      <div className="forward-section"><strong>اعضای تیم</strong>{filteredProfiles.length ? filteredProfiles.map((profile) => <button type="button" key={profile.userId} disabled={Boolean(sending)} onClick={() => void sendToProfile(profile)}><Avatar title={profile.displayName} image={profile.avatarUrl} /><span>{profile.displayName}</span></button>) : <small>عضوی پیدا نشد.</small>}</div>
    </div>}
  </span>;
}

function Avatar({ title, image }: { title: string; image?: string | null }) {
  return <span className="forward-avatar">{image ? <img src={image} alt="" /> : title.trim().slice(0, 1) || "؟"}</span>;
}

function conversationTitle(summary: ChatConversationSummary, userId: string, profiles: UserProfile[]): string {
  if (summary.conversation.type === "GROUP") return summary.conversation.title ?? "گروه";
  const peer = summary.members.find((member) => member.userId !== userId);
  return profiles.find((profile) => profile.userId === peer?.userId)?.displayName ?? "گفتگوی مستقیم";
}
