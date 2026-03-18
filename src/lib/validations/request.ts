import { z } from "zod";

export const requestSchema = z.object({
  title: z
    .string()
    .min(3, "שם הבקשה חייב להכיל לפחות 3 תווים")
    .max(100, "שם הבקשה לא יכול לעלות על 100 תווים"),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "BOTH"] as const),
  contentType: z.enum(["POST", "STORY", "CAROUSEL", "REEL"] as const),
  sequenceDay: z
    .number()
    .int("יום בסדרה חייב להיות מספר שלם")
    .min(1, "יום מינימלי 1")
    .max(365, "יום מקסימלי 365")
    .optional(),
  contentPillar: z
    .string()
    .max(50, "עמוד תוכן לא יכול לעלות על 50 תווים")
    .optional(),
  instructions: z
    .string()
    .max(1000, "הוראות לא יכולות לעלות על 1000 תווים")
    .optional(),
  targetPublishDate: z.string().optional(),
});

export const patchRequestSchema = requestSchema.partial().extend({
  status: z
    .enum([
      "NEW",
      "IN_PROGRESS",
      "DRAFT_READY",
      "REVISION_NEEDED",
      "COMPLETED",
      "CANCELLED",
    ] as const)
    .optional(),
});

export type RequestFormData = z.infer<typeof requestSchema>;
export type PatchRequestData = z.infer<typeof patchRequestSchema>;
