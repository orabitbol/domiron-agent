"use client";

/**
 * STORY preview — vertical 9:16 frames with navigation.
 *
 * Premium upgrade: thicker glowing progress bars, immersive full-screen
 * atmosphere, stronger frame presence, cinematic logo frame, angle-aware
 * theming throughout.
 */

import { useState, useMemo } from "react";
import type { DraftFull, StoryFrame } from "@/hooks/use-drafts";
import {
  type ContentAngle,
  PreviewFrame,
  GradientOverlay,
  Atmosphere,
  HookText,
  CtaBadge,
  FormatBadge,
  AccentLine,
  colors,
  getAngleTheme,
} from "./preview-primitives";

interface StoryPreviewProps {
  draft: DraftFull;
  angle?: ContentAngle;
}

export function StoryPreview({ draft, angle = "default" }: StoryPreviewProps) {
  const theme = getAngleTheme(angle);

  const frames: StoryFrame[] = useMemo(() => {
    const raw = (draft.storyFrames ?? []) as StoryFrame[];
    if (raw.length > 0) return raw.slice().sort((a, b) => a.order - b.order);

    const synth: StoryFrame[] = [];
    if (draft.hook) synth.push({ order: 1, text: draft.hook });
    const caption = draft.facebookCaption || draft.instagramCaption || "";
    const paragraphs = caption.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach(() => synth.push({ order: synth.length + 1, text: paragraphs[synth.length - (draft.hook ? 1 : 0)] || "" }));
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
      setCurrent((c) => Math.max(0, c - 1));
    } else {
      setCurrent((c) => Math.min(frames.length - 1, c + 1));
    }
  };

  return (
    <div className="space-y-3" style={{ maxWidth: 280, width: "100%" }}>
      <PreviewFrame aspect="9/16" maxWidth={280} angle={angle}>
        <FormatBadge label="STORY" angle={angle} />
        <Atmosphere angle={angle} />
        <GradientOverlay position="full" angle={angle} />

        {/* Progress bars — thicker, glowing */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {frames.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[3px] rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: i < current ? "100%" : i === current ? "100%" : "0%",
                  background: i <= current
                    ? `linear-gradient(90deg, ${theme.accent}, ${theme.accent}cc)`
                    : "transparent",
                  boxShadow: i <= current ? `0 0 8px ${theme.glow}` : "none",
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
        <div className="absolute inset-0 flex flex-col justify-center items-center p-7 gap-4 z-[1]">
          {frame.isLogoFrame ? (
            <div className="flex flex-col items-center gap-5 text-center">
              {/* Premium logo mark */}
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black"
                  style={{
                    background: `linear-gradient(135deg, ${colors.gold} 0%, #B8912E 50%, ${colors.gold} 100%)`,
                    color: colors.bg,
                    boxShadow: `
                      0 0 40px rgba(212,168,67,0.5),
                      0 0 80px rgba(212,168,67,0.2),
                      inset 0 1px 0 rgba(255,255,255,0.2)
                    `,
                  }}
                >
                  D
                </div>
                {/* Glow ring behind logo */}
                <div
                  className="absolute -inset-3 rounded-3xl pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, rgba(212,168,67,0.15) 0%, transparent 70%)`,
                  }}
                />
              </div>
              <HookText size="sm" glowColor={theme.glow}>{frame.text}</HookText>
              {draft.cta && <CtaBadge angle={angle}>{draft.cta}</CtaBadge>}
            </div>
          ) : (
            <div className="text-center space-y-4">
              <AccentLine angle={angle} />
              <HookText
                size={current === 0 ? "lg" : "md"}
                glowColor={theme.glow}
              >
                {frame.text}
              </HookText>
            </div>
          )}
        </div>

        {/* Frame counter with glow */}
        <div
          className="absolute bottom-4 left-0 right-0 flex justify-center z-[1]"
        >
          <span
            className="text-[9px] font-bold tracking-wider px-2.5 py-0.5 rounded-full"
            style={{
              color: colors.muted,
              backgroundColor: "rgba(6,8,16,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            {current + 1} / {frames.length}
          </span>
        </div>

        {/* Bottom edge glow */}
        <div
          className="absolute bottom-0 left-[15%] right-[15%] h-[1px] pointer-events-none z-[1]"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.accent}30, transparent)`,
          }}
        />
      </PreviewFrame>
    </div>
  );
}
