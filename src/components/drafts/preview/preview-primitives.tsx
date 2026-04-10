/**
 * Shared design system for Domiron content format previews.
 *
 * Every preview renderer imports from here so all formats share the
 * same dark / war / strategic Domiron aesthetic without duplicating styles.
 *
 * v2 — Premium upgrade:
 *   - Angle-aware theming (auto-detects battle/economy/spy/tribe/competition)
 *   - Deeper cinematic multi-layer backgrounds
 *   - Stronger typography with glow
 *   - Atmospheric decorative layers (fog, edge vignette, particle energy)
 *   - Premium slide/scene indicators
 */

import type { ReactNode } from "react";

// ─── Color tokens ────────────────────────────────────────────────────────────

export const colors = {
  /** Deepest background */
  bg: "#060810",
  /** Card / surface background */
  surface: "#0C0E16",
  /** Elevated surface */
  elevated: "#14171F",
  /** Border */
  border: "#1E2235",
  /** Primary gold accent */
  gold: "#D4A843",
  /** Bright gold for highlights */
  goldBright: "#F0C85A",
  /** Danger / war red */
  red: "#C93545",
  /** Deep crimson */
  crimson: "#7A1A28",
  /** Primary text */
  text: "#F1F5F9",
  /** Secondary text */
  textSecondary: "#C8D0DC",
  /** Muted / tertiary text */
  muted: "#6B7590",
  /** CTA accent (purple, matches --primary) */
  primary: "#6B5CF6",
  /** Overlay dense */
  overlayDense: "rgba(6,8,16,0.95)",
  /** Overlay medium */
  overlayMedium: "rgba(6,8,16,0.75)",
  /** Overlay light */
  overlayLight: "rgba(6,8,16,0.35)",
} as const;

// ─── Angle-aware theming ─────────────────────────────────────────────────────
// Automatically detects the content angle from visual_direction text and returns
// a color palette that tints the preview background accordingly.

export type ContentAngle =
  | "battle"
  | "economy"
  | "spy"
  | "tribe"
  | "competition"
  | "default";

interface AngleTheme {
  /** Primary accent color for this angle */
  accent: string;
  /** Secondary glow color */
  glow: string;
  /** Radial gradient layers for the frame background */
  bgLayers: string;
  /** Edge glow color */
  edgeGlow: string;
  /** Hebrew label */
  label: string;
}

const ANGLE_THEMES: Record<ContentAngle, AngleTheme> = {
  battle: {
    accent: "#E8423A",
    glow: "rgba(232,66,58,0.18)",
    bgLayers: `
      radial-gradient(ellipse at 50% 0%, rgba(232,66,58,0.14) 0%, transparent 55%),
      radial-gradient(ellipse at 20% 90%, rgba(255,120,50,0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 60%, rgba(180,30,20,0.08) 0%, transparent 45%)
    `,
    edgeGlow: "rgba(232,66,58,0.12)",
    label: "קרב",
  },
  economy: {
    accent: "#D4A843",
    glow: "rgba(212,168,67,0.20)",
    bgLayers: `
      radial-gradient(ellipse at 40% 20%, rgba(212,168,67,0.14) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 85%, rgba(240,200,90,0.06) 0%, transparent 45%),
      radial-gradient(ellipse at 15% 70%, rgba(180,140,40,0.08) 0%, transparent 50%)
    `,
    edgeGlow: "rgba(212,168,67,0.10)",
    label: "כלכלה",
  },
  spy: {
    accent: "#4A9EE8",
    glow: "rgba(74,158,232,0.14)",
    bgLayers: `
      radial-gradient(ellipse at 60% 30%, rgba(74,158,232,0.10) 0%, transparent 50%),
      radial-gradient(ellipse at 30% 80%, rgba(40,80,160,0.08) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(100,60,200,0.06) 0%, transparent 50%)
    `,
    edgeGlow: "rgba(74,158,232,0.10)",
    label: "ריגול",
  },
  tribe: {
    accent: "#9B6BF6",
    glow: "rgba(155,107,246,0.16)",
    bgLayers: `
      radial-gradient(ellipse at 50% 15%, rgba(155,107,246,0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 25% 75%, rgba(120,50,220,0.08) 0%, transparent 45%),
      radial-gradient(ellipse at 75% 60%, rgba(80,40,180,0.06) 0%, transparent 50%)
    `,
    edgeGlow: "rgba(155,107,246,0.10)",
    label: "שבט",
  },
  competition: {
    accent: "#D4A843",
    glow: "rgba(212,168,67,0.16)",
    bgLayers: `
      radial-gradient(ellipse at 50% 10%, rgba(212,168,67,0.16) 0%, transparent 45%),
      radial-gradient(ellipse at 30% 70%, rgba(180,100,30,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 50%, rgba(255,200,80,0.06) 0%, transparent 45%)
    `,
    edgeGlow: "rgba(212,168,67,0.12)",
    label: "תחרות",
  },
  default: {
    accent: "#D4A843",
    glow: "rgba(212,168,67,0.10)",
    bgLayers: `
      radial-gradient(ellipse at 30% 20%, rgba(212,168,67,0.08) 0%, transparent 55%),
      radial-gradient(ellipse at 70% 80%, rgba(201,53,69,0.06) 0%, transparent 55%)
    `,
    edgeGlow: "rgba(212,168,67,0.06)",
    label: "",
  },
};

