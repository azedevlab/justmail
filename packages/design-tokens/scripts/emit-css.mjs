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

const light = `
:root, .theme-light {
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
  --color-accent: var(--color-brand-600);
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
  --color-accent: var(--color-brand-400);
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
