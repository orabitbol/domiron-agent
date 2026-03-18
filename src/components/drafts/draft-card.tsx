"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DraftStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RevisionNotesInput } from "@/components/drafts/revision-notes-input";
import {
  useApproveDraft,
  useRejectDraft,
  useRequestRevision,
  type DraftForList,
} from "@/hooks/use-drafts";
import { DraftStatus } from "@/types";

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

const formatLabels: Record<string, string> = {
  STATIC: "סטטי",
  CAROUSEL: "קרוסלה",
  REEL: "ריל",
  STORY: "סטורי",
};

const ACTIONABLE = [DraftStatus.PENDING_REVIEW, DraftStatus.EDITED];

type ActionMode = "idle" | "revision" | "reject";

interface DraftCardProps {
  draft: DraftForList;
}

export function DraftCard({ draft }: DraftCardProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("idle");

  const { mutateAsync: approve, isPending: isApproving } = useApproveDraft();
  const { mutateAsync: reject, isPending: isRejecting } = useRejectDraft();
  const { mutateAsync: requestRevision, isPending: isRequestingRevision } = useRequestRevision();

  const isActionable = ACTIONABLE.includes(draft.status);

  const handleApprove = async () => {
    try {
      await approve(draft.id);
      toast.success("הטיוטה אושרה בהצלחה");
      setApproveOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה באישור הטיוטה");
    }
  };

  const handleReject = async (note: string) => {
    try {
      await reject({ id: draft.id, note: note || undefined });
      toast.success("הטיוטה נדחתה");
      setActionMode("idle");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בדחיית הטיוטה");
    }
  };

  const handleRevision = async (note: string) => {
    try {
      await requestRevision({ id: draft.id, note });
      toast.success("בקשת תיקון נשלחה");
      setActionMode("idle");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בבקשת תיקון");
    }
  };

  return (
    <>
      <div
        className="rounded-xl border flex flex-col overflow-hidden"
        style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
      >
        {/* Clickable card body */}
        <Link href={`/drafts/${draft.id}`} className="flex-1 block p-4 hover:bg-white/[0.02] transition-colors">
          {/* Title */}
          <p className="font-semibold text-sm mb-1 line-clamp-1" style={{ color: "#F1F5F9" }}>
            {draft.request.title}
          </p>

          {/* Hook preview */}
          {draft.hook && (
            <p className="text-xs mb-3 line-clamp-2" style={{ color: "#94A3B8" }}>
              {draft.hook}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#1e293b", color: "#94A3B8" }}
            >
              {platformLabels[draft.request.platform] ?? draft.request.platform}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#1e293b", color: "#94A3B8" }}
            >
              {contentTypeLabels[draft.request.contentType] ?? draft.request.contentType}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#1e293b", color: "#94A3B8" }}
            >
              {formatLabels[draft.format] ?? draft.format}
            </span>
            {draft.request.sequenceDay != null && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#1e293b", color: "#94A3B8" }}
              >
                יום {draft.request.sequenceDay}
              </span>
            )}
          </div>

          {/* Status + version */}
          <div className="flex items-center justify-between">
            <DraftStatusBadge status={draft.status} />
            <span className="text-xs" style={{ color: "#475569" }}>
              גרסה {draft.version}
            </span>
          </div>
        </Link>

        {/* Action area */}
        {isActionable && (
          <div
            className="border-t px-4 py-3"
            style={{ borderColor: "#2D3148" }}
          >
            {actionMode === "revision" ? (
              <RevisionNotesInput
                onSubmit={handleRevision}
                onCancel={() => setActionMode("idle")}
                isLoading={isRequestingRevision}
                required
                submitLabel="בקש תיקון"
                placeholder="תאר את התיקון הנדרש (לפחות 10 תווים)..."
              />
            ) : actionMode === "reject" ? (
              <RevisionNotesInput
                onSubmit={handleReject}
                onCancel={() => setActionMode("idle")}
                isLoading={isRejecting}
                required={false}
                submitLabel="דחה טיוטה"
                placeholder="סיבת הדחייה (אופציונלי)..."
              />
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setApproveOpen(true)}
                  style={{ backgroundColor: "#14532d", color: "#4ade80" }}
                  className="flex-1 text-xs"
                >
                  אשר
                </Button>
                <Button
                  size="sm"
                  onClick={() => setActionMode("revision")}
                  style={{ backgroundColor: "#451a03", color: "#fb923c" }}
                  className="flex-1 text-xs"
                >
                  בקש תיקון
                </Button>
                <Button
                  size="sm"
                  onClick={() => setActionMode("reject")}
                  style={{ backgroundColor: "#450a0a", color: "#f87171" }}
                  className="flex-1 text-xs"
                >
                  דחה
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="אישור טיוטה"
        description="האם אתה בטוח שברצונך לאשר טיוטה זו? הטיוטה תועבר לתור הפרסום."
        confirmLabel="אשר טיוטה"
        cancelLabel="ביטול"
        onConfirm={handleApprove}
        isLoading={isApproving}
      />
    </>
  );
}
