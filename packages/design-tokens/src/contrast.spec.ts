import { describe, expect, it } from "vitest";
import {
  brand,
  neutralDark,
  neutralLight,
  semantic,
  semanticLight,
  surfaceDark,
  surfaceLight,
} from "./index.js";

// WCAG 2.1 relative luminance + contrast ratio, so the token palette is
// audited in CI rather than eyeballed. Thresholds: 4.5:1 for body text,
// 3:1 for large text and non-text UI (borders, icons, focus rings).
const AA_BODY = 4.5;
const AA_LARGE = 3;

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function expectRatio(fg: string, bg: string, min: number): void {
  const ratio = contrast(fg, bg);
  expect(
    ratio,
    `contrast ${fg} on ${bg} = ${ratio.toFixed(2)} (need ${min})`,
  ).toBeGreaterThanOrEqual(min);
}

describe("light theme contrast", () => {
  const bgs = [surfaceLight.bg, surfaceLight["1"], surfaceLight["2"]];

  it("body text meets AA on every surface", () => {
    for (const bg of bgs) {
      expectRatio(neutralLight[11], bg, AA_BODY);
      expectRatio(neutralLight[10], bg, AA_BODY);
    }
  });

  it("muted text meets AA on canvas and cards", () => {
    for (const bg of [surfaceLight.bg, surfaceLight["1"]]) {
      expectRatio(neutralLight[8], bg, AA_BODY);
      expectRatio(neutralLight[7], bg, AA_BODY);
    }
  });

  it("semantic text meets AA on white cards", () => {
    for (const c of Object.values(semanticLight)) {
      expectRatio(c, surfaceLight["1"], AA_BODY);
    }
  });

  it("accent meets non-text UI contrast on white", () => {
    expectRatio(brand[6], surfaceLight["1"], AA_LARGE);
  });
});

describe("dark theme contrast", () => {
  const bgs = [surfaceDark.bg, surfaceDark["1"], surfaceDark["2"]];

  it("body text meets AA on every surface", () => {
    for (const bg of bgs) {
      expectRatio(neutralDark[11], bg, AA_BODY);
      expectRatio(neutralDark[10], bg, AA_BODY);
    }
  });

  it("muted text meets AA on the canvas", () => {
    expectRatio(neutralDark[8], surfaceDark.bg, AA_BODY);
  });

  it("secondary muted text meets non-text UI contrast on the canvas", () => {
    expectRatio(neutralDark[7], surfaceDark.bg, AA_LARGE);
  });

  it("semantic text meets AA on the canvas", () => {
    for (const c of Object.values(semantic)) {
      expectRatio(c, surfaceDark.bg, AA_BODY);
    }
  });
});
