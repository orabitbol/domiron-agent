import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const storyFrameSchema = z.object({
  order: z.number().int(),
  text: z.string(),
  isLogoFrame: z.boolean().optional(),
});

const intakeSchema = z.object({
  request_id: z.string().min(1),
  version: z.number().int().optional(),
  meta: z
    .object({
      platform: z.enum(["INSTAGRAM", "FACEBOOK", "BOTH"] as const).optional(),
      content_type: z
        .enum(["POST", "STORY", "CAROUSEL", "REEL"] as const)
        .optional(),
      sequence_day: z.number().int().min(1).max(365).optional(),
      content_pillar: z.string().max(50).optional(),
    })
    .optional(),
  content: z.object({
    format: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"] as const),
    hook: z.string().min(5).max(200),
    goal: z.string().optional(),
    best_angle: z.string().optional(),
    facebook_caption: z.string().max(2000).optional(),
    instagram_caption: z.string().max(2200).optional(),
    story_frames: z.array(storyFrameSchema).optional(),
    cta: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    visual_direction: z.string().optional(),
    why_this_matters: z.string().optional(),
    // Public HTTPS URL of the primary media asset.
    // Required for Instagram publishing; optional for Facebook text posts.
    // Must be accessible by Meta's servers (use CDN / Cloudinary / S3 / Vercel Blob).
    media_url: z.string().url().optional(),
  }),
});

export async function POST(request: Request) {
  const apiKey = request.headers.get("X-Agent-Key");
  if (!apiKey || apiKey !== process.env.AGENT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = intakeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.issues },
      { status: 400 }
    );
  }

  const { request_id, content } = result.data;

  try {
    const contentRequest = await prisma.contentRequest.findUnique({
      where: { id: request_id },
    });
    if (!contentRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const existing = await prisma.draft.findUnique({
      where: { requestId: request_id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Draft already exists for this request" },
        { status: 409 }
      );
    }

    const draft = await prisma.$transaction(async (tx) => {
      const newDraft = await tx.draft.create({
        data: {
          requestId: request_id,
          format: content.format,
          hook: content.hook,
          hashtags: content.hashtags ?? [],
          storyFrames: content.story_frames
            ? JSON.parse(JSON.stringify(content.story_frames))
            : null,
          goal: content.goal || null,
          bestAngle: content.best_angle || null,
          facebookCaption: content.facebook_caption || null,
          instagramCaption: content.instagram_caption || null,
          cta: content.cta || null,
          visualDirection: content.visual_direction || null,
          whyThisMatters: content.why_this_matters || null,
          mediaUrl: content.media_url || null,
          adminNotes: null,
          status: "PENDING_REVIEW",
          version: 1,
        },
      });

      await tx.contentRequest.update({
        where: { id: request_id },
        data: { status: "DRAFT_READY" },
      });

      await tx.draftRevision.create({
        data: {
          draftId: newDraft.id,
          version: 1,
          snapshot: JSON.parse(JSON.stringify(newDraft)),
          changedBy: "AGENT",
          changeNote: "Created via agent intake",
        },
      });

      return newDraft;
    });

    return NextResponse.json({ data: draft }, { status: 201 });
  } catch (err) {
    console.error("[agent/intake] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
