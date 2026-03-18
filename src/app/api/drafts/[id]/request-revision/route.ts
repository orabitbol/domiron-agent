import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revisionNoteSchema } from "@/lib/validations/draft";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
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

  const result = revisionNoteSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.issues },
      { status: 400 }
    );
  }

  const { note } = result.data;

  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDraft = await tx.draft.update({
      where: { id },
      data: {
        status: "REVISION_NEEDED",
        adminNotes: note,
      },
    });

    await tx.contentRequest.update({
      where: { id: draft.requestId },
      data: { status: "REVISION_NEEDED" },
    });

    await tx.draftRevision.create({
      data: {
        draftId: id,
        version: draft.version,
        snapshot: JSON.parse(JSON.stringify({ ...updatedDraft, action: "REVISION_NEEDED" })),
        changedBy: "ADMIN",
        changeNote: note,
      },
    });

    return updatedDraft;
  });

  return NextResponse.json({ data: updated });
}
