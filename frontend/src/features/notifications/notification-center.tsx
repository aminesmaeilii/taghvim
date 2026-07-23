import { Bell, BellRing, CheckCheck, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, IconButton } from "../../components/ui";
import { useAuth } from "../../hooks/use-auth-context";
import { contentRepository } from "../../services/content-repository";
import { getNotificationPermission, isPushSupported, subscribeCurrentDevice } from "../../services/notification-service";
import { useUIStore } from "../../stores/ui-store";
import type { AppNotification, PushSubscriptionRecord } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";

export function NotificationCenter() {
  const { user } = useAuth();
  const { pushToast } = useUIStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [devices, setDevices] = useState<PushSubscriptionRecord[]>([]);
  const [permission, setPermission] = useState(getNotificationPermission());
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [notifications, subscriptions] = await Promise.all([contentRepository.listNotifications(user.id, null, 30), contentRepository.listPushSubscriptions(user.id)]);
    setItems(notifications.notifications);
    setUnreadCount(notifications.unreadCount);
    setDevices(subscriptions);
  }, [user]);

  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 8000); return () => window.clearInterval(id); }, [load]);
  useEffect(() => {
    const handler = (event: MouseEvent) => { if (open && ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const keyHandler = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", handler);
    window.addEventListener("keydown", keyHandler);
    return () => { window.removeEventListener("mousedown", handler); window.removeEventListener("keydown", keyHandler); };
  }, [open]);

  const enablePush = async () => {
    if (!user) return;
    try {
      const subscription = await subscribeCurrentDevice();
      setPermission(getNotificationPermission());
      if (!subscription) return;
      const json = subscription.toJSON();
      await contentRepository.savePushSubscription({
        id: crypto.randomUUID(),
        userId: user.id,
        endpoint: json.endpoint ?? subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        deviceName: navigator.platform || "دستگاه فعلی",
        browserInfo: navigator.userAgent.slice(0, 180),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUsedAt: null,
        revokedAt: null,
        failureCount: 0,
      });
      await load();
      pushToast({ title: "اعلان های این دستگاه فعال شد." });
    } catch (error) {
      pushToast({ title: error instanceof Error ? error.message : "فعال سازی اعلان ممکن نشد." });
    }
  };

  const markAll = async () => {
    if (!user || unreadCount === 0) return;
    await contentRepository.markAllNotificationsRead(user.id);
    await load();
  };

  return <div className="notification-center" ref={ref}>
    <IconButton label="مرکز اعلان ها" onClick={() => setOpen((value) => !value)}><Bell size={18} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount.toLocaleString("fa-IR")}</span>}</IconButton>
    {open && <section className="notification-popover" role="dialog" aria-modal="false" aria-label="مرکز اعلان ها">
      <header><div><h2>اعلان ها</h2><p>{permission === "denied" ? "دسترسی اعلان این دستگاه در مرورگر یا سیستم عامل مسدود شده است. برای فعال سازی، تنظیمات مرورگر را بررسی کنید." : isPushSupported() ? "برای این که موعد کارها و برنامه های تقویم را از دست ندهید، می توانید اعلان های این دستگاه را فعال کنید." : "این مرورگر از اعلان Push پشتیبانی نمی کند؛ اعلان های داخل برنامه همچنان نمایش داده می شوند."}</p></div><BellRing size={19} /></header>
      <div className="notification-actions"><Button size="sm" variant="secondary" onClick={() => void markAll()} disabled={unreadCount === 0}><CheckCheck size={15} />خواندن همه</Button><Button size="sm" onClick={() => void enablePush()} disabled={!isPushSupported() || permission === "denied" || permission === "granted"}><Smartphone size={15} />فعال کردن اعلان ها</Button></div>
      {devices.length > 0 && <div className="notification-devices">{devices.slice(0, 3).map((device) => <span key={device.id}>{device.deviceName}</span>)}</div>}
      <div className="notification-list">{items.length ? items.map((item) => <button type="button" className={!item.readAt ? "unread" : ""} key={item.id} onClick={() => { if (user) void contentRepository.markNotificationRead(user.id, item.id).then(load); if (item.actionUrl) location.hash = item.actionUrl.replace(/^#/, ""); }}>
        <strong>{item.title}</strong><span>{item.body ?? "اعلان جدید"}</span><time>{formatJalaliDate(item.createdAt)}</time>
      </button>) : <EmptyState title="اعلانی وجود ندارد" description="یادآورها، پیام های گفت وگو و تغییرات مهم اینجا دیده می شوند." />}</div>
    </section>}
  </div>;
}
