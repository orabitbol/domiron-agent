import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { draftSchema } from "@/lib/validations/draft";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await prisma.draft.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          platform: true,
          contentType: true,
          sequenceDay: true,
        },
      },
    },
  });

  return NextResponse.json({ data: drafts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = draftSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.issues },
      { status: 400 }
    );
  }

  const { requestId, format, hook, hashtags, storyFrames, ...rest } = result.data;

  // Ensure request exists
  const contentRequest = await prisma.contentRequest.findUnique({
    where: { id: requestId },
  });
  if (!contentRequest) {
    return NextResponse.json({ error: "בקשה לא נמצאה" }, { status: 404 });
  }

  // Ensure request does not already have a draft
  const existing = await prisma.draft.findUnique({ where: { requestId } });
  if (existing) {
    return NextResponse.json(
      { error: "לבקשה זו כבר קיימת טיוטה" },
      { status: 409 }
    );
  }

  const draft = await prisma.$transaction(async (tx) => {
    const newDraft = await tx.draft.create({
      data: {
        requestId,
        format,
        hook: hook ?? null,
        hashtags: hashtags ?? [],
        storyFrames: storyFrames ? JSON.parse(JSON.stringify(storyFrames)) : null,
        goal: rest.goal || null,
        bestAngle: rest.bestAngle || null,
        facebookCaption: rest.facebookCaption || null,
        instagramCaption: rest.instagramCaption || null,
        cta: rest.cta || null,
        visualDirection: rest.visualDirection || null,
        whyThisMatters: rest.whyThisMatters || null,
        adminNotes: rest.adminNotes || null,
        status: "PENDING_REVIEW",
        version: 1,
      },
    });

    await tx.contentRequest.update({
      where: { id: requestId },
      data: { status: "DRAFT_READY" },
    });

    await tx.draftRevision.create({
      data: {
        draftId: newDraft.id,
        version: 1,
        snapshot: JSON.parse(JSON.stringify(newDraft)),
        changedBy: "AGENT",
      },
    });

    return newDraft;
  });

  return NextResponse.json({ data: draft }, { status: 201 });
}
