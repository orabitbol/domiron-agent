/**
 * Shared design system for Domiron content format previews.
 *
 * Every preview renderer imports from here so all formats share the
 * same dark / war / strategic Domiron aesthetic without duplicating styles.
 */

import type { ReactNode } from "react";

// ─── Color tokens (match globals.css) ────────────────────────────────────────

export const colors = {
  /** Deep background */
  bg: "#0A0C12",
  /** Card / surface background */
  surface: "#12141D",
  /** Elevated surface */
  elevated: "#1A1D27",
  /** Border */
  border: "#2D3148",
  /** Primary gold accent */
  gold: "#D4A843",
  /** Danger / war red */
  red: "#C93545",
  /** Primary text */
  text: "#F1F5F9",
  /** Muted / secondary text */
  muted: "#8B95A8",
  /** CTA accent (purple, matches --primary) */
  primary: "#6B5CF6",
  /** Overlay start */
  overlayFrom: "rgba(10,12,18,0.92)",
  /** Overlay end */
  overlayTo: "rgba(10,12,18,0.45)",
} as const;

// ─── PreviewFrame ────────────────────────────────────────────────────────────
// The outermost container for every format preview. Sets aspect ratio, dark bg,
// radial vignette, and RTL direction.

interface PreviewFrameProps {
  /** CSS aspect-ratio value, e.g. "1/1", "9/16", "16/9" */
  aspect: string;
  children: ReactNode;
  className?: string;
  /** Optional max-width override (default 420px) */
  maxWidth?: number;
}

export function PreviewFrame({
  aspect,
  children,
  className = "",
  maxWidth = 420,
}: PreviewFrameProps) {
  return (
    <div
      dir="rtl"
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        aspectRatio: aspect,
        maxWidth,
        width: "100%",
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(212,168,67,0.08) 0%, transparent 60%),
          radial-gradient(ellipse at 70% 80%, rgba(201,53,69,0.06) 0%, transparent 60%),
          linear-gradient(180deg, ${colors.surface} 0%, ${colors.bg} 100%)
        `,
        border: `1px solid ${colors.border}`,
      }}
    >
      {children}
    </div>
  );
}

// ─── GradientOverlay ─────────────────────────────────────────────────────────
// Bottom-up gradient so text is legible over any background visual.

interface GradientOverlayProps {
  /** "bottom" | "top" | "full" */
  position?: "bottom" | "top" | "full";
}

export function GradientOverlay({ position = "bottom" }: GradientOverlayProps) {
  const gradients: Record<string, string> = {
    bottom: `linear-gradient(to top, ${colors.overlayFrom} 0%, ${colors.overlayTo} 50%, transparent 100%)`,
    top: `linear-gradient(to bottom, ${colors.overlayFrom} 0%, ${colors.overlayTo} 50%, transparent 100%)`,
    full: `linear-gradient(to bottom, ${colors.overlayFrom} 0%, rgba(10,12,18,0.7) 50%, ${colors.overlayFrom} 100%)`,
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ background: gradients[position] }}
    />
  );
}

// ─── Text hierarchy ──────────────────────────────────────────────────────────

interface HookTextProps {
  children: ReactNode;
  size?: "lg" | "md" | "sm";
}

export function HookText({ children, size = "lg" }: HookTextProps) {
  const sizeClasses = {
    lg: "text-2xl leading-tight",
    md: "text-xl leading-tight",
    sm: "text-lg leading-snug",
  };
  return (
    <h3
      className={`font-extrabold ${sizeClasses[size]}`}
      style={{
        color: colors.text,
        textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 0 40px rgba(212,168,67,0.15)",
      }}
    >
      {children}
    </h3>
  );
}

interface CaptionTextProps {
  children: ReactNode;
  maxLines?: number;
}

export function CaptionText({ children, maxLines }: CaptionTextProps) {
  return (
    <p
      className="text-sm leading-relaxed whitespace-pre-wrap"
      style={{
        color: colors.muted,
        ...(maxLines
          ? {
              display: "-webkit-box",
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }
          : {}),
      }}
    >
      {children}
    </p>
  );
}

interface CtaBadgeProps {
  children: ReactNode;
}

export function CtaBadge({ children }: CtaBadgeProps) {
  return (
    <span
      className="inline-block text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg"
      style={{
        background: `linear-gradient(135deg, ${colors.gold} 0%, #B8912E 100%)`,
        color: colors.bg,
        boxShadow: `0 0 20px rgba(212,168,67,0.3), 0 2px 8px rgba(0,0,0,0.4)`,
      }}
    >
      {children}
    </span>
  );
}

// ─── FormatBadge ─────────────────────────────────────────────────────────────
// Small label shown in corner to identify the format type.

interface FormatBadgeProps {
  label: string;
}

export function FormatBadge({ label }: FormatBadgeProps) {
  return (
    <span
      className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
      style={{
        backgroundColor: "rgba(45,49,72,0.8)",
        color: colors.muted,
        backdropFilter: "blur(8px)",
        zIndex: 10,
      }}
    >
      {label}
    </span>
  );
}

// ─── SlideIndicator ──────────────────────────────────────────────────────────
// Dot indicators for carousels / stories.

interface SlideIndicatorProps {
  total: number;
  current: number;
}

export function SlideIndicator({ total, current }: SlideIndicatorProps) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            backgroundColor: i === current ? colors.gold : "rgba(255,255,255,0.25)",
          }}
        />
      ))}
    </div>
  );
}

// ─── SceneNumber ─────────────────────────────────────────────────────────────
// Numbered badge for reel storyboard scenes.

interface SceneNumberProps {
  number: number;
}

export function SceneNumber({ number }: SceneNumberProps) {
  return (
    <span
      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
      style={{
        background: `linear-gradient(135deg, ${colors.red} 0%, #8B1A2A 100%)`,
        color: colors.text,
        boxShadow: "0 0 12px rgba(201,53,69,0.3)",
      }}
    >
      {number}
    </span>
  );
}

// ─── Decorative elements ─────────────────────────────────────────────────────

export function WarGlow() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, rgba(201,53,69,0.12) 0%, transparent 50%)",
      }}
    />
  );
}

export function GoldAccentLine() {
  return (
    <div
      className="w-12 h-0.5 rounded-full"
      style={{
        background: `linear-gradient(90deg, ${colors.gold}, transparent)`,
      }}
    />
  );
}
