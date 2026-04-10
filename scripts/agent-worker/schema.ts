/**
 * Shared TypeScript types for the Domiron Agent Worker.
 * These mirror the Zod schema defined in /src/app/api/agent/intake/route.ts
 * exactly — field names, enums, and constraints are kept in sync.
 */

export interface StoryFrame {
  order: number;
  text: string;
  isLogoFrame?: boolean;
}

export interface DraftContent {
  /** REQUIRED. Must match one of the ContentFormat enum values. */
  format: "STATIC" | "CAROUSEL" | "REEL" | "STORY";

  /** REQUIRED. Opening hook — 5 to 200 characters. */
  hook: string;

  /** What this post aims to achieve. */
  goal?: string;

  /** The best angle or creative perspective for this content. */
  best_angle?: string;

  /** Full Facebook caption — max 2000 chars. */
  facebook_caption?: string;

  /** Full Instagram caption — max 2200 chars. */
  instagram_caption?: string;

  /** Story frames — required when format is STORY. */
  story_frames?: StoryFrame[];

  /** Call-to-action text. */
  cta?: string;

  /** Hashtags as plain strings without the # symbol. */
  hashtags?: string[];

  /** Actionable visual direction for the designer. */
  visual_direction?: string;

  /** Why this content matters for Domiron's brand goals. */
  why_this_matters?: string;

  /**
   * Public HTTPS URL for the primary media asset.
   * Required for Instagram publishing (Meta must be able to fetch it).
   * Use CDN / Cloudinary / S3 / Vercel Blob — not localhost.
   */
  media_url?: string;
}

export interface IntakePayload {
  /** ID of an existing ContentRequest row in the database. */
  request_id: string;

  /** Optional — currently not used by the intake handler but accepted. */
  version?: number;

  /** Optional metadata passthrough. */
  meta?: {
    platform?: "INSTAGRAM" | "FACEBOOK" | "BOTH";
    content_type?: "POST" | "STORY" | "CAROUSEL" | "REEL";
    /** 1–365 */
    sequence_day?: number;
    /** max 50 chars */
    content_pillar?: string;
  };

  content: DraftContent;
}
