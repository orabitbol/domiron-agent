"use client";

/**
 * STORY preview — vertical 9:16 frames with navigation.
 *
 * Uses storyFrames from the draft. Each frame is rendered in a tall phone-like
 * container. Progress bar at top (Instagram-style). Tap left/right to navigate.
 */

import { useState, useMemo } from "react";
import type { DraftFull, StoryFrame } from "@/hooks/use-drafts";
import {
  PreviewFrame,
  GradientOverlay,
  HookText,
  CtaBadge,
  FormatBadge,
  WarGlow,
  GoldAccentLine,
  colors,
} from "./preview-primitives";

interface StoryPreviewProps {
  draft: DraftFull;
}

export function StoryPreview({ draft }: StoryPreviewProps) {
  const frames: StoryFrame[] = useMemo(() => {
    const raw = (draft.storyFrames ?? []) as StoryFrame[];
    if (raw.length > 0) return raw.slice().sort((a, b) => a.order - b.order);

    // Fallback: synthesize frames from hook + caption + CTA
    const synth: StoryFrame[] = [];
    if (draft.hook) synth.push({ order: 1, text: draft.hook });
    const caption = draft.facebookCaption || draft.instagramCaption || "";
    const paragraphs = caption
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    paragraphs.forEach((p, i) => synth.push({ order: synth.length + 1, text: p }));
    if (draft.cta) synth.push({ order: synth.length + 1, text: draft.cta, isLogoFrame: true });
    if (synth.length === 0) synth.push({ order: 1, text: "אין תוכן לתצוגה" });
    return synth;
  }, [draft]);

  const [current, setCurrent] = useState(0);
  const frame = frames[current];

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      // Tap left = previous (RTL: right side of screen = previous)
      setCurrent((c) => Math.max(0, c - 1));
    } else {
      setCurrent((c) => Math.min(frames.length - 1, c + 1));
    }
  };

  return (
    <div className="space-y-3" style={{ maxWidth: 280, width: "100%" }}>
      <PreviewFrame aspect="9/16" maxWidth={280}>
        <FormatBadge label="STORY" />
        <WarGlow />
        <GradientOverlay position="full" />

        {/* Progress bars (Instagram-style) */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {frames.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-0.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: i < current ? "100%" : i === current ? "100%" : "0%",
                  backgroundColor: i <= current ? colors.gold : "transparent",
                }}
              />
            </div>
          ))}
        </div>

        {/* Tap zones */}
        <div
          className="absolute inset-0 z-[2] cursor-pointer"
          onClick={handleTap}
        />

        {/* Frame content */}
        <div className="absolute inset-0 flex flex-col justify-center items-center p-6 gap-4 z-[1]">
          {frame.isLogoFrame ? (
            <div className="flex flex-col items-center gap-4 text-center">
              {/* Logo frame */}
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black"
                style={{
                  background: `linear-gradient(135deg, ${colors.gold} 0%, #B8912E 100%)`,
                  color: colors.bg,
                  boxShadow: `0 0 30px rgba(212,168,67,0.4)`,
                }}
              >
                D
              </div>
              <HookText size="sm">{frame.text}</HookText>
              {draft.cta && <CtaBadge>{draft.cta}</CtaBadge>}
            </div>
          ) : (
            <div className="text-center space-y-3">
              <GoldAccentLine />
              <HookText size={current === 0 ? "md" : "sm"}>{frame.text}</HookText>
            </div>
          )}

          {/* Frame counter */}
          <span
            className="absolute bottom-4 text-[10px] font-medium"
            style={{ color: colors.muted }}
          >
            {current + 1} / {frames.length}
          </span>
        </div>
      </PreviewFrame>
    </div>
  );
}
