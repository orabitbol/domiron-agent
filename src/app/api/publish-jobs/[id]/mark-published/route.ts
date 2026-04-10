import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executePublishJob } from "@/lib/meta-publish";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the job exists and is in a publishable state before handing off.
  const publishJob = await prisma.publishJob.findUnique({ where: { id } });

  if (!publishJob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!["QUEUED", "SCHEDULED"].includes(publishJob.status)) {
    return NextResponse.json(
      {
        error:
          "ניתן לפרסם רק עבודות בסטטוס בתור או מתוזמן",
      },
      { status: 400 }
    );
  }

  // Parse optional slideImageUrls from the request body (for carousel publishing).
  // If the body is empty or unparseable, that's fine — it just means no carousel images.
  let slideImageUrls: string[] | undefined;
  try {
    const body = await _request.json();
    if (Array.isArray(body?.slideImageUrls) && body.slideImageUrls.length > 0) {
      slideImageUrls = body.slideImageUrls as string[];
    }
  } catch {
    // No body or invalid JSON — not an error, just means no carousel images
  }

  try {
    // Execute the real publish flow:
    //  1. Resolve active MetaConnection(s) for the job's platform
    //  2. Decrypt stored access token (calls decrypt() from lib/meta-token.ts)
    //  3. POST to the Meta Graph API (carousel multi-image if slideImageUrls provided)
    //  4. Persist externalPostId, publishedUrl, failureReason into the PublishJob
    const { overallStatus, results } = await executePublishJob(id, { slideImageUrls });

    // Reload the updated job to return the freshest record to the client.
    const updatedJob = await prisma.publishJob.findUnique({ where: { id } });

    return NextResponse.json({
      data: updatedJob,
      publishStatus: overallStatus,
      // Include per-platform detail so the client can show specific error messages.
      results: results.map((r) => ({
        platform: r.platform,
        success: r.success,
        externalPostId: r.externalPostId ?? null,
        publishedUrl: r.publishedUrl ?? null,
        failureReason: r.failureReason ?? null,
      })),
    });
  } catch (err) {
    // Unexpected error (DB failure, missing env var, etc.) — not a Meta API failure.
    // Meta API failures are captured inside executePublishJob and written to the job.
    console.error("[mark-published] unexpected error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "שגיאת שרת בלתי צפויה בעת הפרסום",
      },
      { status: 500 }
    );
  }
}
