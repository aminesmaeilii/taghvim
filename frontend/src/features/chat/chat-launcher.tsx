import { ArrowRight, CheckCheck, MessageCircle, Minus, Plus, Search, Send, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button, EmptyState, IconButton, Input, Textarea } from "../../components/ui";
import { useAuth } from "../../hooks/use-auth-context";
import { useWorkspace } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import type { SafeUser } from "@shared/types/auth";
import type { ChatConversationSummary, ChatMessage, UserProfile } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";

type PanelView = "list" | "conversation" | "new";
type PendingMessage = ChatMessage & { status?: "pending" | "failed" };

const POLL_INTERVAL_MS = 3500;
const HOVER_CLOSE_DELAY_MS = 420;

export default function ChatLauncher() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(sessionStorage.getItem("zambil.chat.pinned") === "true");
  const [pinned, setPinned] = useState(sessionStorage.getItem("zambil.chat.pinned") === "true");
  const [view, setView] = useState<PanelView>("list");
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<"online" | "offline" | "syncing">("syncing");
  const closeTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((item) => item.conversation.id === activeId) ?? null;
  const unreadTotal = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const teamProfiles = useMemo(() => (workspace.data?.userProfiles ?? []).filter((profile) => profile.userId !== user?.id), [user?.id, workspace.data?.userProfiles]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      setConnectionState("syncing");
      setConversations(await contentRepository.listChatConversations(user.id));
      setConnectionState("online");
    } catch {
      setConnectionState("offline");
    }
  }, [user]);

  const openConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    setActiveId(conversationId);
    setView("conversation");
    setLoading(true);
    try {
      const page = await contentRepository.listChatMessages(user.id, conversationId, null, 40);
      setMessages(page.messages);
      setNextCursor(page.nextCursor ?? null);
      await contentRepository.markChatRead(user.id, conversationId);
      await loadConversations();
    } finally {
      setLoading(false);
    }
  }, [loadConversations, user]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!user) return undefined;
    const handle = window.setInterval(() => {
      void loadConversations();
      if (activeId && open) void contentRepository.listChatMessages(user.id, activeId, null, 40).then((page) => setMessages((current) => mergeMessages(current, page.messages)));
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [activeId, loadConversations, open, user]);
  useEffect(() => {
    const handler = (event: MouseEvent) => { if (open && !pinned && panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false); };
    const keyHandler = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setPinned(false); setOpen(false); sessionStorage.removeItem("zambil.chat.pinned"); } };
    window.addEventListener("mousedown", handler);
    window.addEventListener("keydown", keyHandler);
    return () => { window.removeEventListener("mousedown", handler); window.removeEventListener("keydown", keyHandler); };
  }, [open, pinned]);

  const scheduleClose = () => {
    if (pinned) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };
  const openByHover = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (!window.matchMedia("(hover: none)").matches) setOpen(true);
  };
  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    setOpen(true);
    sessionStorage.setItem("zambil.chat.pinned", String(next));
  };

  if (!user) return null;
  return <div className="chat-dock" ref={panelRef} onMouseEnter={openByHover} onMouseLeave={scheduleClose}>
    <button type="button" className="chat-launcher" aria-label="باز کردن گفتگوها" aria-expanded={open} onClick={togglePinned}>
      <MessageCircle size={22} />
      {unreadTotal > 0 && <span className="chat-launcher-badge">{unreadTotal > 99 ? "99+" : unreadTotal.toLocaleString("fa-IR")}</span>}
    </button>
    <section className={`chat-panel ${open ? "open" : ""}`} aria-label="گفتگوهای تیمی" aria-hidden={!open}>
      <header className="chat-header">
        {view === "conversation" ? <IconButton label="بازگشت" onClick={() => { setView("list"); setActiveId(null); }}><ArrowRight size={17} /></IconButton> : <span className="chat-presence-dot" data-state={connectionState} />}
        <div><h2>{view === "conversation" ? conversationTitle(active, user.id, workspace.data?.userProfiles ?? []) : "گفتگوها"}</h2><small>{connectionState === "offline" ? "آفلاین" : connectionState === "syncing" ? "در حال همگام سازی" : "آنلاین"}</small></div>
        <span className="chat-header-actions"><IconButton label="پیام جدید" onClick={() => setView("new")}><Plus size={17} /></IconButton><IconButton label="کوچک کردن" onClick={() => setOpen(false)}><Minus size={17} /></IconButton><IconButton label="بستن" onClick={() => { setPinned(false); setOpen(false); sessionStorage.removeItem("zambil.chat.pinned"); }}><X size={17} /></IconButton></span>
      </header>
      {view === "new" && <NewConversationPanel user={user} profiles={teamProfiles} onCreated={(summary) => { setConversations((current) => mergeConversations(current, [summary])); void openConversation(summary.conversation.id); }} />}
      {view === "list" && <ConversationList conversations={conversations} userId={user.id} profiles={workspace.data?.userProfiles ?? []} onOpen={(id) => void openConversation(id)} />}
      {view === "conversation" && active && <ConversationPanel user={user} active={active} profiles={workspace.data?.userProfiles ?? []} messages={messages} loading={loading} nextCursor={nextCursor} onLoadOlder={async () => {
        if (!nextCursor) return;
        const page = await contentRepository.listChatMessages(user.id, active.conversation.id, nextCursor, 40);
        setMessages((current) => mergeMessages(page.messages, current));
        setNextCursor(page.nextCursor ?? null);
      }} onSend={async (body) => {
        const clientMessageId = crypto.randomUUID();
        const optimistic: PendingMessage = { id: `pending-${clientMessageId}`, conversationId: active.conversation.id, senderId: user.id, messageType: "TEXT", body, clientMessageId, createdAt: new Date().toISOString(), status: "pending" };
        setMessages((current) => [...current, optimistic]);
        try {
          const sent = await contentRepository.sendChatMessage(user.id, active.conversation.id, body, clientMessageId);
          setMessages((current) => current.map((message) => message.clientMessageId === clientMessageId ? sent : message));
          await loadConversations();
        } catch {
          setMessages((current) => current.map((message) => message.clientMessageId === clientMessageId ? { ...message, status: "failed" } : message));
        }
      }} />}
    </section>
  </div>;
}

