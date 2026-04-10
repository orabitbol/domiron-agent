import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { patchDraftSchema } from "@/lib/validations/draft";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const draft = await prisma.draft.findUnique({
      where: { id },
      include: {
        request: true,
        publishJob: true,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: draft });
  } catch (err) {
    console.error("[/api/drafts/:id] GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = patchDraftSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.issues },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.draft.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = result.data;

    const updated = await prisma.$transaction(async (tx) => {
      const newVersion = existing.version + 1;

      const updatedDraft = await tx.draft.update({
        where: { id },
        data: {
          ...(data.format !== undefined && { format: data.format }),
          ...(data.hook !== undefined && { hook: data.hook }),
          ...(data.goal !== undefined && { goal: data.goal || null }),
          ...(data.bestAngle !== undefined && { bestAngle: data.bestAngle || null }),
          ...(data.facebookCaption !== undefined && { facebookCaption: data.facebookCaption || null }),
          ...(data.instagramCaption !== undefined && { instagramCaption: data.instagramCaption || null }),
          ...(data.storyFrames !== undefined && {
            storyFrames: JSON.parse(JSON.stringify(data.storyFrames)),
          }),
          ...(data.carouselSlides !== undefined && {
            carouselSlides: JSON.parse(JSON.stringify(data.carouselSlides)),
          }),
          ...(data.cta !== undefined && { cta: data.cta || null }),
          ...(data.hashtags !== undefined && { hashtags: data.hashtags }),
          ...(data.visualDirection !== undefined && { visualDirection: data.visualDirection || null }),
          ...(data.whyThisMatters !== undefined && { whyThisMatters: data.whyThisMatters || null }),
          ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes || null }),
          ...(data.mediaUrl !== undefined && { mediaUrl: data.mediaUrl ?? null }),
          status: "EDITED",
          version: newVersion,
        },
      });

      await tx.draftRevision.create({
        data: {
          draftId: id,
          version: newVersion,
          snapshot: JSON.parse(JSON.stringify(updatedDraft)),
          changedBy: "ADMIN",
        },
      });

      return updatedDraft;
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[/api/drafts/:id] PATCH error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
