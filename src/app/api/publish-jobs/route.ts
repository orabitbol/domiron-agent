import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publishJobs = await prisma.publishJob.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      draft: {
        select: {
          id: true,
          hook: true,
          format: true,
          mediaUrl: true,
          request: {
            select: {
              title: true,
              platform: true,
              contentType: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ data: publishJobs });
}
