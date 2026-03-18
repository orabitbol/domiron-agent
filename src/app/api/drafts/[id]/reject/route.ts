import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rejectNoteSchema } from "@/lib/validations/draft";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const parsed = rejectNoteSchema.safeParse(body);
  const note = parsed.success ? (parsed.data.note ?? null) : null;

  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDraft = await tx.draft.update({
      where: { id },
      data: {
        status: "REJECTED",
        ...(note && { adminNotes: note }),
      },
    });

    await tx.contentRequest.update({
      where: { id: draft.requestId },
      data: { status: "CANCELLED" },
    });

    await tx.draftRevision.create({
      data: {
        draftId: id,
        version: draft.version,
        snapshot: JSON.parse(JSON.stringify({ ...updatedDraft, action: "REJECTED" })),
        changedBy: "ADMIN",
        changeNote: note ?? "נדחה",
      },
    });

    return updatedDraft;
  });

  return NextResponse.json({ data: updated });
}
