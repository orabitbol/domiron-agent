/**
 * Static export frame components for each format.
 *
 * These render a single frame/slide/scene at a fixed pixel size,
 * reusing all preview primitives for identical visual output.
 * No interactive elements (nav buttons, tap zones, indicators).
 *
 * Rendered into a hidden offscreen container by the export engine,
 * then captured with html-to-image at the target resolution.
 */

import type { DraftFull, CarouselSlide, StoryFrame } from "@/hooks/use-drafts";
import {
  type ContentAngle,
  PreviewFrame,
  GradientOverlay,
  Atmosphere,
  HookText,
  CaptionText,
  CtaBadge,
  ArcLabel,
  AccentLine,
  colors,
  getAngleTheme,
} from "./preview-primitives";

// ─── Shared constants ────────────────────────────────────────────────────────

/** Preview render sizes (html-to-image scales these up via pixelRatio) */
export const EXPORT_SIZES = {
  square: { width: 420, height: 420, targetWidth: 1080, targetHeight: 1080 },
  vertical: { width: 280, height: 498, targetWidth: 1080, targetHeight: 1920 },
} as const;

// ─── POST export frame ──────────────────────────────────────────────────────

interface PostExportFrameProps {
  draft: DraftFull;
  angle: ContentAngle;
}

export function PostExportFrame({ draft, angle }: PostExportFrameProps) {
  const caption = draft.facebookCaption || draft.instagramCaption;
  const theme = getAngleTheme(angle);

  return (
    <div style={{ width: EXPORT_SIZES.square.width, height: EXPORT_SIZES.square.height }}>
      <PreviewFrame aspect="1/1" maxWidth={EXPORT_SIZES.square.width} angle={angle} visualDirection={draft.visualDirection}>
        <Atmosphere angle={angle} />
        <GradientOverlay position="bottom" angle={angle} />

        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)` }}
        />

        <div className="absolute inset-0 flex flex-col justify-end p-7 gap-3 z-[1]">
          <div className="space-y-3">
            <AccentLine angle={angle} />
            {draft.hook && <HookText size="xl" glowColor={theme.glow}>{draft.hook}</HookText>}
            {caption && <CaptionText maxLines={3}>{caption}</CaptionText>}
            {draft.cta && (
              <div className="pt-1">
                <CtaBadge angle={angle}>{draft.cta}</CtaBadge>
              </div>
            )}
          </div>
        </div>
      </PreviewFrame>
    </div>
  );
}

// ─── CAROUSEL slide export frame ─────────────────────────────────────────────

const ARC_LABELS = ["איום", "כאב", "הסלמה", "הבנה", "פעולה"] as const;

function getArcLabel(index: number, total: number): string {
  if (total <= ARC_LABELS.length) return ARC_LABELS[index] ?? `סלייד ${index + 1}`;
  if (index === 0) return "איום";
  if (index === total - 1) return "פעולה";
  return `סלייד ${index + 1}`;
}

interface CarouselSlideExportFrameProps {
  draft: DraftFull;
  angle: ContentAngle;
  slideIndex: number;
  totalSlides: number;
  slide: { text: string; isArc: boolean };
}

export function CarouselSlideExportFrame({
  draft,
  angle,
  slideIndex,
  totalSlides,
  slide,
}: CarouselSlideExportFrameProps) {
  const theme = getAngleTheme(angle);
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;

  const label = slide.isArc
    ? getArcLabel(slideIndex, totalSlides)
    : isFirst ? "איום" : isLast ? "פעולה" : `סלייד ${slideIndex + 1}`;

  return (
    <div style={{ width: EXPORT_SIZES.square.width, height: EXPORT_SIZES.square.height }}>
      <PreviewFrame aspect="1/1" maxWidth={EXPORT_SIZES.square.width} angle={angle} visualDirection={draft.visualDirection}>
        <Atmosphere angle={angle} />
        <GradientOverlay position="full" angle={angle} />

        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)` }}
        />

        <div className="absolute inset-0 flex flex-col justify-center p-8 gap-4 z-[1]">
          <ArcLabel angle={angle}>{label}</ArcLabel>
          <AccentLine angle={angle} />

          {isLast && slide.isArc ? (
            <>
              <HookText size="md" glowColor={theme.glow}>{slide.text}</HookText>
              {draft.cta && (
                <div className="pt-1">
                  <CtaBadge angle={angle}>{draft.cta}</CtaBadge>
                </div>
              )}
            </>
          ) : isFirst ? (
            <HookText size="lg" glowColor={theme.glow}>{slide.text}</HookText>
          ) : (
            <CaptionText maxLines={5}>{slide.text}</CaptionText>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

// ─── STORY frame export ──────────────────────────────────────────────────────

interface StoryFrameExportFrameProps {
  draft: DraftFull;
  angle: ContentAngle;
  frame: StoryFrame;
  isFirst: boolean;
}

export function StoryFrameExportFrame({ draft, angle, frame, isFirst }: StoryFrameExportFrameProps) {
  const theme = getAngleTheme(angle);

  return (
    <div style={{ width: EXPORT_SIZES.vertical.width, height: EXPORT_SIZES.vertical.height }}>
      <PreviewFrame aspect="9/16" maxWidth={EXPORT_SIZES.vertical.width} angle={angle} visualDirection={draft.visualDirection}>
        <Atmosphere angle={angle} />
        <GradientOverlay position="full" angle={angle} />

        <div className="absolute inset-0 flex flex-col justify-center items-center p-7 gap-4 z-[1]">
          {frame.isLogoFrame ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black"
                  style={{
                    background: `linear-gradient(135deg, ${colors.gold} 0%, #B8912E 50%, ${colors.gold} 100%)`,
                    color: colors.bg,
                    boxShadow: `0 0 40px rgba(212,168,67,0.5), 0 0 80px rgba(212,168,67,0.2), inset 0 1px 0 rgba(255,255,255,0.2)`,
                  }}
                >
                  D
                </div>
                <div
                  className="absolute -inset-3 rounded-3xl pointer-events-none"
                  style={{ background: `radial-gradient(circle, rgba(212,168,67,0.15) 0%, transparent 70%)` }}
                />
              </div>
              <HookText size="sm" glowColor={theme.glow}>{frame.text}</HookText>
              {draft.cta && <CtaBadge angle={angle}>{draft.cta}</CtaBadge>}
            </div>
          ) : (
            <div className="text-center space-y-4">
              <AccentLine angle={angle} />
              <HookText size={isFirst ? "lg" : "md"} glowColor={theme.glow}>
                {frame.text}
              </HookText>
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

// ─── REEL scene export ───────────────────────────────────────────────────────

interface ReelSceneExportFrameProps {
  draft: DraftFull;
  angle: ContentAngle;
  scene: { label: string; text: string; isCta?: boolean; isHook?: boolean };
  isFirst: boolean;
}

export function ReelSceneExportFrame({ draft, angle, scene, isFirst }: ReelSceneExportFrameProps) {
  const theme = getAngleTheme(angle);

  return (
    <div style={{ width: EXPORT_SIZES.vertical.width, height: EXPORT_SIZES.vertical.height }}>
      <PreviewFrame aspect="9/16" maxWidth={EXPORT_SIZES.vertical.width} angle={angle} visualDirection={draft.visualDirection}>
        <Atmosphere angle={angle} />
        <GradientOverlay position="full" angle={angle} />

        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)` }}
        />

        <div className="absolute inset-0 flex flex-col justify-center items-center p-7 gap-5 z-[1]">
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ color: theme.accent, textShadow: `0 0 20px ${theme.glow}` }}
          >
            {scene.label}
          </span>
          <AccentLine angle={angle} />

          {scene.isCta ? (
            <>
              <HookText size="md" glowColor={theme.glow}>{scene.text}</HookText>
              <CtaBadge angle={angle}>{scene.text}</CtaBadge>
            </>
          ) : (
            <HookText size={isFirst ? "lg" : "md"} glowColor={theme.glow}>
              {scene.text}
            </HookText>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

// ─── Frame data builders (shared with preview components) ────────────────────

export function buildCarouselSlides(draft: DraftFull): { text: string; isArc: boolean }[] {
  const raw = draft.carouselSlides as CarouselSlide[] | null;
  if (raw && raw.length > 0) {
    return raw.map((s) => ({ text: s.text, isArc: true }));
  }
  const slides: { text: string; isArc: boolean }[] = [];
  if (draft.hook) slides.push({ text: draft.hook, isArc: false });
  const caption = draft.facebookCaption || draft.instagramCaption || "";
  const paragraphs = caption.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paragraphs) slides.push({ text: p, isArc: false });
  if (draft.cta) slides.push({ text: draft.cta, isArc: false });
  if (slides.length === 0) slides.push({ text: "אין תוכן", isArc: false });
  return slides;
}

export function buildStoryFrames(draft: DraftFull): StoryFrame[] {
  const raw = (draft.storyFrames ?? []) as StoryFrame[];
  if (raw.length > 0) return raw.slice().sort((a, b) => a.order - b.order);
  const synth: StoryFrame[] = [];
  if (draft.hook) synth.push({ order: 1, text: draft.hook });
  const caption = draft.facebookCaption || draft.instagramCaption || "";
  const paragraphs = caption.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  paragraphs.forEach((p) => synth.push({ order: synth.length + 1, text: p }));
  if (draft.cta) synth.push({ order: synth.length + 1, text: draft.cta, isLogoFrame: true });
  if (synth.length === 0) synth.push({ order: 1, text: "אין תוכן" });
  return synth;
}

export function buildReelScenes(draft: DraftFull): { label: string; text: string; isCta?: boolean; isHook?: boolean }[] {
  const scenes: { label: string; text: string; isCta?: boolean; isHook?: boolean }[] = [];
  if (draft.hook) scenes.push({ label: "פתיחה", text: draft.hook, isHook: true });
  const caption = draft.facebookCaption || draft.instagramCaption || "";
  const paragraphs = caption.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  paragraphs.forEach((p, i) => scenes.push({ label: `סצנה ${i + 1}`, text: p }));
  if (draft.cta) scenes.push({ label: "CTA", text: draft.cta, isCta: true });
  if (scenes.length === 0) scenes.push({ label: "סצנה", text: "אין תוכן" });
  return scenes;
}
