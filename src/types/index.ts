// ─── Enums ───────────────────────────────────────────────────────────────────
// These must stay in sync with prisma/schema.prisma.
// Do NOT add platforms or content types here that are not in the Prisma schema —
// they cannot be stored in the database and will cause runtime errors on insert.

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
  // NOTE: ARTICLE is intentionally absent — it does not exist in the DB schema.
}

export enum Platform {
  INSTAGRAM = "INSTAGRAM",
  FACEBOOK = "FACEBOOK",
  BOTH = "BOTH",
  // NOTE: LINKEDIN, TWITTER, TIKTOK are intentionally absent — they do not exist
  // in the DB schema and are not supported by the Meta integration.
}

export enum ContentFormat {
  STATIC = "STATIC",
  CAROUSEL = "CAROUSEL",
  REEL = "REEL",
  STORY = "STORY",
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
};

export const PlatformLabels: Record<Platform, string> = {
  [Platform.INSTAGRAM]: "אינסטגרם",
  [Platform.FACEBOOK]: "פייסבוק",
  [Platform.BOTH]: "פייסבוק + אינסטגרם",
};

export const ContentFormatLabels: Record<ContentFormat, string> = {
  [ContentFormat.STATIC]: "סטטי",
  [ContentFormat.CAROUSEL]: "קרוסלה",
  [ContentFormat.REEL]: "ריל",
  [ContentFormat.STORY]: "סטורי",
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
