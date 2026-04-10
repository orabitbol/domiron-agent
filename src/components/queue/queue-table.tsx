"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishJobStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useMarkPublished,
  useRetryPublishJob,
  type PublishJobWithDraft,
  type MarkPublishedResponse,
} from "@/hooks/use-publish-jobs";
import { generateCarouselSlideImages, generatePostImage } from "@/components/queue/carousel-export-helper";

const platformLabels: Record<string, string> = {
  INSTAGRAM: "אינסטגרם",
  FACEBOOK: "פייסבוק",
  BOTH: "שניהם",
};

const contentTypeLabels: Record<string, string> = {
  POST: "פוסט",
  STORY: "סטורי",
  CAROUSEL: "קרוסלה",
  REEL: "ריל",
};

const headerStyle = {
  padding: "12px 16px",
  textAlign: "right" as const,
  fontSize: "12px",
  fontWeight: 500,
  color: "#64748B",
  borderBottom: "1px solid #2D3148",
  whiteSpace: "nowrap" as const,
};

const cellStyle = {
  padding: "14px 16px",
  textAlign: "right" as const,
  fontSize: "14px",
  color: "#F1F5F9",
  borderBottom: "1px solid #1e2235",
  verticalAlign: "middle" as const,
};

interface QueueTableProps {
  jobs: PublishJobWithDraft[];
}

