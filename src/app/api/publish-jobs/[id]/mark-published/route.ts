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

  const publishJob = await prisma.publishJob.findUnique({ where: { id } });

  if (!publishJob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!["QUEUED", "SCHEDULED"].includes(publishJob.status)) {
    return NextResponse.json(
      { error: "ניתן לסמן כפורסם רק עבודות בסטטוס בתור או מתוזמן" },
      { status: 400 }
    );
  }

  const updated = await prisma.publishJob.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      publishMethod: "MANUAL",
    },
  });

  return NextResponse.json({ data: updated });
}