/** Detect content angle from visual_direction or content pillar text. */
export function detectAngle(visualDirection?: string | null): ContentAngle {
  if (!visualDirection) return "default";
  const text = visualDirection.toLowerCase();

  // Battle: fire, war, soldiers, attack, fortress, army, combat
  if (
    /קרב|תקיפ|חייל|צבא|מלחמ|אש|מבצר|נשק|חרב|attack|battle|war|fire|fort|army|soldier/.test(
      text,
    )
  ) {
    return "battle";
  }
  // Economy: gold, bank, loot, resources, vault, mine
  if (
    /זהב|בנק|שלל|משאב|כספ|מכר|עבד|gold|bank|loot|vault|resource|econ/.test(text)
  ) {
    return "economy";
  }
  // Spy: shadow, stealth, spy, intelligence, hidden
  if (
    /ריגול|מרגל|צל|סתר|מודיעין|חשיפ|spy|shadow|stealth|intel|hidden/.test(text)
  ) {
    return "spy";
  }
  // Tribe: tribe, clan, alliance, banner, ritual
  if (/שבט|לחש|ברית|דגל|מועצ|tribe|clan|alliance|banner|ritual/.test(text)) {
    return "tribe";
  }
  // Competition: rank, crown, leaderboard, dominance, city
  if (/דירוג|כתר|עליונ|תחרו|עיר|rank|crown|leader|domin|compet/.test(text)) {
    return "competition";
  }

  return "default";
}

export function getAngleTheme(angle: ContentAngle): AngleTheme {
  return ANGLE_THEMES[angle];
}

// ─── Background image layer ──────────────────────────────────────────────────
// Uses real Domiron game screenshots from /public/screenImage/.
//
// Two-level resolution:
//   1. Angle-level default: each ContentAngle maps to a primary screenshot
//   2. Keyword-level override: specific words in visual_direction can pick
//      a more precise screenshot (e.g. "חנות" → shop.png instead of bank.png)
//
// To add new screenshots: drop files in /public/screenImage/ and add
// entries to ANGLE_BG_DEFAULTS or KEYWORD_BG_OVERRIDES below.

const FALLBACK_IMAGE = "/screenImage/deasboard.png";

/** Primary screenshot per angle. */
const ANGLE_BG_DEFAULTS: Record<ContentAngle, string> = {
  battle: "/screenImage/background-game.png",
  economy: "/screenImage/bank.png",
  spy: "/screenImage/map.png",
  tribe: "/screenImage/clan.png",
  competition: "/screenImage/prize.png",
  default: "/screenImage/deasboard.png",
};

/**
 * Keyword overrides — checked against the raw visual_direction text.
 * If a keyword matches, its image wins over the angle default.
 * Checked in order; first match wins.
 */
const KEYWORD_BG_OVERRIDES: { pattern: RegExp; image: string }[] = [
  {
    pattern: /חנות|shop|נשק|ציוד|שריון|arsenal/,
    image: "/screenImage/shop.png",
  },
  {
    pattern: /אימון|training|גיוס|recruit/,
    image: "/screenImage/training.png",
  },
  { pattern: /בנק|bank|הפקד|ריבית|deposit/, image: "/screenImage/bank.png" },
  { pattern: /שבט|clan|tribe|מועצ|לחש/, image: "/screenImage/clan.png" },
  {
    pattern: /מפה|map|טריטוריה|territory|עיר|city/,
    image: "/screenImage/map.png",
  },
  {
    pattern: /אוכלוסי|population|גידול|growth/,
    image: "/screenImage/population.png",
  },
  {
    pattern: /עבד|slave|worker|עובד|ייצור|production/,
    image: "/screenImage/working.png",
  },
  {
    pattern: /פרס|prize|הישג|achievement|שלל|reward/,
    image: "/screenImage/prize.png",
  },
  { pattern: /דירוג|rank|leader|crown|כתר/, image: "/screenImage/prize.png" },
];

