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

  try {
    const job = await prisma.publishJob.findUnique({ where: { id } });

    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (job.status !== "FAILED") {
      return NextResponse.json(
        { error: "ניתן לנסות שוב רק עבודות שנכשלו" },
        { status: 400 }
      );
    }

    // Reset the job back to QUEUED so the existing mark-published path can re-run it.
    // Clear all result fields from the previous failed attempt.
    // draftId, platform, publishMethod, scheduledDate are preserved — they describe
    // what to publish, not the result of the last attempt.
    const updated = await prisma.publishJob.update({
      where: { id },
      data: {
        status: "QUEUED",
        failureReason: null,
        publishedAt: null,
        externalPostId: null,
        publishedUrl: null,
      },
    });

    console.log(`[publish-jobs/retry] Job ${id} reset from FAILED → QUEUED`);
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[/api/publish-jobs/:id/retry] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
