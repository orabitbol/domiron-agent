import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const draft = await prisma.draft.findUnique({
    where: { id },
    include: { request: true },
  });

  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!["PENDING_REVIEW", "EDITED"].includes(draft.status)) {
    return NextResponse.json(
      { error: "ניתן לאשר רק טיוטות בסטטוס ממתין לבדיקה או נערך" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedDraft = await tx.draft.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    await tx.contentRequest.update({
      where: { id: draft.requestId },
      data: { status: "COMPLETED" },
    });

    const publishJob = await tx.publishJob.create({
      data: {
        draftId: id,
        platform: draft.request.platform,
        status: "QUEUED",
        publishMethod: "MANUAL",
      },
    });

    await tx.draftRevision.create({
      data: {
        draftId: id,
        version: draft.version,
        snapshot: JSON.parse(JSON.stringify({ ...updatedDraft, action: "APPROVED" })),
        changedBy: "ADMIN",
        changeNote: "אושר",
      },
    });

    return { draft: updatedDraft, publishJob };
  });

  return NextResponse.json({ data: result });
}
