"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DraftStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RevisionNotesInput } from "@/components/drafts/revision-notes-input";
import type { DraftFull } from "@/hooks/use-drafts";
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

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "#64748B" }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: "#F1F5F9" }}>
        {value}
      </span>
    </div>
  );
}

type ActionMode = "idle" | "revision" | "reject";

interface DraftMetaPanelProps {
  draft: DraftFull;
  isApproving: boolean;
  isRejecting: boolean;
  isRequestingRevision: boolean;
  onApprove: () => void;
  onReject: (note?: string) => void;
  onRequestRevision: (note: string) => void;
}

const ACTIONABLE = [DraftStatus.PENDING_REVIEW, DraftStatus.EDITED];

export function DraftMetaPanel({
  draft,
  isApproving,
  isRejecting,
  isRequestingRevision,
  onApprove,
  onReject,
  onRequestRevision,
}: DraftMetaPanelProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("idle");

  const isActionable = ACTIONABLE.includes(draft.status);

  const handleApproveConfirm = () => {
    onApprove();
    setApproveOpen(false);
  };

  return (
    <>
      <div
        className="rounded-xl border p-5 space-y-5 sticky top-6"
        style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
      >
        {/* Status */}
        <div>
          <p className="text-xs mb-1.5" style={{ color: "#64748B" }}>
            סטטוס
          </p>
          <DraftStatusBadge status={draft.status} />
        </div>

        {/* Meta fields */}
        <div className="space-y-4">
          <MetaRow
            label="פלטפורמה"
            value={platformLabels[draft.request.platform] ?? draft.request.platform}
          />
          <MetaRow
            label="סוג תוכן"
            value={contentTypeLabels[draft.request.contentType] ?? draft.request.contentType}
          />
          <MetaRow label="פורמט" value={formatLabels[draft.format] ?? draft.format} />
          {draft.request.sequenceDay != null && (
            <MetaRow label="יום בסדרה" value={`יום ${draft.request.sequenceDay}`} />
          )}
          {draft.request.contentPillar && (
            <MetaRow label="עמוד תוכן" value={draft.request.contentPillar} />
          )}
          <MetaRow label="גרסה" value={`גרסה ${draft.version}`} />
        </div>

        {/* Admin notes */}
        {draft.adminNotes && (
          <div
            className="rounded-lg p-3 border"
            style={{ backgroundColor: "#0F1117", borderColor: "#451a03" }}
          >
            <p className="text-xs mb-1" style={{ color: "#fb923c" }}>
              הערות מנהל
            </p>
            <p className="text-sm" style={{ color: "#F1F5F9" }}>
              {draft.adminNotes}
            </p>
          </div>
        )}

        {/* Actions */}
        {isActionable && (
          <div className="space-y-2 border-t pt-4" style={{ borderColor: "#2D3148" }}>
            {actionMode === "revision" ? (
              <RevisionNotesInput
                onSubmit={(note) => {
                  onRequestRevision(note);
                  setActionMode("idle");
                }}
                onCancel={() => setActionMode("idle")}
                isLoading={isRequestingRevision}
                required
                submitLabel="בקש תיקון"
                placeholder="תאר את התיקון הנדרש (לפחות 10 תווים)..."
              />
            ) : actionMode === "reject" ? (
              <RevisionNotesInput
                onSubmit={(note) => {
                  onReject(note || undefined);
                  setActionMode("idle");
                }}
                onCancel={() => setActionMode("idle")}
                isLoading={isRejecting}
                required={false}
                submitLabel="דחה טיוטה"
                placeholder="סיבת הדחייה (אופציונלי)..."
              />
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setApproveOpen(true)}
                  className="w-full font-medium"
                  style={{ backgroundColor: "#14532d", color: "#4ade80" }}
                >
                  אשר טיוטה
                </Button>
                <Button
                  onClick={() => setActionMode("revision")}
                  className="w-full font-medium"
                  style={{ backgroundColor: "#451a03", color: "#fb923c" }}
                >
                  בקש תיקון
                </Button>
                <Button
                  onClick={() => setActionMode("reject")}
                  className="w-full font-medium"
                  style={{ backgroundColor: "#450a0a", color: "#f87171" }}
                >
                  דחה טיוטה
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
        onConfirm={handleApproveConfirm}
        isLoading={isApproving}
      />
    </>
  );
}
