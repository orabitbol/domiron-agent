"use client";

/**
 * POST / STATIC preview — single 1:1 card.
 *
 * Premium layout: deep cinematic frame with angle-aware atmospheric layers,
 * hero hook text with glow, truncated caption, and gold CTA badge.
 */

import type { DraftFull } from "@/hooks/use-drafts";
import {
  type ContentAngle,
  PreviewFrame,
  GradientOverlay,
  Atmosphere,
  HookText,
  CaptionText,
  CtaBadge,
  FormatBadge,
  AccentLine,
  colors,
  getAngleTheme,
} from "./preview-primitives";

interface PostPreviewProps {
  draft: DraftFull;
  angle?: ContentAngle;
}

export function PostPreview({ draft, angle = "default" }: PostPreviewProps) {
  const caption = draft.facebookCaption || draft.instagramCaption;
  const theme = getAngleTheme(angle);

  return (
    <PreviewFrame aspect="1/1" angle={angle} visualDirection={draft.visualDirection}>
      <FormatBadge label="POST" angle={angle} />
      <Atmosphere angle={angle} />
      <GradientOverlay position="bottom" angle={angle} />

      {/* Top edge glow line */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-[1px] pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)`,
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-end p-7 gap-3 z-[1]">
        {/* Visual direction hint */}
        {draft.visualDirection && (
          <div
            className="absolute top-4 right-4 max-w-[55%] text-[9px] leading-tight rounded-lg px-2.5 py-1.5 font-medium"
            style={{
              backgroundColor: "rgba(6,8,16,0.6)",
              color: colors.muted,
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            {draft.visualDirection}
          </div>
        )}

        <div className="space-y-3">
          <AccentLine angle={angle} />

          {draft.hook && (
            <HookText size="xl" glowColor={theme.glow}>
              {draft.hook}
            </HookText>
          )}

          {caption && <CaptionText maxLines={3}>{caption}</CaptionText>}

          {draft.cta && (
            <div className="pt-1">
              <CtaBadge angle={angle}>{draft.cta}</CtaBadge>
            </div>
          )}
        </div>
      </div>
    </PreviewFrame>
  );
}
