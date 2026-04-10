"use client";

/**
 * REEL preview — storyboard-style scene sequence.
 *
 * Unlike carousel (which is a swipeable preview), reels show a vertical
 * storyboard of all scenes at once, since a reel is a single video made
 * of sequential scenes. Each scene is a numbered block.
 */

import { useMemo } from "react";
import type { DraftFull } from "@/hooks/use-drafts";
import {
  PreviewFrame,
  GradientOverlay,
  HookText,
  CaptionText,
  CtaBadge,
  FormatBadge,
  SceneNumber,
  WarGlow,
  GoldAccentLine,
  colors,
} from "./preview-primitives";

interface ReelPreviewProps {
  draft: DraftFull;
}

interface Scene {
  label: string;
  text: string;
  isCta?: boolean;
}

function buildScenes(draft: DraftFull): Scene[] {
  const scenes: Scene[] = [];

  if (draft.hook) {
    scenes.push({ label: "פתיחה", text: draft.hook });
  }

  const caption = draft.facebookCaption || draft.instagramCaption || "";
  const paragraphs = caption
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  paragraphs.forEach((p, i) => {
    scenes.push({ label: `סצנה ${i + 1}`, text: p });
  });

  if (draft.cta) {
    scenes.push({ label: "CTA", text: draft.cta, isCta: true });
  }

  if (scenes.length === 0) {
    scenes.push({ label: "סצנה", text: "אין תוכן לתצוגה" });
  }

  return scenes;
}

export function ReelPreview({ draft }: ReelPreviewProps) {
  const scenes = useMemo(() => buildScenes(draft), [draft]);

  return (
    <div className="space-y-3" style={{ maxWidth: 420, width: "100%" }}>
      {/* Header card — 9:16 aspect mini-preview */}
      <PreviewFrame aspect="9/16" maxWidth={280}>
        <FormatBadge label="REEL" />
        <WarGlow />
        <GradientOverlay position="full" />

        <div className="absolute inset-0 flex flex-col justify-center items-center p-6 gap-4 z-[1]">
          <GoldAccentLine />
          {draft.hook && <HookText size="md">{draft.hook}</HookText>}
          {draft.cta && (
            <div className="pt-2">
              <CtaBadge>{draft.cta}</CtaBadge>
            </div>
          )}

          {/* Visual direction hint */}
          {draft.visualDirection && (
            <div
              className="absolute bottom-4 left-4 right-4 text-[10px] leading-tight rounded-lg px-2 py-1.5 text-center"
              style={{
                backgroundColor: "rgba(45,49,72,0.6)",
                color: colors.muted,
                backdropFilter: "blur(4px)",
              }}
            >
              {draft.visualDirection}
            </div>
          )}
        </div>
      </PreviewFrame>

      {/* Storyboard — all scenes laid out vertically */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <div
          className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            color: colors.gold,
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.elevated,
          }}
        >
          STORYBOARD — {scenes.length} SCENES
        </div>

        <div className="divide-y" style={{ borderColor: colors.border }}>
          {scenes.map((scene, i) => (
            <div
              key={i}
              dir="rtl"
              className="flex gap-3 p-4 items-start"
              style={{
                borderColor: colors.border,
              }}
            >
              <SceneNumber number={i + 1} />
              <div className="flex-1 space-y-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: colors.muted }}
                >
                  {scene.label}
                </span>
                {scene.isCta ? (
                  <div className="pt-1">
                    <CtaBadge>{scene.text}</CtaBadge>
                  </div>
                ) : (
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: colors.text }}
                  >
                    {scene.text}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