/** Background position tuning per image so the most interesting part is visible. */
const BG_POSITIONS: Record<string, string> = {
  "/screenImage/training.png": "center 30%",
  "/screenImage/bank.png": "center 40%",
  "/screenImage/shop.png": "center 35%",
  "/screenImage/clan.png": "center 30%",
  "/screenImage/map.png": "center center",
  "/screenImage/population.png": "center 40%",
  "/screenImage/working.png": "center 35%",
  "/screenImage/prize.png": "center 30%",
  "/screenImage/deasboard.png": "center 35%",
  "/screenImage/background-game.png": "center center",
};

/** Resolve the best screenshot for a given angle + raw visual_direction. */
function resolveBackgroundImage(
  angle: ContentAngle,
  visualDirection?: string | null,
): string {
  // Try keyword overrides first (more specific wins)
  if (visualDirection) {
    const text = visualDirection.toLowerCase();
    for (const { pattern, image } of KEYWORD_BG_OVERRIDES) {
      if (pattern.test(text)) return image;
    }
  }
  // Fall back to angle default
  return ANGLE_BG_DEFAULTS[angle] ?? FALLBACK_IMAGE;
}

interface BackgroundImageProps {
  angle: ContentAngle;
  visualDirection?: string | null;
}

/**
 * Full-bleed background image for a preview frame.
 * Renders the real game screenshot + a dark overlay on top.
 * Placed BEFORE Atmosphere/GradientOverlay in the layer stack.
 */
function BackgroundImage({ angle, visualDirection }: BackgroundImageProps) {
  const src = resolveBackgroundImage(angle, visualDirection);
  const position = BG_POSITIONS[src] ?? "center center";

  return (
    <>
      {/* Background image — real game screenshot, covers full frame */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: position,
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Dark overlay — ensures text readability over bright screenshots */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(180deg,
              rgba(6,8,16,0.60) 0%,
              rgba(6,8,16,0.45) 35%,
              rgba(6,8,16,0.50) 65%,
              rgba(6,8,16,0.70) 100%
            )
          `,
        }}
      />
    </>
  );
}

// ─── PreviewFrame ────────────────────────────────────────────────────────────

interface PreviewFrameProps {
  /** CSS aspect-ratio value, e.g. "1/1", "9/16", "16/9" */
  aspect: string;
  children: ReactNode;
  className?: string;
  /** Optional max-width override (default 420px) */
  maxWidth?: number;
  /** Content angle for themed background (auto-detected if not provided) */
  angle?: ContentAngle;
  /** Raw visual_direction text for keyword-level background selection */
  visualDirection?: string | null;
}

export function PreviewFrame({
  aspect,
  children,
  className = "",
  maxWidth = 420,
  angle = "default",
  visualDirection,
}: PreviewFrameProps) {
  const theme = getAngleTheme(angle);

  return (
    <div
      dir="rtl"
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        aspectRatio: aspect,
        maxWidth,
        width: "100%",
        background: `
          ${theme.bgLayers},
          linear-gradient(180deg, ${colors.surface} 0%, ${colors.bg} 100%)
        `,
        border: `1px solid ${colors.border}`,
        boxShadow: `
          0 0 60px ${theme.edgeGlow},
          0 0 120px ${theme.edgeGlow},
          inset 0 1px 0 rgba(255,255,255,0.03)
        `,
      }}
    >
      {/* Layer 1: Background image (real game screenshot) + dark overlay */}
      <BackgroundImage angle={angle} visualDirection={visualDirection} />
      {/* Layer 2+: Atmosphere, GradientOverlay, content (rendered by caller) */}
      {children}
    </div>
  );
}

// ─── GradientOverlay ─────────────────────────────────────────────────────────

interface GradientOverlayProps {
  position?: "bottom" | "top" | "full";
  /** Content angle for tinted overlays */
  angle?: ContentAngle;
}

export function GradientOverlay({
  position = "bottom",
  angle = "default",
}: GradientOverlayProps) {
  const theme = getAngleTheme(angle);

  const gradients: Record<string, string> = {
    bottom: `
      linear-gradient(to top,
        ${colors.overlayDense} 0%,
        ${colors.overlayMedium} 40%,
        ${colors.overlayLight} 70%,
        transparent 100%
      )
    `,
    top: `
      linear-gradient(to bottom,
        ${colors.overlayDense} 0%,
        ${colors.overlayMedium} 40%,
        transparent 100%
      )
    `,
    full: `
      linear-gradient(to bottom,
        ${colors.overlayDense} 0%,
        ${colors.overlayMedium} 35%,
        rgba(6,8,16,0.55) 55%,
        ${colors.overlayMedium} 75%,
        ${colors.overlayDense} 100%
      )
    `,
  };

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: gradients[position] }}
      />
      {/* Subtle angle-tinted atmospheric layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${theme.glow} 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />
    </>
  );
}

// ─── Atmospheric layers ──────────────────────────────────────────────────────

interface AtmosphereProps {
  angle?: ContentAngle;
}

/** Multi-layer atmospheric effect: top glow + bottom fog + edge vignette. */
export function Atmosphere({ angle = "default" }: AtmosphereProps) {
  const theme = getAngleTheme(angle);

  return (
    <>
      {/* Top accent glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% -10%, ${theme.glow} 0%, transparent 60%)`,
        }}
      />
      {/* Bottom fog */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 110%, rgba(6,8,16,0.8) 0%, transparent 50%)`,
        }}
      />
      {/* Corner vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 0% 0%, rgba(6,8,16,0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, rgba(6,8,16,0.4) 0%, transparent 50%)
          `,
        }}
      />
      {/* Subtle noise texture via CSS pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
    </>
  );
}

// ─── Text hierarchy ──────────────────────────────────────────────────────────

interface HookTextProps {
  children: ReactNode;
  size?: "xl" | "lg" | "md" | "sm";
  /** Accent color override (defaults to white with gold glow) */
  glowColor?: string;
}

