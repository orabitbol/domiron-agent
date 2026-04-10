"use client";

/**
 * CAROUSEL preview — horizontal multi-slide with prev/next navigation.
 *
 * Premium upgrade: angle-aware theming, cinematic atmospheric layers,
 * emotional arc labels with glow, stronger slide transitions, and
 * premium navigation controls.
 */

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DraftFull, CarouselSlide } from "@/hooks/use-drafts";
import {
  type ContentAngle,
  PreviewFrame,
  GradientOverlay,
  Atmosphere,
  HookText,
  CtaBadge,
  FormatBadge,
  SlideIndicator,
  ArcLabel,
  AccentLine,
  NavButton,
  colors,
  getAngleTheme,
} from "./preview-primitives";

interface CarouselPreviewProps {
  draft: DraftFull;
  angle?: ContentAngle;
}

const ARC_LABELS = ["איום", "כאב", "הסלמה", "הבנה", "פעולה"] as const;

function getArcLabel(index: number, total: number): string {
  if (total <= ARC_LABELS.length) {
    return ARC_LABELS[index] ?? `סלייד ${index + 1}`;
  }
  if (index === 0) return "איום";
  if (index === total - 1) return "פעולה";
  return `סלייד ${index + 1}`;
}

interface SlideData {
  text: string;
  isArc: boolean;
}

function buildSlides(draft: DraftFull): SlideData[] {
  const raw = draft.carouselSlides as CarouselSlide[] | null;
  if (raw && raw.length > 0) {
    return raw.map((s) => ({ text: s.text, isArc: true }));
  }

  const slides: SlideData[] = [];
  if (draft.hook) slides.push({ text: draft.hook, isArc: false });

  const caption = draft.facebookCaption || draft.instagramCaption || "";
  const paragraphs = caption.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paragraphs) slides.push({ text: p, isArc: false });

  if (draft.cta) slides.push({ text: draft.cta, isArc: false });
  if (slides.length === 0) slides.push({ text: "אין תוכן לתצוגה", isArc: false });

  return slides;
}

export function CarouselPreview({ draft, angle = "default" }: CarouselPreviewProps) {
  const slides = useMemo(() => buildSlides(draft), [draft]);
  const [current, setCurrent] = useState(0);
  const theme = getAngleTheme(angle);

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(slides.length - 1, c + 1));

  const slide = slides[current];
  const isFirst = current === 0;
  const isLast = current === slides.length - 1;

  const label = slide.isArc
    ? getArcLabel(current, slides.length)
    : isFirst ? "איום" : isLast ? "פעולה" : `סלייד ${current + 1}`;

  return (
    <div className="space-y-3" style={{ maxWidth: 420, width: "100%" }}>
      <PreviewFrame aspect="1/1" maxWidth={420} angle={angle} visualDirection={draft.visualDirection}>
        <FormatBadge label={`CAROUSEL ${current + 1}/${slides.length}`} angle={angle} />
        <Atmosphere angle={angle} />
        <GradientOverlay position="full" angle={angle} />

        {/* Top edge glow */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)`,
          }}
        />

        {/* Slide content */}
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-8 gap-4 z-[1]">
          <ArcLabel angle={angle}>{label}</ArcLabel>
          <AccentLine angle={angle} />

          <HookText size={isFirst ? "lg" : "md"} glowColor={theme.glow}>{slide.text}</HookText>

          {isLast && slide.isArc && draft.cta && (
            <div className="pt-1">
              <CtaBadge angle={angle}>{draft.cta}</CtaBadge>
            </div>
          )}
        </div>

        {/* Navigation */}
        {slides.length > 1 && (
          <>
            {current > 0 && (
              <NavButton direction="prev" onClick={prev} angle={angle}>
                <ChevronRight className="w-4 h-4" />
              </NavButton>
            )}
            {current < slides.length - 1 && (
              <NavButton direction="next" onClick={next} angle={angle}>
                <ChevronLeft className="w-4 h-4" />
              </NavButton>
            )}
          </>
        )}

        {/* Bottom progress bar */}
        {slides.length > 1 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] z-10 pointer-events-none"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{
                width: `${((current + 1) / slides.length) * 100}%`,
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}80)`,
                boxShadow: `0 0 12px ${theme.glow}`,
              }}
            />
          </div>
        )}
      </PreviewFrame>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <SlideIndicator total={slides.length} current={current} angle={angle} />
      )}
    </div>
  );
}
