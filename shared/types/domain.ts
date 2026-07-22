export type Theme = "light" | "dark" | "system";

export type Priority = "low" | "normal" | "high" | "urgent";

export type ContentStatusKey =
  | "draft"
  | "in_progress"
  | "review"
  | "revision"
  | "approved"
  | "scheduled"
  | "published"
  | "archived"
  | "cancelled";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  sortOrder: number;
  version: number;
}

export interface Platform extends BaseEntity {
  name: string;
  color: string;
  icon: string;
  characterLimit?: number | null;
  preferredTypes: string[];
  defaultPublishingTime?: string | null;
  notes?: string | null;
}

export interface ContentType extends BaseEntity {
  name: string;
  color: string;
  icon: string;
}

export interface ContentStatus extends BaseEntity {
  name: string;
  key: ContentStatusKey;
  color: string;
  isTerminal: boolean;
  wipLimit?: number | null;
}

export interface Tag extends BaseEntity {
  name: string;
  color: string;
}

export interface ContentPillar extends BaseEntity {
  name: string;
  color: string;
  description?: string | null;
}

export interface Campaign extends BaseEntity {
  title: string;
  goal?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  platformIds: string[];
  targetAudience?: string | null;
  mainMessage?: string | null;
  kpi?: string | null;
  status: "draft" | "active" | "completed" | "archived";
  notes?: string | null;
  updatedByName?: string | null;
  updatedByRole?: string | null;
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  path: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface PerformanceMetrics {
  views?: number | null;
  reach?: number | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  leads?: number | null;
  conversions?: number | null;
  engagementRate?: number | null;
  notes?: string | null;
}

export interface Content extends BaseEntity {
  title: string;
  shortDescription?: string | null;
  brief?: string | null;
  typeId: string;
  platformId: string;
  campaignId?: string | null;
  pillarId?: string | null;
  tagIds: string[];
  owner?: string | null;
  reviewer?: string | null;
  publisher?: string | null;
  priority: Priority;
  status: ContentStatusKey;
  publicationDate: string;
  publicationTime?: string | null;
  timezone: string;
  startDate?: string | null;
  deadline?: string | null;
  productionDate?: string | null;
  reviewDate?: string | null;
  recurrence?: string | null;
  caption?: string | null;
  mainCopy?: string | null;
  hook?: string | null;
  callToAction?: string | null;
  hashtags?: string | null;
  keywords?: string | null;
  link?: string | null;
  sourceLink?: string | null;
  notes?: string | null;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  contentVersion: number;
  performance?: PerformanceMetrics | null;
  contentKind?: "content" | "advertisement";
  adBudgetAmount?: number | null;
  adPlatformNote?: string | null;
  updatedByName?: string | null;
  updatedByRole?: string | null;
}

export interface ContentIdea extends BaseEntity {
  title: string;
  description?: string | null;
  tagIds: string[];
  pillarId?: string | null;
  referenceLink?: string | null;
  priority: Priority;
  notes?: string | null;
  score?: IdeaScore | null;
  updatedByName?: string | null;
  updatedByRole?: string | null;
}

export interface IdeaScoreBreakdown {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  matched: string[];
  guidance: string;
}

export interface IdeaScore {
  total: number;
  label: "ضعیف" | "متوسط" | "خوب" | "عالی";
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  breakdown: IdeaScoreBreakdown[];
  scoredAt: string;
}

export interface IdeaScoringCriterionSetting {
  key: string;
  label: string;
  maxPoints: number;
  keywords: string[];
  guidance: string;
}

export interface IdeaScoringSettings {
  criteria: IdeaScoringCriterionSetting[];
  penaltyKeywords: string[];
}

export interface ContentTemplate extends BaseEntity {
  title: string;
  typeId?: string | null;
  platformId?: string | null;
  captionStructure?: string | null;
  checklist: ChecklistItem[];
  defaultStatus: ContentStatusKey;
  defaultOwner?: string | null;
  defaultTagIds: string[];
  defaultPublishingTime?: string | null;
  brief?: string | null;
  updatedByName?: string | null;
  updatedByRole?: string | null;
}

export interface ContentFilters {
  search?: string;
  status?: ContentStatusKey[];
  platformIds?: string[];
  typeIds?: string[];
  campaignIds?: string[];
  priorities?: Priority[];
  owner?: string;
  tagIds?: string[];
  pillarIds?: string[];
  fromDate?: string;
  toDate?: string;
  overdue?: boolean;
  archived?: boolean;
}

export const MARKETING_ROLES = [
  "digital_marketing_manager", "seo_specialist", "ppc_specialist", "social_media_manager",
  "content_marketing_specialist", "email_marketing_specialist", "marketing_automation_specialist",
  "marketing_analyst", "brand_manager", "growth_marketer", "influencer_marketing_specialist",
  "affiliate_marketing_specialist",
] as const;

export type MarketingRole = typeof MARKETING_ROLES[number];

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  jobRole?: MarketingRole | null;
  dashboardRoles: MarketingRole[];
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  actorRole?: MarketingRole | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  createdAt: string;
}

export interface KpiEntry {
  id: string;
  role: MarketingRole;
  metricKey: string;
  value: number;
  recordedByUserId: string;
  recordedByName: string;
  recordedAt: string;
}

export interface LearningMaterial {
  id: string;
  title: string;
  blobUrl: string;
  uploadedByName: string;
  uploadedAt: string;
  sortOrder: number;
}

export interface AdBudget {
  id: string;
  jalaliMonth: string;
  amount: number;
  notes?: string | null;
  updatedByName?: string | null;
  updatedByRole?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  materialId: string;
  userId: string;
  page: number;
  rects: HighlightRect[];
  color: string;
  quote: string;
  note?: string | null;
  createdAt: string;
}

export interface PersonalNote {
  id: string;
  userId: string;
  title: string;
  body: string;
  folder: string;
  color: string;
  pinned: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceData {
  contents: Content[];
  platforms: Platform[];
  types: ContentType[];
  statuses: ContentStatus[];
  campaigns: Campaign[];
  tags: Tag[];
  pillars: ContentPillar[];
  ideas: ContentIdea[];
  templates: ContentTemplate[];
  userProfiles: UserProfile[];
  activityLog: ActivityLogEntry[];
  kpiEntries: KpiEntry[];
  learningMaterials: LearningMaterial[];
  highlights: Highlight[];
  personalNotes: PersonalNote[];
  adBudgets: AdBudget[];
}

export interface AppSettings {
  theme: Theme;
  numeralSystem: "persian" | "english";
  defaultCalendarView: "month" | "week" | "day" | "agenda";
  firstDayOfWeek: "saturday" | "sunday";
  fontSize: "compact" | "normal" | "large";
  notificationsEnabled: boolean;
  notificationLeadMinutes: number;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  ideaScoring: IdeaScoringSettings;
}

export interface DashboardData {
  today: Content[];
  upcoming: Content[];
  overdue: Content[];
  awaitingReview: Content[];
  scheduled: Content[];
  recentlyPublished: Content[];
}