export function HookText({ children, size = "lg", glowColor }: HookTextProps) {
  const sizeClasses = {
    xl: "text-[28px] leading-[1.15]",
    lg: "text-2xl leading-[1.2]",
    md: "text-xl leading-[1.2]",
    sm: "text-lg leading-snug",
  };
  const glow = glowColor ?? "rgba(212,168,67,0.25)";

  return (
    <h3
      className={`font-black tracking-tight ${sizeClasses[size]}`}
      style={{
        color: colors.text,
        textShadow: `
          0 2px 16px rgba(0,0,0,0.8),
          0 0 40px ${glow},
          0 0 80px ${glow}
        `,
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
      className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium"
      style={{
        color: colors.textSecondary,
        textShadow: "0 1px 8px rgba(0,0,0,0.6)",
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

// ─── CtaBadge ────────────────────────────────────────────────────────────────

interface CtaBadgeProps {
  children: ReactNode;
  angle?: ContentAngle;
}

export function CtaBadge({ children, angle = "default" }: CtaBadgeProps) {
  const theme = getAngleTheme(angle);
  const isGold =
    angle === "default" || angle === "economy" || angle === "competition";
  const bg = isGold
    ? `linear-gradient(135deg, ${colors.gold} 0%, #B8912E 100%)`
    : `linear-gradient(135deg, ${theme.accent} 0%, ${colors.bg} 200%)`;
  const textColor = isGold ? colors.bg : colors.text;
  const shadow = isGold
    ? `0 0 24px rgba(212,168,67,0.4), 0 0 60px rgba(212,168,67,0.15), 0 4px 12px rgba(0,0,0,0.5)`
    : `0 0 24px ${theme.edgeGlow}, 0 4px 12px rgba(0,0,0,0.5)`;

  return (
    <span
      className="inline-block text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-lg"
      style={{
        background: bg,
        color: textColor,
        boxShadow: shadow,
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </span>
  );
}

// ─── FormatBadge ─────────────────────────────────────────────────────────────

interface FormatBadgeProps {
  label: string;
  angle?: ContentAngle;
}

export function FormatBadge({ label, angle = "default" }: FormatBadgeProps) {
  const theme = getAngleTheme(angle);
  return (
    <span
      className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-md"
      style={{
        backgroundColor: "rgba(6,8,16,0.7)",
        color: theme.accent,
        backdropFilter: "blur(12px)",
        zIndex: 10,
        border: `1px solid rgba(255,255,255,0.06)`,
        boxShadow: `0 0 12px ${theme.edgeGlow}`,
      }}
    >
      {label}
    </span>
  );
}

// ─── SlideIndicator ──────────────────────────────────────────────────────────

interface SlideIndicatorProps {
  total: number;
  current: number;
  angle?: ContentAngle;
}

export function SlideIndicator({
  total,
  current,
  angle = "default",
}: SlideIndicatorProps) {
  const theme = getAngleTheme(angle);
  return (
    <div className="flex gap-1.5 justify-center py-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 6,
            height: 6,
            backgroundColor:
              i === current ? theme.accent : "rgba(255,255,255,0.15)",
            boxShadow: i === current ? `0 0 10px ${theme.glow}` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── ArcLabel ────────────────────────────────────────────────────────────────
// Emotional arc step label for carousel slides.

interface ArcLabelProps {
  children: ReactNode;
  angle?: ContentAngle;
}

export function ArcLabel({ children, angle = "default" }: ArcLabelProps) {
  const theme = getAngleTheme(angle);
  return (
    <span
      className="text-[10px] font-black uppercase tracking-[0.2em]"
      style={{
        color: theme.accent,
        textShadow: `0 0 20px ${theme.glow}`,
      }}
    >
      {children}
    </span>
  );
}

// ─── SceneNumber ─────────────────────────────────────────────────────────────

interface SceneNumberProps {
  number: number;
  angle?: ContentAngle;
  isFirst?: boolean;
  isLast?: boolean;
}

export function SceneNumber({
  number,
  angle = "default",
  isFirst,
  isLast,
}: SceneNumberProps) {
  const theme = getAngleTheme(angle);
  const bg = isFirst
    ? `linear-gradient(135deg, ${theme.accent} 0%, ${colors.crimson} 100%)`
    : isLast
      ? `linear-gradient(135deg, ${colors.gold} 0%, #B8912E 100%)`
      : `linear-gradient(135deg, ${colors.elevated} 0%, ${colors.border} 100%)`;
  const color = isFirst || isLast ? colors.bg : colors.textSecondary;

  return (
    <span
      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
      style={{
        background: bg,
        color,
        boxShadow: isFirst
          ? `0 0 16px ${theme.glow}`
          : isLast
            ? `0 0 16px rgba(212,168,67,0.25)`
            : "0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      {number}
    </span>
  );
}

// ─── Decorative elements ─────────────────────────────────────────────────────

export function GoldAccentLine() {
  return (
    <div
      className="w-16 h-[2px] rounded-full"
      style={{
        background: `linear-gradient(90deg, ${colors.gold}, ${colors.goldBright}, transparent)`,
        boxShadow: `0 0 12px rgba(212,168,67,0.3)`,
      }}
    />
  );
}

interface AccentLineProps {
  angle?: ContentAngle;
}

export function AccentLine({ angle = "default" }: AccentLineProps) {
  const theme = getAngleTheme(angle);
  return (
    <div
      className="w-16 h-[2px] rounded-full"
      style={{
        background: `linear-gradient(90deg, ${theme.accent}, transparent)`,
        boxShadow: `0 0 12px ${theme.glow}`,
      }}
    />
  );
}

// ─── NavButton ───────────────────────────────────────────────────────────────
// Reusable prev/next navigation button for carousel / story.

interface NavButtonProps {
  direction: "prev" | "next";
  onClick: () => void;
  angle?: ContentAngle;
  children: ReactNode;
}

export function NavButton({
  direction,
  onClick,
  angle = "default",
  children,
}: NavButtonProps) {
  const theme = getAngleTheme(angle);
  const position = direction === "prev" ? "right-2.5" : "left-2.5";

  return (
    <button
      onClick={onClick}
      className={`absolute ${position} top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110`}
      style={{
        backgroundColor: "rgba(6,8,16,0.75)",
        color: colors.text,
        backdropFilter: "blur(8px)",
        border: `1px solid rgba(255,255,255,0.08)`,
        boxShadow: `0 0 16px ${theme.edgeGlow}, 0 4px 12px rgba(0,0,0,0.4)`,
      }}
      aria-label={direction === "prev" ? "Previous slide" : "Next slide"}
    >
      {children}
    </button>
  );
}
