"use client";

/**
 * Format-aware preview router.
 *
 * Reads `draft.format` and renders the appropriate format-specific preview.
 * Auto-detects content angle from visual_direction and passes it down
 * so every renderer gets angle-aware theming automatically.
 *
 * Includes the Export button for downloading preview assets as PNG.
 */

import type { DraftFull } from "@/hooks/use-drafts";
import { ContentFormat } from "@/types";
import { PostPreview } from "./post-preview";
import { CarouselPreview } from "./carousel-preview";
import { StoryPreview } from "./story-preview";
import { ReelPreview } from "./reel-preview";
import { ExportButton } from "./export-button";
import { detectAngle, colors } from "./preview-primitives";

interface FormatPreviewProps {
  draft: DraftFull;
}

export function FormatPreview({ draft }: FormatPreviewProps) {
  const format = draft.format as ContentFormat;
  const angle = detectAngle(draft.visualDirection);

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        boxShadow: `0 0 40px rgba(6,8,16,0.6)`,
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[10px] font-black uppercase tracking-[0.15em]"
          style={{ color: colors.muted }}
        >
          תצוגה מקדימה
        </p>
        <ExportButton draft={draft} angle={angle} />
      </div>

      <div className="flex justify-center">
        {format === ContentFormat.CAROUSEL && <CarouselPreview draft={draft} angle={angle} />}
        {format === ContentFormat.STORY && <StoryPreview draft={draft} angle={angle} />}
        {format === ContentFormat.REEL && <ReelPreview draft={draft} angle={angle} />}
        {(format === ContentFormat.STATIC || !Object.values(ContentFormat).includes(format)) && (
          <PostPreview draft={draft} angle={angle} />
        )}
      </div>
    </div>
  );
}
