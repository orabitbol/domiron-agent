import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestSchema } from "@/lib/validations/request";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.contentRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      draft: {
        select: { id: true, status: true },
      },
    },
  });

  return NextResponse.json({ data: requests });
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

  const result = requestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.issues },
      { status: 400 }
    );
  }

  const { title, platform, contentType, sequenceDay, contentPillar, instructions, targetPublishDate } =
    result.data;

  const newRequest = await prisma.contentRequest.create({
    data: {
      title,
      platform,
      contentType,
      sequenceDay: sequenceDay ?? null,
      contentPillar: contentPillar || null,
      instructions: instructions || null,
      targetPublishDate: targetPublishDate ? new Date(targetPublishDate) : null,
    },
  });

  return NextResponse.json({ data: newRequest }, { status: 201 });
}
