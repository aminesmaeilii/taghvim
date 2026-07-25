import type { AppSettings, ContentStatus, ContentStatusKey, ContentType, ContentPillar, MarketingRole, MonitoringPlatform, MonitoringPlatformCapability, MonitoringSource, Platform } from "../types/domain.js";

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

export const MARKETING_ROLE_LABELS: Record<MarketingRole, string> = {
  digital_marketing_manager: "مدیر دیجیتال مارکتینگ",
  seo_specialist: "کارشناس سئو",
  ppc_specialist: "کارشناس تبلیغات کلیکی",
  social_media_manager: "مدیر شبکه های اجتماعی",
  content_marketing_specialist: "کارشناس تولید محتوا",
  email_marketing_specialist: "کارشناس ایمیل مارکتینگ",
  marketing_automation_specialist: "کارشناس مارکتینگ اتوماسیون",
  marketing_analyst: "تحلیل گر داده و عملکرد مارکتینگ",
  brand_manager: "مدیر برند",
  growth_marketer: "کارشناس گروث مارکتینگ",
  influencer_marketing_specialist: "کارشناس اینفلوئنسر مارکتینگ",
  affiliate_marketing_specialist: "کارشناس افیلیت مارکتینگ",
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
  notificationPreferences: {
    pushEnabled: false,
    defaultReminderMinutes: [30],
    quietHoursStart: null,
    quietHoursEnd: null,
    privacyMode: "full",
    chatNotifications: true,
    taskNotifications: true,
    overdueNotifications: true,
    criticalBypassesQuietHours: false,
  },
};

export const PRIORITY_META = {
  low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری",
} as const;

const monitoringBase = (id: string, sortOrder: number) => base(id, sortOrder);

export const MONITORING_CAPABILITY_LABELS = {
  PROFILE_INFORMATION: "اطلاعات پروفایل",
  PROFILE_AVATAR: "تصویر پروفایل",
  PROFILE_DESCRIPTION: "توضیحات پروفایل",
  VERIFICATION_STATUS: "وضعیت تایید",
  FOLLOWER_COUNT: "دنبال کننده",
  MEMBER_COUNT: "عضو",
  SUBSCRIBER_COUNT: "مشترک",
  TOTAL_POST_COUNT: "کل محتوا",
  RECENT_CONTENT: "محتوای اخیر",
  CONTENT_TEXT_PREVIEW: "پیش نمایش متن",
  CONTENT_MEDIA_TYPE: "نوع رسانه",
  CONTENT_VIEWS: "بازدید",
  CONTENT_REACTIONS: "واکنش",
  CONTENT_COMMENTS: "نظر",
  CONTENT_SHARES: "اشتراک گذاری",
  CONTENT_FORWARDS: "فوروارد",
  CONTENT_LIKES: "لایک",
  CONTENT_ENGAGEMENT: "تعامل",
  PUBLISHING_FREQUENCY: "تناوب انتشار",
  LATEST_CONTENT_DATE: "آخرین انتشار",
} as const;

export const DEFAULT_MONITORING_PLATFORMS: MonitoringPlatform[] = [
  { ...monitoringBase("monitoring-platform-instagram", 0), key: "INSTAGRAM", displayNameFa: "اینستاگرام", displayNameEn: "Instagram", icon: "Instagram", accentColor: "#c13584", connectorKey: "instagram-public-beta", connectorVersion: "0.1.0", enabled: true, supportedSourceTypes: ["PROFILE"], allowedDomains: ["instagram.com", "www.instagram.com"], defaultCollectionIntervalMinutes: 1440, minimumCollectionIntervalMinutes: 1440, status: "BETA", healthStatus: "LIMITED", lastVerifiedAt: null },
  { ...monitoringBase("monitoring-platform-eitaa", 1), key: "EITAA", displayNameFa: "ایتا", displayNameEn: "Eitaa", icon: "MessageCircle", accentColor: "#f59e0b", connectorKey: "eitaa-public-beta", connectorVersion: "0.1.0", enabled: true, supportedSourceTypes: ["CHANNEL"], allowedDomains: ["eitaa.com"], defaultCollectionIntervalMinutes: 1440, minimumCollectionIntervalMinutes: 1440, status: "BETA", healthStatus: "LIMITED", lastVerifiedAt: null },
  { ...monitoringBase("monitoring-platform-bale", 2), key: "BALE", displayNameFa: "بله", displayNameEn: "Bale", icon: "MessagesSquare", accentColor: "#0f766e", connectorKey: "bale-bot-beta", connectorVersion: "0.1.0", enabled: true, supportedSourceTypes: ["CHANNEL"], allowedDomains: ["web.bale.ai", "bale.ai"], defaultCollectionIntervalMinutes: 1440, minimumCollectionIntervalMinutes: 1440, status: "BETA", healthStatus: "LIMITED", lastVerifiedAt: null },
  { ...monitoringBase("monitoring-platform-telegram", 3), key: "TELEGRAM", displayNameFa: "تلگرام", displayNameEn: "Telegram", icon: "Send", accentColor: "#229ed9", connectorKey: "telegram-bot-beta", connectorVersion: "0.1.0", enabled: true, supportedSourceTypes: ["CHANNEL"], allowedDomains: ["t.me", "telegram.me"], defaultCollectionIntervalMinutes: 1440, minimumCollectionIntervalMinutes: 1440, status: "BETA", healthStatus: "LIMITED", lastVerifiedAt: null },
  { ...monitoringBase("monitoring-platform-rubika", 4), key: "RUBIKA", displayNameFa: "روبیکا", displayNameEn: "Rubika", icon: "PlaySquare", accentColor: "#dc2626", connectorKey: "rubika-public-beta", connectorVersion: "0.1.0", enabled: true, supportedSourceTypes: ["CHANNEL"], allowedDomains: ["rubika.ir"], defaultCollectionIntervalMinutes: 1440, minimumCollectionIntervalMinutes: 1440, status: "BETA", healthStatus: "LIMITED", lastVerifiedAt: null },
];

