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

export const surfaceLight = {
  bg: "#FFFFFF",
  "1": "#F7F8FA",
  "2": "#EEF0F3",
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

// 12-step brand ramp (purple)
export const brand = [
  "#F5F1FF",
  "#E7DDFF",
  "#D2BFFF",
  "#B99CFF",
  "#9B83FF",
  "#7C5CFF",
  "#5C3DFF",
  "#4B2FE3",
  "#3A24BE",
  "#2A1B95",
  "#1D126D",
  "#120B4A",
] as const;

export const semantic = {
  ok: "#22C55E",
  warn: "#F59E0B",
  bad: "#EF4444",
  info: "#3B82F6",
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
  sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  serif: '"Source Serif Pro", ui-serif, Georgia, serif',
} as const;

export const letterSpacing = {
  body: "-0.011em",
  heading: "-0.02em",
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

export type Tokens = {
  neutralDark: typeof neutralDark;
  neutralLight: typeof neutralLight;
  surfaceDark: typeof surfaceDark;
  surfaceLight: typeof surfaceLight;
  brand: typeof brand;
  semantic: typeof semantic;
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
  spacing,
  radius,
  fontSize,
  fontFamily,
  letterSpacing,
  motion,
  elevation,
  zIndex,
};
