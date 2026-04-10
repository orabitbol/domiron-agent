import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const publishJobs = await prisma.publishJob.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        draft: {
          select: {
            id: true,
            hook: true,
            format: true,
            mediaUrl: true,
            facebookCaption: true,
            instagramCaption: true,
            cta: true,
            carouselSlides: true,
            storyFrames: true,
            visualDirection: true,
            hashtags: true,
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
  } catch (err) {
    console.error("[/api/publish-jobs] GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
