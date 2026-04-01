import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { patchRequestSchema } from "@/lib/validations/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const contentRequest = await prisma.contentRequest.findUnique({
      where: { id },
      include: { draft: true },
    });

    if (!contentRequest) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: contentRequest });
  } catch (err) {
    console.error("[/api/requests/:id] GET error:", err instanceof Error ? err.message : err);
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

  const result = patchRequestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.issues },
      { status: 400 }
    );
  }

  const { title, platform, contentType, sequenceDay, contentPillar, instructions, targetPublishDate, status } =
    result.data;

  try {
    const updated = await prisma.contentRequest.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(platform !== undefined && { platform }),
        ...(contentType !== undefined && { contentType }),
        ...(sequenceDay !== undefined && { sequenceDay }),
        ...(contentPillar !== undefined && { contentPillar: contentPillar || null }),
        ...(instructions !== undefined && { instructions: instructions || null }),
        ...(targetPublishDate !== undefined && {
          targetPublishDate: targetPublishDate ? new Date(targetPublishDate) : null,
        }),
        ...(status !== undefined && { status }),
      },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[/api/requests/:id] PATCH error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const contentRequest = await prisma.contentRequest.findUnique({
      where: { id },
    });

    if (!contentRequest) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (contentRequest.status !== "NEW") {
      return NextResponse.json(
        { error: "ניתן למחוק רק בקשות בסטטוס חדש" },
        { status: 400 }
      );
    }

    await prisma.contentRequest.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[/api/requests/:id] DELETE error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

