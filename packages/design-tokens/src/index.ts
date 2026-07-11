/**
 * Design tokens. These are the root source of truth for the JustMail visual
 * language. Tools/apps consume them through CSS custom properties emitted at
 * build time; JS/TS code imports the typed constants below when it needs a
 * value at runtime (e.g. for animations, canvas rendering).
 */

// 12-step neutral ramp (dark-first, keys map to lightness)
export const neutralDark = [
  "#08090C",
  "#0D0F13",
  "#13161C",
  "#1A1E26",
  "#232833",
  "#39404D",
  "#4D5666",
  "#6B7280",
  "#8B93A1",
  "#A9B0BC",
  "#D2D6DE",
  "#EDEFF2",
] as const;

// Layered surfaces (dark theme). bg is the canvas; each surface step is one
// perceptible layer up — sidebar/cards, inputs/hover, popovers/modals.
export const surfaceDark = {
  bg: "#08090C",
  "1": "#0D0F13",
  "2": "#13161C",
  "3": "#1A1E26",
} as const;

// Light theme: soft gray canvas, white raised surfaces (cards/sidebar),
// gray recessed surface for hovers/wells, white popovers.
export const surfaceLight = {
  bg: "#F7F8FA",
  "1": "#FFFFFF",
  "2": "#F2F3F6",
  "3": "#FFFFFF",
} as const;

export const neutralLight = [
  "#FFFFFF",
  "#F7F8FA",
  "#EEF0F3",
  "#E3E7EC",
  "#CFD4DC",
  "#A4ACB8",
  "#8B93A1",
  "#6B7280",
  "#4E5867",
  "#3A414C",
  "#1B1F26",
  "#0B0D10",
] as const;

// 12-step brand ramp (Apple-style blue)
export const brand = [
  "#F2F8FF",
  "#E3F0FF",
  "#BFDFFF",
  "#7ABBFF",
  "#3D9BFF",
  "#0A84FF",
  "#0071E3",
  "#005CBC",
  "#004A99",
  "#003876",
  "#082B56",
  "#051E3C",
] as const;

export const semantic = {
  ok: "#22C55E",
  warn: "#F59E0B",
  bad: "#EF4444",
  info: "#3B82F6",
} as const;

// Deterministic identity palette for generated avatars (hash → index). Kept as
// a token so the same colours back every avatar surface across apps.
export const avatarGradients = [
  "linear-gradient(135deg, #0A84FF 0%, #0071E3 100%)",
  "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
  "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
  "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
  "linear-gradient(135deg, #EC4899 0%, #BE185D 100%)",
  "linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)",
  "linear-gradient(135deg, #F97316 0%, #C2410C 100%)",
] as const;

// Darker semantic set for light backgrounds (AA contrast on white).
export const semanticLight = {
  ok: "#15803D",
  warn: "#B45309",
  bad: "#DC2626",
  info: "#1D4ED8",
} as const;

export const spacing = {
  "0": "0",
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "8": "2rem",
  "10": "2.5rem",
  "12": "3rem",
  "16": "4rem",
  "20": "5rem",
  "24": "6rem",
  "32": "8rem",
} as const;

export const radius = {
  none: "0",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  "2xl": "16px",
  full: "9999px",
} as const;

export const fontSize = {
  xs: "12px",
  sm: "13px",
  base: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "30px",
  "4xl": "36px",
  "5xl": "48px",
} as const;

export const fontFamily = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Segoe UI", Roboto, ui-sans-serif, sans-serif',
  mono: 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Monaco, "Cascadia Mono", "Roboto Mono", monospace',
  serif: '"New York", ui-serif, Georgia, serif',
} as const;

// SF Pro ships with optical tracking baked in — no negative body tracking.
export const letterSpacing = {
  body: "0em",
  heading: "-0.015em",
  label: "0.08em",
} as const;

export const motion = {
  quick: "80ms",
  base: "120ms",
  slow: "200ms",
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

// Raised surfaces pair a drop shadow with a 1px inner top highlight so edges
// catch light against the dark canvas.
export const elevation = {
  "0": "none",
  "1": "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px 0 rgba(0,0,0,0.4)",
  "2": "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 6px 0 rgba(0,0,0,0.45)",
  "3": "inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 16px 0 rgba(0,0,0,0.5)",
  "4": "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px 0 rgba(0,0,0,0.55)",
  "5": "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px 0 rgba(0,0,0,0.65)",
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  overlay: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
  cmdk: 80,
} as const;

// Soft diffuse shadows for the light theme.
export const elevationLight = {
  "0": "none",
  "1": "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.04)",
  "2": "0 2px 4px rgba(16,24,40,0.06), 0 2px 8px rgba(16,24,40,0.06)",
  "3": "0 4px 12px rgba(16,24,40,0.08), 0 1px 3px rgba(16,24,40,0.05)",
  "4": "0 12px 24px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06)",
  "5": "0 24px 48px rgba(16,24,40,0.16), 0 4px 10px rgba(16,24,40,0.06)",
} as const;

export type Tokens = {
  neutralDark: typeof neutralDark;
  neutralLight: typeof neutralLight;
  surfaceDark: typeof surfaceDark;
  surfaceLight: typeof surfaceLight;
  brand: typeof brand;
  semantic: typeof semantic;
  semanticLight: typeof semanticLight;
  avatarGradients: typeof avatarGradients;
  elevationLight: typeof elevationLight;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontFamily: typeof fontFamily;
  letterSpacing: typeof letterSpacing;
  motion: typeof motion;
  elevation: typeof elevation;
  zIndex: typeof zIndex;
};

export const tokens: Tokens = {
  neutralDark,
  neutralLight,
  surfaceDark,
  surfaceLight,
  brand,
  semantic,
  semanticLight,
  avatarGradients,
  elevationLight,
  spacing,
  radius,
  fontSize,
  fontFamily,
  letterSpacing,
  motion,
  elevation,
  zIndex,
};
