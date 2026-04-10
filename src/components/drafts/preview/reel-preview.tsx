"use client";

/**
 * REEL preview — storyboard-style scene sequence.
 *
 * Premium upgrade: cinematic hero card, timeline connector between scenes,
 * stronger scene differentiation (opening/mid/CTA), angle-aware theming,
 * atmospheric storyboard with depth.
 */

import { useMemo } from "react";
import type { DraftFull } from "@/hooks/use-drafts";
import {
  type ContentAngle,
  PreviewFrame,
  GradientOverlay,
  Atmosphere,
  HookText,
  CtaBadge,
  FormatBadge,
  SceneNumber,
  AccentLine,
  colors,
  getAngleTheme,
} from "./preview-primitives";

interface ReelPreviewProps {
  draft: DraftFull;
  angle?: ContentAngle;
}

interface Scene {
  label: string;
  text: string;
  isCta?: boolean;
  isHook?: boolean;
}

function buildScenes(draft: DraftFull): Scene[] {
  const scenes: Scene[] = [];

  if (draft.hook) {
    scenes.push({ label: "פתיחה", text: draft.hook, isHook: true });
  }

  const caption = draft.facebookCaption || draft.instagramCaption || "";
  const paragraphs = caption.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
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

export function ReelPreview({ draft, angle = "default" }: ReelPreviewProps) {
  const scenes = useMemo(() => buildScenes(draft), [draft]);
  const theme = getAngleTheme(angle);

  return (
    <div className="space-y-3" style={{ maxWidth: 420, width: "100%" }}>
      {/* Hero card — 9:16 mini-preview */}
      <PreviewFrame aspect="9/16" maxWidth={280} angle={angle}>
        <FormatBadge label="REEL" angle={angle} />
        <Atmosphere angle={angle} />
        <GradientOverlay position="full" angle={angle} />

        {/* Top edge glow */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)`,
          }}
        />

        <div className="absolute inset-0 flex flex-col justify-center items-center p-7 gap-5 z-[1]">
          <AccentLine angle={angle} />
          {draft.hook && (
            <HookText size="lg" glowColor={theme.glow}>
              {draft.hook}
            </HookText>
          )}
          {draft.cta && (
            <div className="pt-1">
              <CtaBadge angle={angle}>{draft.cta}</CtaBadge>
            </div>
          )}

          {/* Visual direction hint */}
          {draft.visualDirection && (
            <div
              className="absolute bottom-5 left-5 right-5 text-[9px] leading-tight rounded-lg px-3 py-2 text-center font-medium"
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
        </div>

        {/* Bottom edge glow */}
        <div
          className="absolute bottom-0 left-[15%] right-[15%] h-[1px] pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.accent}30, transparent)`,
          }}
        />
      </PreviewFrame>

      {/* Storyboard */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          boxShadow: `0 0 30px rgba(6,8,16,0.5)`,
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{
            borderBottom: `1px solid ${colors.border}`,
            background: `linear-gradient(180deg, ${colors.elevated} 0%, ${colors.surface} 100%)`,
          }}
        >
          <span
            className="text-[9px] font-black uppercase tracking-[0.15em]"
            style={{ color: theme.accent }}
          >
            STORYBOARD
          </span>
          <span
            className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
            style={{
              color: colors.muted,
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            {scenes.length} SCENES
          </span>
        </div>

        {/* Scenes with timeline */}
        <div className="relative">
          {/* Timeline connector line */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              right: 23,
              width: 2,
              background: `linear-gradient(180deg, ${theme.accent}30, ${colors.border}40, ${colors.gold}30)`,
            }}
          />

          {scenes.map((scene, i) => {
            const isFirst = i === 0;
            const isLast = i === scenes.length - 1;

            return (
              <div
                key={i}
                dir="rtl"
                className="relative flex gap-4 px-4 py-4 items-start transition-colors"
                style={{
                  borderBottom: isLast ? "none" : `1px solid ${colors.border}`,
                  backgroundColor: isFirst
                    ? `${theme.accent}08`
                    : isLast
                      ? "rgba(212,168,67,0.04)"
                      : "transparent",
                }}
              >
                {/* Scene number (positioned over timeline) */}
                <SceneNumber
                  number={i + 1}
                  angle={angle}
                  isFirst={isFirst}
                  isLast={isLast && scene.isCta}
                />

                <div className="flex-1 space-y-1.5 min-w-0">
                  <span
                    className="text-[9px] font-black uppercase tracking-[0.12em]"
                    style={{
                      color: isFirst ? theme.accent : isLast ? colors.gold : colors.muted,
                    }}
                  >
                    {scene.label}
                  </span>
                  {scene.isCta ? (
                    <div className="pt-1">
                      <CtaBadge angle={angle}>{scene.text}</CtaBadge>
                    </div>
                  ) : (
                    <p
                      className="text-[13px] leading-relaxed font-medium"
                      style={{
                        color: isFirst ? colors.text : colors.textSecondary,
                        textShadow: isFirst ? `0 0 20px ${theme.glow}` : "none",
                      }}
                    >
                      {scene.text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
