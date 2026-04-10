"use client";

/**
 * POST / STATIC preview — single 1:1 card.
 *
 * Layout: full-bleed dark frame with radial glow, hook as hero text,
 * truncated caption beneath, CTA badge at the bottom.
 */

import type { DraftFull } from "@/hooks/use-drafts";
import {
  PreviewFrame,
  GradientOverlay,
  HookText,
  CaptionText,
  CtaBadge,
  FormatBadge,
  WarGlow,
  GoldAccentLine,
  colors,
} from "./preview-primitives";

interface PostPreviewProps {
  draft: DraftFull;
}

export function PostPreview({ draft }: PostPreviewProps) {
  const caption = draft.facebookCaption || draft.instagramCaption;

  return (
    <PreviewFrame aspect="1/1">
      <FormatBadge label="POST" />
      <WarGlow />
      <GradientOverlay position="full" />

      <div className="absolute inset-0 flex flex-col justify-end p-6 gap-4 z-[1]">
        {/* Visual direction hint */}
        {draft.visualDirection && (
          <div
            className="absolute top-4 right-4 max-w-[60%] text-[10px] leading-tight rounded-lg px-2 py-1.5"
            style={{
              backgroundColor: "rgba(45,49,72,0.6)",
              color: colors.muted,
              backdropFilter: "blur(4px)",
            }}
          >
            {draft.visualDirection}
          </div>
        )}

        <div className="space-y-3">
          <GoldAccentLine />

          {draft.hook && <HookText>{draft.hook}</HookText>}

          {caption && <CaptionText maxLines={4}>{caption}</CaptionText>}

          {draft.cta && (
            <div className="pt-2">
              <CtaBadge>{draft.cta}</CtaBadge>
            </div>
          )}
        </div>
      </div>
    </PreviewFrame>
  );
}