export function QueueTable({ jobs }: QueueTableProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [carouselProgress, setCarouselProgress] = useState<string | null>(null);
  const { mutateAsync: markPublished, isPending } = useMarkPublished();
  const { mutateAsync: retryJob, isPending: isRetrying } = useRetryPublishJob();

  const isPublishing = isPending || carouselProgress !== null;

  const handleConfirm = useCallback(async () => {
    if (!confirmId) return;

    const job = jobs.find((j) => j.id === confirmId);
    if (!job) return;

    try {
      let slideImageUrls: string[] | undefined;

      // ── Generate images before publish ─────────────────────────────────
      // POST: single 1080x1080 image
      // CAROUSEL: one image per slide
      // Both upload via /api/export/slides to get Cloudinary URLs.
      const fmt = job.draft.format;

      if (fmt === "STATIC" || fmt === "CAROUSEL") {
        try {
          if (fmt === "CAROUSEL") {
            setCarouselProgress("מייצר תמונות סליידים...");
            const images = await generateCarouselSlideImages(job.draft);
            console.log(`[QueueTable] Generated ${images.length} carousel slide images`);

            const urls: string[] = [];
            for (let i = 0; i < images.length; i++) {
              setCarouselProgress(`מעלה תמונה ${i + 1}/${images.length}...`);
              const uploadRes = await fetch("/api/export/slides", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: images[i] }),
              });
              if (!uploadRes.ok) {
                const err = await uploadRes.json().catch(() => ({}));
                throw new Error(err.error ?? `שגיאה בהעלאת סלייד ${i + 1}`);
              }
              const { url } = (await uploadRes.json()) as { url: string };
              urls.push(url);
            }
            slideImageUrls = urls;
            setCarouselProgress("מפרסם קרוסלה...");
          } else {
            // POST / STATIC — generate single image
            setCarouselProgress("מייצר תמונה...");
            const image = await generatePostImage(job.draft);
            console.log(`[QueueTable] Generated post image`);

            setCarouselProgress("מעלה תמונה...");
            const uploadRes = await fetch("/api/export/slides", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image }),
            });
            if (!uploadRes.ok) {
              const err = await uploadRes.json().catch(() => ({}));
              throw new Error(err.error ?? "שגיאה בהעלאת תמונת הפוסט");
            }
            const { url } = (await uploadRes.json()) as { url: string };
            slideImageUrls = [url];
            setCarouselProgress("מפרסם...");
          }
        } catch (err) {
          console.error("[QueueTable] Image export/upload failed:", err);
          toast.error(
            err instanceof Error ? err.message : "שגיאה בייצוא תמונות"
          );
          setCarouselProgress(null);
          setConfirmId(null);
          return;
        }
      }

      // Hard guard: POST and CAROUSEL must have images
      if ((fmt === "STATIC" || fmt === "CAROUSEL") && (!slideImageUrls || slideImageUrls.length === 0)) {
        toast.error("שגיאה: לא נוצרו תמונות לפרסום");
        setCarouselProgress(null);
        setConfirmId(null);
        return;
      }

      const response: MarkPublishedResponse = await markPublished(
        slideImageUrls ? { id: confirmId, slideImageUrls } : confirmId
      );

      if (response.publishStatus === "PUBLISHED") {
        toast.success("הפוסט פורסם בהצלחה");
      } else {
        const firstFailure = response.results.find((r) => !r.success);
        toast.error(
          firstFailure?.failureReason
            ? `שגיאה בפרסום [${firstFailure.platform}]: ${firstFailure.failureReason}`
            : "הפרסום נכשל — בדוק את הסיבה בתור הפרסום"
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בפרסום הפוסט");
    } finally {
      setCarouselProgress(null);
      setConfirmId(null);
    }
  }, [confirmId, jobs, markPublished]);

  return (
    <>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "#2D3148" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#1A1D27" }}>
            <tr>
              <th style={headerStyle}>כותרת</th>
              <th style={headerStyle}>הוק</th>
              <th style={headerStyle}>פלטפורמה</th>
              <th style={headerStyle}>סוג תוכן</th>
              <th style={headerStyle}>סטטוס</th>
              <th style={headerStyle}>תאריך יצירה</th>
              <th style={{ ...headerStyle, textAlign: "center" as const }}>
                פעולות
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const isActionable =
                job.status === "QUEUED" || job.status === "SCHEDULED";
              const isFailed = job.status === "FAILED";
              return (
                <tr
                  key={job.id}
                  style={{ backgroundColor: "#13151F" }}
                  className="transition-colors hover:bg-white/[0.02]"
                >
                  <td style={cellStyle}>
                    <span className="font-medium">
                      {job.draft.request.title}
                    </span>
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      color: "#94A3B8",
                      maxWidth: "220px",
                    }}
                  >
                    <span
                      className="block overflow-hidden"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                      }}
                    >
                      {job.draft.hook ?? "—"}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, color: "#94A3B8" }}>
                    {platformLabels[job.draft.request.platform] ??
                      job.draft.request.platform}
                  </td>
                  <td style={{ ...cellStyle, color: "#94A3B8" }}>
                    {contentTypeLabels[job.draft.request.contentType] ??
                      job.draft.request.contentType}
                  </td>
                  <td style={cellStyle}>
                    <div className="flex flex-col gap-1">
                      <PublishJobStatusBadge status={job.status} />
                      {isFailed && job.failureReason && (
                        <p
                          className="text-xs leading-tight"
                          style={{ color: "#f87171", maxWidth: "200px" }}
                          title={job.failureReason}
                        >
                          {job.failureReason.length > 80
                            ? job.failureReason.slice(0, 80) + "…"
                            : job.failureReason}
                        </p>
                      )}
                    </div>
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      color: "#64748B",
                      fontSize: "13px",
                    }}
                  >
                    {format(new Date(job.createdAt), "dd/MM/yyyy")}
                  </td>
                  <td
                    style={{ ...cellStyle, textAlign: "center" as const }}
                  >
                    {isActionable && (
                      <Button
                        size="sm"
                        disabled={isPublishing}
                        onClick={() => {
                          // Block formats that cannot be published correctly
                          if (job.draft.format === "STORY") {
                            toast.error("פרסום סטורי עדיין לא נתמך — נדרש ייצוא פריימים כתמונות או וידאו.");
                            return;
                          }
                          if (job.draft.format === "REEL") {
                            toast.error("פרסום ריל עדיין לא נתמך — נדרש ייצוא וידאו.");
                            return;
                          }
                          const needsMedia =
                            job.draft.request.platform === "INSTAGRAM" ||
                            job.draft.request.platform === "BOTH";
                          if (needsMedia && !job.draft.mediaUrl && job.draft.format !== "CAROUSEL") {
                            toast.error(
                              "לפרסום לאינסטגרם נדרשת תמונה. פתח את הטיוטה והעלה תמונה לפני הפרסום."
                            );
                            return;
                          }
                          setConfirmId(job.id);
                        }}
                        style={{
                          backgroundColor: "#14532d",
                          color: "#4ade80",
                        }}
                        className="text-xs font-medium"
                      >
                        {isPublishing && confirmId === job.id ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {carouselProgress ?? "מפרסם..."}
                          </span>
                        ) : (
                          "פרסם עכשיו"
                        )}
                      </Button>
                    )}
                    {isFailed && (
                      <Button
                        size="sm"
                        disabled={isRetrying}
                        onClick={async () => {
                          try {
                            await retryJob(job.id);
                            toast.success("עבודת הפרסום אופסה לתור — לחץ פרסם עכשיו כדי לנסות שוב");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "שגיאה באיפוס עבודת הפרסום");
                          }
                        }}
                        style={{
                          backgroundColor: "#1e3a5f",
                          color: "#93c5fd",
                        }}
                        className="text-xs font-medium"
                      >
                        נסה שוב
                      </Button>
                    )}
                    {(() => {
                      if (job.status !== "PUBLISHED") return null;

                      // Log EVERY publishedUrl for debugging
                      console.log(`[QueueTable] FINAL publishedUrl for job ${job.id}:`, JSON.stringify(job.publishedUrl));

                      const url = job.publishedUrl;

                      // Strict validation: must be a real Facebook or Instagram URL
                      const isValidUrl =
                        typeof url === "string" &&
                        (url.startsWith("https://facebook.com") ||
                         url.startsWith("https://www.facebook.com") ||
                         url.startsWith("https://instagram.com") ||
                         url.startsWith("https://www.instagram.com"));

                      if (!isValidUrl) {
                        console.error(`[QueueTable] Job ${job.id}: INVALID publishedUrl — blocked. Value:`, JSON.stringify(url));
                        return (
                          <span className="text-[10px]" style={{ color: "#f87171" }}>
                            URL לא תקין
                          </span>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (!url || !url.startsWith("https://")) {
                              console.error("[QueueTable] Invalid publishedUrl blocked at click:", url);
                              return;
                            }
                            console.log("[QueueTable] Opening external URL:", url);
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex items-center gap-1 text-xs cursor-pointer bg-transparent border-none"
                          style={{ color: "#60a5fa" }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          צפה בפוסט
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open && !isPublishing) setConfirmId(null);
        }}
        title={
          confirmId && jobs.find((j) => j.id === confirmId)?.draft.format === "CAROUSEL"
            ? "פרסום קרוסלה"
            : "פרסום פוסט"
        }
        description={
          confirmId && jobs.find((j) => j.id === confirmId)?.draft.format === "CAROUSEL"
            ? "המערכת תייצר תמונות לכל סלייד ותפרסם כקרוסלת תמונות בפייסבוק. להמשיך?"
            : "לפרסם פוסט זה לרשתות החברתיות כעת?"
        }
        confirmLabel="פרסם עכשיו"
        cancelLabel="ביטול"
        onConfirm={handleConfirm}
        isLoading={isPublishing}
      />
    </>
  );
}