const restrictedCapabilities = ["PROFILE_INFORMATION", "RECENT_CONTENT", "LATEST_CONTENT_DATE", "PUBLISHING_FREQUENCY"] as const;
export const DEFAULT_MONITORING_PLATFORM_CAPABILITIES: MonitoringPlatformCapability[] = DEFAULT_MONITORING_PLATFORMS.flatMap((platform) =>
  (Object.keys(MONITORING_CAPABILITY_LABELS) as Array<keyof typeof MONITORING_CAPABILITY_LABELS>).map((capabilityKey) => ({
    platformKey: platform.key,
    capabilityKey,
    supported: restrictedCapabilities.includes(capabilityKey as never),
    supportLevel: restrictedCapabilities.includes(capabilityKey as never) ? "RESTRICTED" : "UNAVAILABLE",
    lastVerifiedAt: null,
    limitationReason: restrictedCapabilities.includes(capabilityKey as never) ? "در نسخه بتا فقط داده عمومی قابل اتکا و محدود بررسی می شود." : "این داده از منبع فعلی قابل دریافت نیست.",
  })),
);

export const DEFAULT_MONITORING_SOURCES: MonitoringSource[] = [
  { ...monitoringBase("monitoring-source-instagram-zambil", 0), platformKey: "INSTAGRAM", displayName: "اینستاگرام زمبیل", sourceType: "PROFILE", sourceUrl: "https://www.instagram.com/zambil.club", normalizedUrl: "https://www.instagram.com/zambil.club", handle: "zambil.club", externalId: null, avatarUrl: null, enabled: true, collectionEnabled: true, collectionIntervalMinutes: 1440, dailyCollectionTime: "06:00", freshnessThresholdHours: 30, timezone: "Asia/Tehran", createdBy: null, identityChangedAt: null, identityChangeNote: null },
  { ...monitoringBase("monitoring-source-eitaa-zambil", 1), platformKey: "EITAA", displayName: "کانال ایتا زمبیل", sourceType: "CHANNEL", sourceUrl: "https://eitaa.com/zambil", normalizedUrl: "https://eitaa.com/zambil", handle: "zambil", externalId: null, avatarUrl: null, enabled: true, collectionEnabled: true, collectionIntervalMinutes: 1440, dailyCollectionTime: "06:05", freshnessThresholdHours: 30, timezone: "Asia/Tehran", createdBy: null, identityChangedAt: null, identityChangeNote: null },
  { ...monitoringBase("monitoring-source-eitaa-zambil-seller", 2), platformKey: "EITAA", displayName: "کانال ایتا زمبیل دار", sourceType: "CHANNEL", sourceUrl: "https://eitaa.com/zambil_seller", normalizedUrl: "https://eitaa.com/zambil_seller", handle: "zambil_seller", externalId: null, avatarUrl: null, enabled: true, collectionEnabled: true, collectionIntervalMinutes: 1440, dailyCollectionTime: "06:10", freshnessThresholdHours: 30, timezone: "Asia/Tehran", createdBy: null, identityChangedAt: null, identityChangeNote: null },
  { ...monitoringBase("monitoring-source-bale-zambil", 3), platformKey: "BALE", displayName: "کانال بله زمبیل", sourceType: "CHANNEL", sourceUrl: "https://web.bale.ai/chat?uid=6391255974", normalizedUrl: "https://web.bale.ai/chat?uid=6391255974", handle: null, externalId: "6391255974", avatarUrl: null, enabled: true, collectionEnabled: true, collectionIntervalMinutes: 1440, dailyCollectionTime: "06:15", freshnessThresholdHours: 30, timezone: "Asia/Tehran", createdBy: null, identityChangedAt: null, identityChangeNote: null },
  { ...monitoringBase("monitoring-source-telegram-zambil", 4), platformKey: "TELEGRAM", displayName: "کانال تلگرام زمبیل", sourceType: "CHANNEL", sourceUrl: "https://t.me/zambil_shop", normalizedUrl: "https://t.me/zambil_shop", handle: "zambil_shop", externalId: null, avatarUrl: null, enabled: true, collectionEnabled: true, collectionIntervalMinutes: 1440, dailyCollectionTime: "06:20", freshnessThresholdHours: 30, timezone: "Asia/Tehran", createdBy: null, identityChangedAt: null, identityChangeNote: null },
  { ...monitoringBase("monitoring-source-rubika-zambil", 5), platformKey: "RUBIKA", displayName: "کانال روبیکا زمبیل", sourceType: "CHANNEL", sourceUrl: "https://rubika.ir/zambil_shop", normalizedUrl: "https://rubika.ir/zambil_shop", handle: "zambil_shop", externalId: null, avatarUrl: null, enabled: true, collectionEnabled: true, collectionIntervalMinutes: 1440, dailyCollectionTime: "06:25", freshnessThresholdHours: 30, timezone: "Asia/Tehran", createdBy: null, identityChangedAt: null, identityChangeNote: null },
];
