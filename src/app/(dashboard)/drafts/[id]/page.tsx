"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { Skeleton } from "@/components/shared/loading-skeleton";
import { DraftContentPanel } from "@/components/drafts/draft-content-panel";
import { DraftMetaPanel } from "@/components/drafts/draft-meta-panel";
import { MediaUploadSection } from "@/components/drafts/media-upload-section";
import { FormatPreview } from "@/components/drafts/preview/format-preview";
import {
  useDraft,
  useApproveDraft,
  useRejectDraft,
  useRequestRevision,
} from "@/hooks/use-drafts";

interface PageProps {
  params: Promise<{ id: string }>;
}

function ReviewSkeleton() {
  return (
    <div className="flex gap-6 p-6">
      <div style={{ width: "35%" }}>
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
        >
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex-1 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-4 space-y-2"
            style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DraftReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [approved, setApproved] = useState(false);

  const { data: draft, isLoading, isError, refetch } = useDraft(id);
  const { mutateAsync: approveDraft, isPending: isApproving } = useApproveDraft();
  const { mutateAsync: rejectDraft, isPending: isRejecting } = useRejectDraft();
  const { mutateAsync: requestRevision, isPending: isRequestingRevision } = useRequestRevision();

  const handleApprove = async () => {
    try {
      await approveDraft(id);
      toast.success("הטיוטה אושרה בהצלחה");
      setApproved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה באישור הטיוטה");
    }
  };

  const handleReject = async (note?: string) => {
    try {
      await rejectDraft({ id, note });
      toast.success("הטיוטה נדחתה");
      router.push("/drafts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בדחיית הטיוטה");
    }
  };

  const handleRequestRevision = async (note: string) => {
    try {
      await requestRevision({ id, note });
      toast.success("בקשת תיקון נשלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בבקשת תיקון");
    }
  };

  return (
    <div>
      <Topbar title="סקירת טיוטה" showAction={false} />

      {isLoading && <ReviewSkeleton />}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 p-6">
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            שגיאה בטעינת הטיוטה
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            style={{ borderColor: "#2D3148", color: "#94A3B8", backgroundColor: "transparent" }}
          >
            נסה שוב
          </Button>
        </div>
      )}

      {!isLoading && !isError && draft && (
        <>
          {/* Approved banner */}
          {approved && (
            <div
              className="mx-6 mt-4 rounded-xl border p-4 flex items-center justify-between"
              style={{ backgroundColor: "#14532d33", borderColor: "#4ade80" }}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" style={{ color: "#4ade80" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>
                    הטיוטה אושרה בהצלחה
                  </p>
                  <p className="text-xs" style={{ color: "#86efac" }}>
                    הטיוטה נוספה לתור הפרסום
                  </p>
                </div>
              </div>
              <Link href="/queue">
                <Button
                  size="sm"
                  style={{ backgroundColor: "#14532d", color: "#4ade80" }}
                  className="gap-2"
                >
                  <ArrowLeft className="w-3 h-3" />
                  תור פרסום
                </Button>
              </Link>
            </div>
          )}

          {/* Request title breadcrumb */}
          <div className="px-6 pt-4">
            <p className="text-sm" style={{ color: "#64748B" }}>
              בקשה:{" "}
              <span style={{ color: "#94A3B8" }}>{draft.request.title}</span>
            </p>
          </div>

          {/* 65/35 layout — in RTL: meta on right (first), content on left (second) */}
          <div className="flex gap-6 p-6">
            <div style={{ width: "35%" }} className="space-y-4">
              <DraftMetaPanel
                draft={draft}
                isApproving={isApproving}
                isRejecting={isRejecting}
                isRequestingRevision={isRequestingRevision}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestRevision={handleRequestRevision}
              />
              <MediaUploadSection
                draftId={draft.id}
                currentMediaUrl={draft.mediaUrl}
              />
            </div>
            <div className="flex-1 space-y-4">
              <FormatPreview draft={draft} />
              <DraftContentPanel draft={draft} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