function ConversationList({ conversations, userId, profiles, onOpen }: { conversations: ChatConversationSummary[]; userId: string; profiles: UserProfile[]; onOpen: (id: string) => void }) {
  if (!conversations.length) return <div className="chat-empty"><EmptyState title="پیامی وجود ندارد" description="برای شروع، یک گفتگوی مستقیم یا گروه بسازید." /></div>;
  return <div className="chat-conversation-list">{conversations.map((item) => <button key={item.conversation.id} type="button" className="chat-conversation-item" onClick={() => onOpen(item.conversation.id)}>
    <Avatar title={conversationTitle(item, userId, profiles)} />
    <span><strong>{conversationTitle(item, userId, profiles)}</strong><small>{item.lastMessage?.body ?? "شروع گفتگو"}</small></span>
    <time>{formatChatTime(item.conversation.lastMessageAt ?? item.conversation.updatedAt)}</time>
    {item.unreadCount > 0 && <b>{item.unreadCount > 99 ? "99+" : item.unreadCount.toLocaleString("fa-IR")}</b>}
  </button>)}</div>;
}

function NewConversationPanel({ user, profiles, onCreated }: { user: SafeUser; profiles: UserProfile[]; onCreated: (summary: ChatConversationSummary) => void }) {
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = profiles.filter((profile) => profile.displayName.toLocaleLowerCase("fa").includes(query.toLocaleLowerCase("fa")));
  const create = async () => {
    const summary = groupMode ? await contentRepository.createGroupChat(user.id, title, selected) : selected[0] ? await contentRepository.createDirectChat(user.id, selected[0]) : null;
    if (summary) onCreated(summary);
  };
  return <div className="chat-new-panel">
    <div className="chat-mode-toggle"><button type="button" className={!groupMode ? "active" : ""} onClick={() => setGroupMode(false)}>پیام جدید</button><button type="button" className={groupMode ? "active" : ""} onClick={() => setGroupMode(true)}><Users size={14} />ساخت گروه</button></div>
    {groupMode && <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="نام گروه" />}
    <label className="chat-search"><Search size={16} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست وجوی اعضای تیم" /></label>
    <div className="chat-member-list">{filtered.map((profile) => <label key={profile.userId}><input type={groupMode ? "checkbox" : "radio"} checked={selected.includes(profile.userId)} onChange={() => setSelected((current) => groupMode ? current.includes(profile.userId) ? current.filter((id) => id !== profile.userId) : [...current, profile.userId] : [profile.userId])} /><Avatar title={profile.displayName} /><span>{profile.displayName}</span></label>)}</div>
    <footer><Button onClick={() => void create()} disabled={groupMode ? selected.length === 0 || title.trim().length < 2 : selected.length !== 1}>شروع گفتگو</Button></footer>
  </div>;
}

