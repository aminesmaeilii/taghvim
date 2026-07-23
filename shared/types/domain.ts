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
  updatedByName?: string | null;
  updatedByRole?: string | null;
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
  archivedAt?: string | null;
  sortOrder?: number;
  linkedNoteIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskItem extends BaseEntity {
  title: string;
  notes?: string | null;
  assigneeUserId: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  createdByUserId: string;
  createdByName?: string | null;
}

export type ChatConversationType = "DIRECT" | "GROUP";
export type ChatMemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type ChatMessageStatus = "sent" | "failed" | "pending";
export type ChatContextType = "content" | "task" | "campaign" | "calendar_event" | "idea" | "template" | "note" | "learning_material" | "ad_budget";

export interface ChatConversation {
  id: string;
  type: ChatConversationType;
  title?: string | null;
  avatarUrl?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  directKey?: string | null;
}

export interface ChatConversationMember {
  conversationId: string;
  userId: string;
  role: ChatMemberRole;
  joinedAt: string;
  lastReadAt?: string | null;
  mutedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: "TEXT";
  body: string;
  contextType?: ChatContextType | null;
  contextId?: string | null;
  contextMetadata?: Record<string, string> | null;
  clientMessageId: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
}

export interface ChatConversationSummary {
  conversation: ChatConversation;
  members: ChatConversationMember[];
  unreadCount: number;
  lastMessage?: ChatMessage | null;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  nextCursor?: string | null;
}

