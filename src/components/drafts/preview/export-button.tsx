"use client";

/**
 * Export button for draft preview assets.
 *
 * Shows progress during export. Integrates with useExportAssets hook.
 */

import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DraftFull } from "@/hooks/use-drafts";
import { type ContentAngle, colors } from "./preview-primitives";
import { useExportAssets } from "./use-export-assets";

interface ExportButtonProps {
  draft: DraftFull;
  angle: ContentAngle;
}

export function ExportButton({ draft, angle }: ExportButtonProps) {
  const { exportAssets, isExporting, progress, currentFile } = useExportAssets(draft, angle);

  const handleExport = async () => {
    try {
      await exportAssets();
      toast.success("הנכסים יוצאו בהצלחה");
    } catch {
      toast.error("שגיאה בייצוא הנכסים");
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
      style={{
        backgroundColor: isExporting ? colors.elevated : "rgba(212,168,67,0.12)",
        color: isExporting ? colors.muted : colors.gold,
        border: `1px solid ${isExporting ? colors.border : "rgba(212,168,67,0.25)"}`,
      }}
    >
      {isExporting ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{currentFile || `${Math.round(progress * 100)}%`}</span>
        </>
      ) : (
        <>
          <Download className="w-3 h-3" />
          <span>ייצוא</span>
        </>
      )}
    </button>
  );
}
