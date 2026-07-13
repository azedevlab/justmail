import type { ColorRamp, ThemeTokens } from "@justmail/contracts";
import { brand, neutralLight, semanticLight, fontFamily } from "@justmail/design-tokens";

export const DEFAULT_TOKENS: ThemeTokens = {
  brand: [...brand] as unknown as ColorRamp,
  neutral: [...neutralLight] as unknown as ColorRamp,
  ok: semanticLight.ok,
  warn: semanticLight.warn,
  bad: semanticLight.bad,
  font_sans: fontFamily.sans,
  font_mono: fontFamily.mono,
  radius_base: 6,
  radius_lg: 8,
  mode: "system",
};

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
}

// Blend `hex` toward `target` by `ratio` (0..1 = amount of target).
function mix(hex: string, target: [number, number, number], ratio: number): string {
  const [r, g, b] = toRgb(hex);
  return toHex([
    r + (target[0] - r) * ratio,
    g + (target[1] - g) * ratio,
    b + (target[2] - b) * ratio,
  ]);
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];
// Tint/shade steps that mirror the platform brand ramp's spacing; the base
// colour lands at index 6 (the step --color-accent resolves to in light mode).
const TINTS = [0.92, 0.82, 0.66, 0.44, 0.24, 0.1];
const SHADES = [0.16, 0.3, 0.44, 0.6, 0.74];

/** Derive a 12-stop ramp (light → dark) from a single brand base colour. */
export function rampFromBase(base: string): ColorRamp {
  const stops = [
    ...TINTS.map((t) => mix(base, WHITE, t)),
    base.toLowerCase(),
    ...SHADES.map((s) => mix(base, BLACK, s)),
  ];
  return stops as unknown as ColorRamp;
}
