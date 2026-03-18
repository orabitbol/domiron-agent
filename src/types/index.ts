// ─── Enums ───────────────────────────────────────────────────────────────────

export enum RequestStatus {
  NEW = "NEW",
  IN_PROGRESS = "IN_PROGRESS",
  DRAFT_READY = "DRAFT_READY",
  REVISION_NEEDED = "REVISION_NEEDED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum ContentType {
  POST = "POST",
  STORY = "STORY",
  REEL = "REEL",
  CAROUSEL = "CAROUSEL",
  ARTICLE = "ARTICLE",
}

export enum Platform {
  INSTAGRAM = "INSTAGRAM",
  FACEBOOK = "FACEBOOK",
  LINKEDIN = "LINKEDIN",
  TWITTER = "TWITTER",
  TIKTOK = "TIKTOK",
}

export enum DraftStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REVISION_NEEDED = "REVISION_NEEDED",
  REJECTED = "REJECTED",
  EDITED = "EDITED",
}

export enum PublishJobStatus {
  QUEUED = "QUEUED",
  SCHEDULED = "SCHEDULED",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

// ─── Label Maps ──────────────────────────────────────────────────────────────

export const RequestStatusLabels: Record<RequestStatus, string> = {
  [RequestStatus.NEW]: "חדש",
  [RequestStatus.IN_PROGRESS]: "בעבודה",
  [RequestStatus.DRAFT_READY]: "טיוטה מוכנה",
  [RequestStatus.REVISION_NEEDED]: "נדרש תיקון",
  [RequestStatus.COMPLETED]: "הושלם",
  [RequestStatus.CANCELLED]: "בוטל",
};

export const ContentTypeLabels: Record<ContentType, string> = {
  [ContentType.POST]: "פוסט",
  [ContentType.STORY]: "סטורי",
  [ContentType.REEL]: "ריל",
  [ContentType.CAROUSEL]: "קרוסלה",
  [ContentType.ARTICLE]: "מאמר",
};

export const PlatformLabels: Record<Platform, string> = {
  [Platform.INSTAGRAM]: "אינסטגרם",
  [Platform.FACEBOOK]: "פייסבוק",
  [Platform.LINKEDIN]: "לינקדאין",
  [Platform.TWITTER]: "טוויטר",
  [Platform.TIKTOK]: "טיקטוק",
};

export const DraftStatusLabels: Record<DraftStatus, string> = {
  [DraftStatus.PENDING_REVIEW]: "ממתין לבדיקה",
  [DraftStatus.APPROVED]: "אושר",
  [DraftStatus.REVISION_NEEDED]: "נדרש תיקון",
  [DraftStatus.REJECTED]: "נדחה",
  [DraftStatus.EDITED]: "נערך",
};

export const PublishJobStatusLabels: Record<PublishJobStatus, string> = {
  [PublishJobStatus.QUEUED]: "בתור",
  [PublishJobStatus.SCHEDULED]: "מתוזמן",
  [PublishJobStatus.PUBLISHED]: "פורסם",
  [PublishJobStatus.FAILED]: "נכשל",
  [PublishJobStatus.CANCELLED]: "בוטל",
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ContentRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  contentType: ContentType;
  platform: Platform;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Draft {
  id: string;
  requestId: string;
  content: string;
  status: DraftStatus;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishJob {
  id: string;
  draftId: string;
  platform: Platform;
  status: PublishJobStatus;
  scheduledAt: Date;
  publishedAt?: Date;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name?: string;
}
