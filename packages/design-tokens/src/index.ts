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

// Light theme: soft slate canvas, white raised surfaces (cards/sidebar),
// slate-tinted recessed surface for hovers/wells, white popovers. Values track
// nube.sh's real palette (slate-50 canvas, white cards).
export const surfaceLight = {
  bg: "#F8FAFC",
  "1": "#FFFFFF",
  "2": "#F1F5F9",
  "3": "#FFFFFF",
} as const;

// Warm-slate neutral ramp (light) mirroring nube.sh: Tailwind-slate steps with
// a #1A202C ink at the dark end (their dominant heading colour).
export const neutralLight = [
  "#FFFFFF",
  "#F8FAFC",
  "#EEF1F6",
  "#E2E8F0",
  "#CBD5E1",
  "#94A3B8",
  "#64748B",
  "#52607A",
  "#475569",
  "#334155",
  "#1E293B",
  "#1A202C",
] as const;

// 12-step brand ramp (electric blue) mirroring nube.sh: step 6 (#0052FF) is
// their primary action colour, step 5 (#194BFB) their dominant working blue
// (used for the dark-theme accent and brand gradients). The wash steps
// (100/200) back active-nav and subtle accent fills.
export const brand = [
  "#EEF3FF",
  "#D9E2FF",
  "#B8CCFF",
  "#8AA8FF",
  "#5E83FB",
  "#194BFB",
  "#0052FF",
  "#0042D1",
  "#0035A8",
  "#0A2A7A",
  "#0C1F57",
  "#0A1740",
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
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
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

// Soft layered shadows for the light theme, tinted with nube.sh's slate ink
// (rgba(42,49,60) / rgba(26,32,44)) and the Stripe-style long-throw pair
// (rgba(50,50,93) + rgba(26,32,44)) used on their raised cards and modals.
export const elevationLight = {
  "0": "none",
  "1": "0 1px 2px rgba(42,49,60,0.06), 0 1px 3px rgba(42,49,60,0.05)",
  "2": "0 2px 6px rgba(42,49,60,0.06), 0 0 1px rgba(42,49,60,0.08)",
  "3": "0 12px 28px rgba(42,49,60,0.08), 0 0 1px rgba(42,49,60,0.08)",
  "4": "0 18px 36px -18px rgba(26,32,44,0.12), 0 30px 45px -30px rgba(50,50,93,0.20)",
  "5": "0 30px 45px -30px rgba(50,50,93,0.24), 0 18px 36px -18px rgba(26,32,44,0.14)",
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
