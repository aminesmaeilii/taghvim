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
}

export interface DashboardData {
  today: Content[];
  upcoming: Content[];
  overdue: Content[];
  awaitingReview: Content[];
  scheduled: Content[];
  recentlyPublished: Content[];
}
