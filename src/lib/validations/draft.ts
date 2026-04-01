import { z } from "zod";

const storyFrameSchema = z.object({
  order: z.number().int(),
  text: z.string(),
  isLogoFrame: z.boolean().optional(),
});

export const draftSchema = z.object({
  requestId: z.string().min(1, "נדרש מזהה בקשה"),
  format: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"] as const),
  hook: z
    .string()
    .min(5, "הוק חייב להכיל לפחות 5 תווים")
    .max(200, "הוק לא יכול לעלות על 200 תווים"),
  goal: z.string().optional(),
  bestAngle: z.string().optional(),
  facebookCaption: z.string().max(2000, "כיתוב פייסבוק לא יכול לעלות על 2000 תווים").optional(),
  instagramCaption: z.string().max(2200, "כיתוב אינסטגרם לא יכול לעלות על 2200 תווים").optional(),
  storyFrames: z.array(storyFrameSchema).optional(),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  visualDirection: z.string().optional(),
  whyThisMatters: z.string().optional(),
  adminNotes: z.string().optional(),
  // Public HTTPS URL for the primary media asset.
  // Required for Instagram publishing; optional for Facebook text/link posts.
  // null = no media (allowed on PATCH so the admin can clear the field).
  mediaUrl: z.union([z.string().url("mediaUrl must be a valid URL"), z.null()]).optional(),
});

export const patchDraftSchema = draftSchema.omit({ requestId: true }).partial();

export const revisionNoteSchema = z.object({
  note: z.string().min(10, "הערת תיקון חייבת להכיל לפחות 10 תווים"),
});

export const rejectNoteSchema = z.object({
  note: z.string().optional(),
});

export type DraftFormData = z.infer<typeof draftSchema>;
export type PatchDraftData = z.infer<typeof patchDraftSchema>;
