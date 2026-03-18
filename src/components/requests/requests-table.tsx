"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RequestStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useDeleteRequest, type RequestWithDraft } from "@/hooks/use-requests";
import { RequestStatus } from "@/types";

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

interface RequestsTableProps {
  requests: RequestWithDraft[];
}

export function RequestsTable({ requests }: RequestsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { mutateAsync: deleteRequest, isPending: isDeleting } = useDeleteRequest();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRequest(deleteId);
      toast.success("הבקשה נמחקה בהצלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקת הבקשה");
    } finally {
      setDeleteId(null);
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
              <th style={headerStyle}>פלטפורמה</th>
              <th style={headerStyle}>סוג תוכן</th>
              <th style={headerStyle}>יום בסדרה</th>
              <th style={headerStyle}>סטטוס</th>
              <th style={headerStyle}>טיוטה</th>
              <th style={headerStyle}>תאריך יצירה</th>
              <th style={{ ...headerStyle, textAlign: "center" as const }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr
                key={req.id}
                style={{ backgroundColor: "#13151F" }}
                className="transition-colors hover:bg-white/[0.02]"
              >
                <td style={cellStyle}>
                  <span className="font-medium">{req.title}</span>
                </td>
                <td style={{ ...cellStyle, color: "#94A3B8" }}>
                  {platformLabels[req.platform] ?? req.platform}
                </td>
                <td style={{ ...cellStyle, color: "#94A3B8" }}>
                  {contentTypeLabels[req.contentType] ?? req.contentType}
                </td>
                <td style={{ ...cellStyle, color: "#94A3B8" }}>
                  {req.sequenceDay ?? "—"}
                </td>
                <td style={cellStyle}>
                  <RequestStatusBadge status={req.status as RequestStatus} />
                </td>
                <td style={cellStyle}>
                  {req.draft ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                      style={{ backgroundColor: "#1e3a5f", color: "#60a5fa" }}
                    >
                      <FileText className="w-3 h-3" />
                      יש טיוטה
                    </span>
                  ) : (
                    <span style={{ color: "#475569", fontSize: "13px" }}>—</span>
                  )}
                </td>
                <td style={{ ...cellStyle, color: "#64748B", fontSize: "13px" }}>
                  {format(new Date(req.createdAt), "dd/MM/yyyy")}
                </td>
                <td style={{ ...cellStyle, textAlign: "center" as const }}>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteId(req.id)}
                    disabled={req.status !== "NEW"}
                    title={req.status !== "NEW" ? "ניתן למחוק רק בקשות בסטטוס חדש" : "מחק בקשה"}
                    style={{ color: "#64748B" }}
                    className="hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="מחיקת בקשה"
        description="האם אתה בטוח שברצונך למחוק בקשה זו? פעולה זו אינה ניתנת לביטול."
        confirmLabel="מחק"
        cancelLabel="ביטול"
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isDeleting}
      />
    </>
  );
}
