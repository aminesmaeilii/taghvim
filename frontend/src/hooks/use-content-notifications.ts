import { useEffect } from "react";
import type { Content } from "@shared/types/domain";
import { todayIso, toPersianDigits } from "@shared/utils/jalali";
import { getNotificationPermission, hasNotified, markNotified, showBrowserNotification } from "../services/notification-service";
import { useUIStore } from "../stores/ui-store";
import { useSettings, useWorkspace } from "./use-workspace";

const CHECK_INTERVAL_MS = 60_000;
const TERMINAL_STATUSES = new Set<Content["status"]>(["published", "cancelled", "archived"]);

function publishTimestamp(content: Content): number | null {
  if (!content.publicationTime) return null;
  const timestamp = new Date(`${content.publicationDate}T${content.publicationTime}:00`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function useContentNotifications() {
  const workspace = useWorkspace();
  const settingsQuery = useSettings();
  const pushToast = useUIStore((state) => state.pushToast);

  useEffect(() => {
    const settings = settingsQuery.data;
    const contents = workspace.data?.contents;
    if (!settings?.notificationsEnabled || !contents) return;

    const leadMs = settings.notificationLeadMinutes * 60_000;

    const notify = async (key: string, title: string, body: string) => {
      markNotified(key);
      const delivered = getNotificationPermission() === "granted" && await showBrowserNotification(title, { body, tag: key });
      if (!delivered) pushToast({ title });
    };

    const check = () => {
      const now = Date.now();
      const today = todayIso();
      for (const content of contents) {
        if (content.archivedAt || TERMINAL_STATUSES.has(content.status)) continue;

        const publishAt = publishTimestamp(content);
        if (publishAt !== null && now < publishAt && publishAt - leadMs <= now) {
          const key = `publish:${content.id}:${publishAt}`;
          if (!hasNotified(key)) {
            const minutesLeft = Math.max(1, Math.round((publishAt - now) / 60_000));
            void notify(key, `زمان انتشار «${content.title}» نزدیک است`, `تا ${toPersianDigits(minutesLeft)} دقیقه دیگر باید منتشر شود.`);
          }
        }

        if (content.reviewDate && content.reviewDate <= today) {
          const key = `review:${content.id}:${today}`;
          if (!hasNotified(key)) {
            const overdue = content.reviewDate < today;
            void notify(key, overdue ? `بررسی «${content.title}» عقب افتاده است` : `بررسی «${content.title}» امروز باید انجام شود`, overdue ? "این محتوا هنوز بررسی نشده است." : "زمان بررسی این محتوا امروز است.");
          }
        }

        if (content.deadline && content.deadline <= today) {
          const key = `deadline:${content.id}:${today}`;
          if (!hasNotified(key)) {
            const overdue = content.deadline < today;
            void notify(key, overdue ? `مهلت «${content.title}» گذشته است` : `امروز مهلت «${content.title}» است`, overdue ? "هرچه سریع تر پیگیری کنید." : "کار روی این محتوا را امروز تمام کنید.");
          }
        }
      }
    };

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [settingsQuery.data, workspace.data, pushToast]);
}
