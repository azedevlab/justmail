// Emit CSS custom properties from the token TS module. Produces two blocks
// (:root for the default light theme + .theme-dark for dark) so any app can
// switch by toggling a class on <html>.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as t from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "dist", "tokens.css");
mkdirSync(dirname(out), { recursive: true });

const rampCss = (ns, ramp) =>
  ramp.map((c, i) => `  --${ns}-${i * 100 || 50}: ${c};`).join("\n");

const flat = (ns, obj) =>
  Object.entries(obj)
    .map(([k, v]) => `  --${ns}-${k}: ${v};`)
    .join("\n");

// Hex → rgba() so we can emit alpha tints of solid token colours. Every
// translucent surface/ring/border in the apps resolves to one of these, so no
// component hand-writes an rgb()/rgba() literal.
const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h;
  const int = parseInt(n, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};
const alpha = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// Semantic alpha tints. `accent` differs per theme; ok/warn/bad/info fills use
// the bright semantic set in both themes (subtle wash behind coloured text).
const tintTokens = (accent) => `  --color-accent-subtle: ${alpha(accent, 0.1)};
  --color-accent-muted: ${alpha(accent, 0.14)};
  --color-accent-strong: ${alpha(accent, 0.16)};
  --color-accent-border: ${alpha(accent, 0.25)};
  --color-accent-hover: ${alpha(accent, 0.45)};
  --color-accent-ring: ${alpha(accent, 0.55)};
  --color-accent-focus: ${alpha(accent, 0.18)};
  --color-ok-surface: ${alpha(t.semantic.ok, 0.12)};
  --color-ok-border: ${alpha(t.semantic.ok, 0.25)};
  --color-warn-surface: ${alpha(t.semantic.warn, 0.12)};
  --color-warn-border: ${alpha(t.semantic.warn, 0.25)};
  --color-bad-surface: ${alpha(t.semantic.bad, 0.12)};
  --color-bad-border: ${alpha(t.semantic.bad, 0.25)};
  --color-bad-hover: ${alpha(t.semantic.bad, 0.1)};
  --color-info-surface: ${alpha(t.semantic.info, 0.12)};
  --color-info-border: ${alpha(t.semantic.info, 0.25)};
  --gradient-brand: linear-gradient(135deg, var(--color-brand-400), var(--color-ok));
  --gradient-brand-mark: linear-gradient(135deg, var(--color-brand-400) 0%, var(--color-brand-600) 100%);
  --shadow-brand-mark: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 8px ${alpha(t.brand[5], 0.35)};
  --gradient-aurora-a: radial-gradient(circle, ${alpha(t.brand[5], 0.1)} 0%, transparent 65%);
  --gradient-aurora-b: radial-gradient(circle, ${alpha(t.semantic.info, 0.1)} 0%, transparent 65%);
  --shadow-btn-primary: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 1px 2px rgba(16, 24, 40, 0.24);
  --shadow-btn-active: inset 0 1px 2px rgba(0, 0, 0, 0.25);`;

// Monochrome accent: interactive UI (buttons, links, focus, selection) resolves
// to near-black on light and near-white on dark. The brand ramp is retained
// only for identity surfaces (logo mark, avatars). Status colours stay semantic.
const lightAccentHex = t.neutralLight[11]; // #0B0D10 near-black
const darkAccentHex = t.neutralDark[11]; // #EDEFF2 near-white

const light = `
:root, .theme-light {
  color-scheme: light;
${rampCss("color-neutral", t.neutralLight)}
${rampCss("color-brand", t.brand)}
  --color-ok: ${t.semanticLight.ok};
  --color-warn: ${t.semanticLight.warn};
  --color-bad: ${t.semanticLight.bad};
  --color-info: ${t.semanticLight.info};
  --color-bg: ${t.surfaceLight.bg};
  --color-surface-1: ${t.surfaceLight["1"]};
  --color-surface-2: ${t.surfaceLight["2"]};
  --color-surface-3: ${t.surfaceLight["3"]};
  --color-surface: var(--color-surface-1);
  --color-field: #FFFFFF;
  --color-text: var(--color-neutral-1100);
  --color-text-muted: var(--color-neutral-800);
  --color-accent: var(--color-neutral-1100);
  --color-accent-hover-solid: var(--color-neutral-1000);
  --color-on-accent: #FFFFFF;
  --color-border: rgba(16,24,40,0.09);
  --color-border-strong: rgba(16,24,40,0.16);
  --highlight-top: inset 0 1px 0 rgba(255,255,255,0.6);
  --hover-overlay: rgba(16,24,40,0.05);
  --hover-overlay-faint: rgba(16,24,40,0.03);
  --overlay: rgba(23,25,35,0.45);
  --scrollbar-thumb: rgba(16,24,40,0.18);
  --scrollbar-thumb-hover: rgba(16,24,40,0.30);
  --shadow-inset-input: inset 0 1px 2px rgba(16,24,40,0.04);
  --dot-grid: rgba(16,24,40,0.07);
${tintTokens(lightAccentHex)}
${flat("space", t.spacing)}
${flat("radius", t.radius)}
${flat("fontSize", t.fontSize)}
${flat("tracking", t.letterSpacing)}
${Object.entries(t.fontFamily).map(([k, v]) => `  --font-${k}: ${v};`).join("\n")}
${Object.entries(t.motion).map(([k, v]) => `  --motion-${k}: ${v};`).join("\n")}
${flat("shadow", t.elevationLight)}
${Object.entries(t.zIndex).map(([k, v]) => `  --z-${k}: ${v};`).join("\n")}
}
`;

const dark = `
.theme-dark {
  color-scheme: dark;
${rampCss("color-neutral", t.neutralDark)}
  --color-ok: ${t.semantic.ok};
  --color-warn: ${t.semantic.warn};
  --color-bad: ${t.semantic.bad};
  --color-info: ${t.semantic.info};
  --color-bg: ${t.surfaceDark.bg};
  --color-surface-1: ${t.surfaceDark["1"]};
  --color-surface-2: ${t.surfaceDark["2"]};
  --color-surface-3: ${t.surfaceDark["3"]};
  --color-surface: var(--color-surface-1);
  --color-field: ${t.surfaceDark["2"]};
  --color-text: var(--color-neutral-1100);
  --color-text-muted: var(--color-neutral-900);
  --color-accent: var(--color-neutral-1100);
  --color-accent-hover-solid: var(--color-neutral-1000);
  --color-on-accent: #0B0D10;
  --color-border: rgba(255,255,255,0.07);
  --color-border-strong: rgba(255,255,255,0.13);
  --highlight-top: inset 0 1px 0 rgba(255,255,255,0.04);
  --hover-overlay: rgba(255,255,255,0.06);
  --hover-overlay-faint: rgba(255,255,255,0.03);
  --overlay: rgba(0,0,0,0.6);
  --scrollbar-thumb: rgba(255,255,255,0.08);
  --scrollbar-thumb-hover: rgba(255,255,255,0.16);
  --shadow-inset-input: inset 0 1px 2px rgba(0,0,0,0.25);
  --dot-grid: rgba(255,255,255,0.05);
${tintTokens(darkAccentHex)}
${flat("shadow", t.elevation)}
}
`;

const highContrast = `
.theme-dark.contrast-high {
  --color-border: rgba(255,255,255,0.25);
  --color-border-strong: rgba(255,255,255,0.45);
}
.contrast-high {
  --color-border: rgba(16,24,40,0.30);
  --color-border-strong: rgba(16,24,40,0.50);
}
`;

writeFileSync(out, [light, dark, highContrast].join("\n"));
console.log("wrote", out);