function ConversationPanel({ user, active, profiles, messages, loading, nextCursor, onLoadOlder, onSend }: { user: SafeUser; active: ChatConversationSummary; profiles: UserProfile[]; messages: PendingMessage[]; loading: boolean; nextCursor: string | null; onLoadOlder: () => Promise<void>; onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  const submit = async () => {
    const value = body.trim();
    if (!value) return;
    setBody("");
    await onSend(value);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); }
  };
  return <div className="chat-thread">
    <div className="chat-member-strip">{active.members.map((member) => <span key={member.userId}>{profileName(member.userId, profiles)}</span>)}</div>
    <div className="chat-messages">{nextCursor && <Button size="sm" variant="secondary" onClick={() => void onLoadOlder()}>پیام های قدیمی تر</Button>}{loading ? <div className="chat-loading">در حال دریافت پیام ها...</div> : messages.map((message) => <div key={message.id} className={`chat-message ${message.senderId === user.id ? "own" : ""} ${message.status === "failed" ? "failed" : ""}`}>
      <small>{profileName(message.senderId, profiles)}</small>{message.contextType && <span className="chat-context-chip">{message.contextMetadata?.label ?? contextLabel(message.contextType)}: {message.contextMetadata?.title ?? message.contextId}</span>}<p dir="auto">{message.body}</p><time>{formatChatTime(message.createdAt)} {message.senderId === user.id && <CheckCheck size={13} />}</time>{message.status === "failed" && <button type="button" onClick={() => void onSend(message.body)}>تلاش مجدد</button>}
    </div>)}<div ref={bottomRef} /></div>
    <footer className="chat-composer"><Textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={keyDown} placeholder="ارسال پیام" rows={2} maxLength={4000} /><IconButton label="ارسال پیام" onClick={() => void submit()} disabled={!body.trim()}><Send size={18} /></IconButton></footer>
  </div>;
}

function Avatar({ title }: { title: string }) { return <span className="chat-avatar">{title.trim().slice(0, 1) || "؟"}</span>; }
function profileName(userId: string, profiles: UserProfile[]): string { return profiles.find((profile) => profile.userId === userId)?.displayName ?? "کاربر حذف شده"; }
function conversationTitle(summary: ChatConversationSummary | null, userId: string, profiles: UserProfile[]): string {
  if (!summary) return "گفتگوها";
  if (summary.conversation.type === "GROUP") return summary.conversation.title ?? "گروه بدون نام";
  const peer = summary.members.find((member) => member.userId !== userId);
  return peer ? profileName(peer.userId, profiles) : "گفتگوی مستقیم";
}
function formatChatTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatJalaliDate(value);
  return date.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
function mergeConversations(current: ChatConversationSummary[], incoming: ChatConversationSummary[]): ChatConversationSummary[] {
  const map = new Map(current.map((item) => [item.conversation.id, item]));
  incoming.forEach((item) => map.set(item.conversation.id, item));
  return [...map.values()].sort((a, b) => (b.conversation.lastMessageAt ?? b.conversation.updatedAt).localeCompare(a.conversation.lastMessageAt ?? a.conversation.updatedAt));
}
function mergeMessages(current: PendingMessage[], incoming: ChatMessage[]): PendingMessage[] {
  const map = new Map(current.map((message) => [message.clientMessageId || message.id, message]));
  incoming.forEach((message) => map.set(message.clientMessageId || message.id, message));
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function contextLabel(type: ChatMessage["contextType"]): string {
  return ({ content: "محتوا", task: "وظیفه", campaign: "کمپین", calendar_event: "رویداد", idea: "ایده", template: "قالب", note: "یادداشت", learning_material: "آموزش", ad_budget: "بودجه" } as const)[type ?? "content"];
}
