"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishJobStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useMarkPublished,
  type PublishJobWithDraft,
  type MarkPublishedResponse,
} from "@/hooks/use-publish-jobs";

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
  const { mutateAsync: markPublished, isPending } = useMarkPublished();

  const handleConfirm = async () => {
    if (!confirmId) return;
    try {
      const response: MarkPublishedResponse = await markPublished(confirmId);
      if (response.publishStatus === "PUBLISHED") {
        toast.success("הפוסט פורסם בהצלחה");
      } else {
        // Meta API returned a failure — show the first specific reason.
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
      setConfirmId(null);
    }
  };

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
                      {/* Show failure reason inline under the badge */}
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
                        onClick={() => setConfirmId(job.id)}
                        style={{
                          backgroundColor: "#14532d",
                          color: "#4ade80",
                        }}
                        className="text-xs font-medium"
                      >
                        פרסם עכשיו
                      </Button>
                    )}
                    {/* Show external link if the post was successfully published */}
                    {job.status === "PUBLISHED" && job.publishedUrl && (
                      <a
                        href={job.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs"
                        style={{ color: "#60a5fa" }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        צפה בפוסט
                      </a>
                    )}
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
          if (!open) setConfirmId(null);
        }}
        title="פרסום פוסט"
        description="לפרסם פוסט זה לרשתות החברתיות כעת?"
        confirmLabel="פרסם עכשיו"
        cancelLabel="ביטול"
        onConfirm={handleConfirm}
        isLoading={isPending}
      />
    </>
  );
}
