import type { AppSettings, ContentStatus, ContentStatusKey, ContentType, ContentPillar, Platform } from "../types/domain.js";

const base = (id: string, sortOrder: number) => ({
  id,
  sortOrder,
  version: 1,
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
  archivedAt: null,
});

export const STATUS_META: Record<ContentStatusKey, { label: string; color: string }> = {
  draft: { label: "پیش نویس", color: "#64748b" },
  in_progress: { label: "در حال انجام", color: "#2563eb" },
  review: { label: "در انتظار بررسی", color: "#b45309" },
  revision: { label: "نیازمند اصلاح", color: "#dc2626" },
  approved: { label: "تایید شده", color: "#0f766e" },
  scheduled: { label: "زمان بندی شده", color: "#7c3aed" },
  published: { label: "منتشر شده", color: "#15803d" },
  archived: { label: "بایگانی", color: "#475569" },
  cancelled: { label: "لغو شده", color: "#991b1b" },
};

export const DEFAULT_STATUSES: ContentStatus[] = (Object.entries(STATUS_META) as [ContentStatusKey, { label: string; color: string }][]).map(
  ([key, value], index) => ({
    ...base(`status-${key}`, index),
    key,
    name: value.label,
    color: value.color,
    isTerminal: key === "published" || key === "archived" || key === "cancelled",
    wipLimit: null,
  }),
);

const typeData = [
  ["تولید محتوا", "PenLine"],
  ["پست", "Image"], ["استوری", "PanelsTopLeft"], ["ریلز", "Clapperboard"], ["ویدئو", "Video"],
  ["مقاله", "FileText"], ["خبر", "Newspaper"], ["گزارش", "ChartNoAxesColumn"], ["پادکست", "Mic2"],
  ["ایمیل", "Mail"], ["پیامک", "MessageSquare"], ["پوش نوتیفیکیشن", "BellRing"], ["بنر", "RectangleHorizontal"],
  ["کمپین", "Megaphone"], ["محتوای تلگرام", "Send"], ["محتوای شبکه اجتماعی", "Share2"], ["محتوای وب سایت", "Globe2"],
  ["محتوای مناسبتی", "CalendarHeart"], ["سایر", "Shapes"],
] as const;
const zambilColors = ["#FF334C", "#F31F39", "#DF1129", "#B2071B", "#FF6E80", "#FFC0C8"];
const typeColors = zambilColors;
export const DEFAULT_TYPES: ContentType[] = typeData.map(([name, icon], index) => ({
  ...base(`type-${index + 1}`, index), name, icon, color: typeColors[index % typeColors.length],
}));

const platformData = [
  ["کانال ایتا زمبیل", "MessageCircle", "#FF334C", null], ["کانال ایتا زمبیلدار", "MessageCircle", "#F31F39", null],
  ["کانال بله زمبیل", "MessagesSquare", "#DF1129", null], ["کانال بله زمبیل دار", "MessagesSquare", "#B2071B", null],
  ["کانال روبیکا زمبیل", "PlaySquare", "#FF4D63", null], ["پیج اینستاگرام زمبیل", "Instagram", "#FF334C", 2200],
  ["برودکاست اینستاگرام زمبیل", "Megaphone", "#F31F39", null], ["چنل تلگرام", "Send", "#229ed9", null],
  ["پیامک به زمبیلدارا", "MessageSquare", "#DF1129", 70], ["پیامک به مخاطبا", "MessageSquare", "#B2071B", 70],
  ["ربات زمبیل در ایتا", "Bot", "#FF6E80", null], ["دینگ", "BellRing", "#FF4D63", 120],
  ["اینستاگرام", "Instagram", "#c13584", 2200], ["تلگرام", "Send", "#229ed9", null], ["ایتا", "MessageCircle", "#f59e0b", null],
  ["بله", "MessagesSquare", "#0f766e", null], ["روبیکا", "PlaySquare", "#dc2626", null], ["واتساپ", "MessageCircle", "#16a34a", null],
  ["لینکدین", "Linkedin", "#0a66c2", 3000], ["ایکس", "AtSign", "#111827", 280], ["یوتیوب", "Youtube", "#dc2626", 5000],
  ["آپارات", "Play", "#ed145b", null], ["وب سایت", "Globe2", "#0f766e", null], ["وبلاگ", "BookOpen", "#854d0e", null],
  ["ایمیل", "Mail", "#2563eb", null], ["پیامک", "MessageSquare", "#7c3aed", 70], ["پوش نوتیفیکیشن", "BellRing", "#b45309", 120],
  ["رسانه چاپی", "Newspaper", "#475569", null], ["سایر", "MoreHorizontal", "#64748b", null],
] as const;
export const DEFAULT_PLATFORMS: Platform[] = platformData.map(([name, icon, color, characterLimit], index) => ({
  ...base(`platform-${index + 1}`, index), name, icon, color, characterLimit, preferredTypes: [], defaultPublishingTime: null, notes: null,
}));

const pillarData = ["آموزشی", "خبری", "سرگرمی", "تعاملی", "تبلیغاتی", "اعتمادسازی", "فروش", "برندینگ", "مناسبتی"];
export const DEFAULT_PILLARS: ContentPillar[] = pillarData.map((name, index) => ({
  ...base(`pillar-${index + 1}`, index), name, color: typeColors[index % typeColors.length], description: null,
}));

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  numeralSystem: "persian",
  defaultCalendarView: "month",
  firstDayOfWeek: "saturday",
  fontSize: "normal",
  notificationsEnabled: false,
  notificationLeadMinutes: 30,
  quietHoursStart: null,
  quietHoursEnd: null,
};

export const PRIORITY_META = {
  low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری",
} as const;