export type ReminderRelatedEntityType = "task" | "content" | "campaign" | "calendar_event" | "personal";
export type ReminderStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "PARTIALLY_SENT" | "FAILED" | "CANCELLED" | "SNOOZED";
export type NotificationType = "reminder" | "chat" | "task_assignment" | "deadline" | "overdue" | "calendar_change" | "campaign";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export interface Reminder {
  id: string;
  userId: string;
  taskId?: string | null;
  eventId?: string | null;
  campaignId?: string | null;
  relatedEntityId?: string | null;
  relatedEntityType: ReminderRelatedEntityType;
  title: string;
  body?: string | null;
  scheduledForUtc: string;
  originalTimezone: string;
  status: ReminderStatus;
  priority: NotificationPriority;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  sentAt?: string | null;
  deduplicationKey: string;
  retryCount: number;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceName: string;
  browserInfo?: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  failureCount: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedEntityType?: ReminderRelatedEntityType | ChatContextType | "conversation" | null;
  relatedEntityId?: string | null;
  actionUrl?: string | null;
  priority: NotificationPriority;
  readAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

export type MonitoringPlatformKey = "INSTAGRAM" | "EITAA" | "BALE" | "TELEGRAM" | "RUBIKA" | string;
export type MonitoringCapabilityKey =
  | "PROFILE_INFORMATION" | "PROFILE_AVATAR" | "PROFILE_DESCRIPTION" | "VERIFICATION_STATUS"
  | "FOLLOWER_COUNT" | "MEMBER_COUNT" | "SUBSCRIBER_COUNT" | "TOTAL_POST_COUNT"
  | "RECENT_CONTENT" | "CONTENT_TEXT_PREVIEW" | "CONTENT_MEDIA_TYPE" | "CONTENT_VIEWS"
  | "CONTENT_REACTIONS" | "CONTENT_COMMENTS" | "CONTENT_SHARES" | "CONTENT_FORWARDS"
  | "CONTENT_LIKES" | "CONTENT_ENGAGEMENT" | "PUBLISHING_FREQUENCY" | "LATEST_CONTENT_DATE";
export type MonitoringSupportLevel = "AVAILABLE" | "UNAVAILABLE" | "RESTRICTED" | "TEMPORARILY_FAILED" | "STALE" | "ESTIMATED";
export type MonitoringSourceType = "PROFILE" | "CHANNEL" | "PAGE" | "GROUP";
export type MonitoringJobStatus = "QUEUED" | "CLAIMED" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "RATE_LIMITED" | "CANCELLED";
export type MonitoringJobTrigger = "DAILY" | "SCHEDULED" | "LOGIN_RECOVERY" | "MANUAL" | "RETRY";
export type MonitoringHealthStatus = "HEALTHY" | "LIMITED" | "NEEDS_REVIEW" | "DOWN" | "DISABLED";
export type MonitoringDataQuality = "COMPLETE" | "PARTIAL" | "INCOMPLETE" | "STALE" | "INVALID";

export interface MonitoringPlatform extends BaseEntity {
  key: MonitoringPlatformKey;
  displayNameFa: string;
  displayNameEn: string;
  icon: string;
  accentColor: string;
  connectorKey: string;
  connectorVersion: string;
  enabled: boolean;
  supportedSourceTypes: MonitoringSourceType[];
  allowedDomains: string[];
  defaultCollectionIntervalMinutes: number;
  minimumCollectionIntervalMinutes: number;
  status: "ACTIVE" | "DISABLED" | "BETA";
  healthStatus: MonitoringHealthStatus;
  lastVerifiedAt?: string | null;
}

export interface MonitoringPlatformCapability {
  platformKey: MonitoringPlatformKey;
  capabilityKey: MonitoringCapabilityKey;
  supported: boolean;
  supportLevel: MonitoringSupportLevel;
  lastVerifiedAt?: string | null;
  limitationReason?: string | null;
}

export interface MonitoringSource extends BaseEntity {
  platformKey: MonitoringPlatformKey;
  displayName: string;
  sourceType: MonitoringSourceType;
  sourceUrl: string;
  normalizedUrl: string;
  handle?: string | null;
  externalId?: string | null;
  avatarUrl?: string | null;
  enabled: boolean;
  collectionEnabled: boolean;
  collectionIntervalMinutes: number;
  dailyCollectionTime: string;
  freshnessThresholdHours: number;
  timezone: string;
  createdBy?: string | null;
  identityChangedAt?: string | null;
  identityChangeNote?: string | null;
}

export interface MonitoringSourceCapability {
  sourceId: string;
  capabilityKey: MonitoringCapabilityKey;
  supported: boolean;
  supportLevel: MonitoringSupportLevel;
  lastDetectedAt?: string | null;
  limitationReason?: string | null;
}

export interface MonitoringMetricValue {
  capabilityKey: MonitoringCapabilityKey;
  numericValue?: number | null;
  textValue?: string | null;
  unit?: string | null;
  observed: boolean;
  estimated: boolean;
  qualityStatus: MonitoringSupportLevel;
}

export interface MonitoringSnapshot {
  id: string;
  sourceId: string;
  collectedAt: string;
  snapshotDate: string;
  collectionJobId: string;
  dataQuality: MonitoringDataQuality;
  collectionMethod: "OFFICIAL_API" | "PUBLIC_ENDPOINT" | "PUBLIC_PAGE" | "CONNECTOR_LIMITATION";
  normalizedMetrics: MonitoringMetricValue[];
  createdAt: string;
}

export interface MonitoredContent {
  id: string;
  sourceId: string;
  platformContentId: string;
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  textPreview?: string | null;
  mediaType?: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoredContentSnapshot {
  id: string;
  monitoredContentId: string;
  collectedAt: string;
  normalizedMetrics: MonitoringMetricValue[];
  dataQuality: MonitoringDataQuality;
}

export interface MonitoringJob {
  id: string;
  platformKey: MonitoringPlatformKey;
  sourceId: string;
  batchId: string;
  triggerType: MonitoringJobTrigger;
  scheduledFor: string;
  status: MonitoringJobStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  recordsCollected: number;
  retryCount: number;
  errorCode?: string | null;
  safeErrorMessage?: string | null;
  createdAt: string;
}

export interface MonitoringDailyAggregate {
  sourceId: string;
  date: string;
  metricKey: MonitoringCapabilityKey;
  openingValue?: number | null;
  closingValue?: number | null;
  minimumValue?: number | null;
  maximumValue?: number | null;
  changeValue?: number | null;
  changePercentage?: number | null;
  sampleCount: number;
  dataCompleteness: MonitoringDataQuality;
}

export interface MonitoringEvent {
  id: string;
  sourceId?: string | null;
  platformKey?: MonitoringPlatformKey | null;
  eventType: string;
  title: string;
  metadata?: Record<string, string | number | boolean | null>;
  occurredAt: string;
  createdAt: string;
}

export interface MonitoringOverview {
  generatedAt: string;
  activeSources: number;
  supportedPlatforms: number;
  updatedToday: number;
  awaitingCollection: number;
  staleSources: number;
  errorSources: number;
  lastSuccessfulCollection?: string | null;
  nextScheduledBatch?: string | null;
  dataQuality: MonitoringDataQuality;
  platforms: MonitoringPlatform[];
  sources: Array<MonitoringSource & { platform?: MonitoringPlatform; latestSnapshot?: MonitoringSnapshot | null; latestJob?: MonitoringJob | null; sparkline: number[]; capabilities: MonitoringSourceCapability[] }>;
  events: MonitoringEvent[];
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  defaultReminderMinutes: number[];
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  privacyMode: "full" | "generic";
  chatNotifications: boolean;
  taskNotifications: boolean;
  overdueNotifications: boolean;
  criticalBypassesQuietHours: boolean;
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
  learningMaterials: LearningMaterial[];
  highlights: Highlight[];
  personalNotes: PersonalNote[];
  adBudgets: AdBudget[];
  tasks: TaskItem[];
  chatConversations: ChatConversation[];
  chatMembers: ChatConversationMember[];
  chatMessages: ChatMessage[];
  reminders: Reminder[];
  pushSubscriptions: PushSubscriptionRecord[];
  notifications: AppNotification[];
  monitoringPlatforms: MonitoringPlatform[];
  monitoringPlatformCapabilities: MonitoringPlatformCapability[];
  monitoringSources: MonitoringSource[];
  monitoringSourceCapabilities: MonitoringSourceCapability[];
  monitoringSnapshots: MonitoringSnapshot[];
  monitoredContents: MonitoredContent[];
  monitoredContentSnapshots: MonitoredContentSnapshot[];
  monitoringJobs: MonitoringJob[];
  monitoringDailyAggregates: MonitoringDailyAggregate[];
  monitoringEvents: MonitoringEvent[];
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
  notificationPreferences?: NotificationPreferences;
}

export interface DashboardData {
  today: Content[];
  upcoming: Content[];
  overdue: Content[];
  awaitingReview: Content[];
  scheduled: Content[];
  recentlyPublished: Content[];
}

export type ReportMode = "overview" | "operations" | "collaboration";
export type ReportComparisonMode = "previous_period" | "none";

export interface ReportFilters {
  fromDate: string;
  toDate: string;
  team?: string;
  userId?: string;
  role?: string;
  campaignId?: string;
  platformId?: string;
  typeId?: string;
  taskStatus?: TaskStatus | "all";
  comparisonMode: ReportComparisonMode;
}

export interface ReportMetricDefinition {
  key: string;
  label: string;
  meaning: string;
  formula: string;
  source: string;
  filters: string[];
  comparison: string;
  permission: string;
  kind: "observed" | "estimated" | "missing";
  completeness: string;
}

export interface ReportKpi {
  key: string;
  label: string;
  value: number | null;
  unit?: "count" | "percent" | "days" | "hours";
  previousValue?: number | null;
  change?: number | null;
  status: "good" | "watch" | "risk" | "neutral" | "missing";
  insight: string;
  sampleSize?: number;
}

export interface ReportBreakdownItem {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface ReportTrendPoint {
  date: string;
  planned: number;
  completed: number;
  messages: number;
  reminders: number;
}

export interface ReportInsight {
  id: string;
  title: string;
  body: string;
  severity: "positive" | "risk" | "neutral";
  inspectKey: string;
}

export interface ReportTableRow {
  id: string;
  kind: "task" | "content" | "campaign" | "chat" | "reminder" | "notification";
  title: string;
  owner: string;
  status: string;
  date: string;
  priority?: Priority | NotificationPriority | null;
  risk?: string | null;
}

export interface ReportDataQualityIssue {
  key: string;
  label: string;
  count: number;
  explanation: string;
}

export interface ReportSnapshot {
  filters: ReportFilters;
  generatedAt: string;
  comparisonPeriod: { fromDate: string; toDate: string } | null;
  dataCompleteness: "complete" | "partial" | "insufficient";
  summary: string;
  kpis: ReportKpi[];
  contentStatus: ReportBreakdownItem[];
  taskStatus: ReportBreakdownItem[];
  platforms: ReportBreakdownItem[];
  contentTypes: ReportBreakdownItem[];
  campaigns: ReportBreakdownItem[];
  teams: ReportBreakdownItem[];
  workflowStages: ReportBreakdownItem[];
  collaboration: ReportBreakdownItem[];
  reminders: ReportBreakdownItem[];
  trend: ReportTrendPoint[];
  insights: ReportInsight[];
  risks: ReportInsight[];
  table: { rows: ReportTableRow[]; total: number; page: number; pageSize: number };
  dataQuality: ReportDataQualityIssue[];
  metricCatalog: ReportMetricDefinition[];
  privacy: { presentationSafe: boolean; hiddenFields: string[] };
}
