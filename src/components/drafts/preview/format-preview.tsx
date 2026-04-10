"use client";

/**
 * Format-aware preview router.
 *
 * Reads `draft.format` and renders the appropriate format-specific preview.
 * Drop this component anywhere a DraftFull is available — it handles
 * everything automatically.
 */

import type { DraftFull } from "@/hooks/use-drafts";
import { ContentFormat } from "@/types";
import { PostPreview } from "./post-preview";
import { CarouselPreview } from "./carousel-preview";
import { StoryPreview } from "./story-preview";
import { ReelPreview } from "./reel-preview";
import { colors } from "./preview-primitives";

interface FormatPreviewProps {
  draft: DraftFull;
}

export function FormatPreview({ draft }: FormatPreviewProps) {
  const format = draft.format as ContentFormat;

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
    >
      <p
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "#64748B" }}
      >
        תצוגה מקדימה
      </p>

      <div className="flex justify-center">
        {format === ContentFormat.CAROUSEL && <CarouselPreview draft={draft} />}
        {format === ContentFormat.STORY && <StoryPreview draft={draft} />}
        {format === ContentFormat.REEL && <ReelPreview draft={draft} />}
        {(format === ContentFormat.STATIC || !Object.values(ContentFormat).includes(format)) && (
          <PostPreview draft={draft} />
        )}
      </div>
    </div>
  );
}
