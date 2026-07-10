// Emit CSS custom properties from the token TS module. Produces two blocks
// (:root for the default dark theme + .theme-light for light) so any app can
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

const dark = `
:root, .theme-dark {
${rampCss("color-neutral", t.neutralDark)}
${rampCss("color-brand", t.brand)}
  --color-ok: ${t.semantic.ok};
  --color-warn: ${t.semantic.warn};
  --color-bad: ${t.semantic.bad};
  --color-info: ${t.semantic.info};
  --color-bg: ${t.surfaceDark.bg};
  --color-surface-1: ${t.surfaceDark["1"]};
  --color-surface-2: ${t.surfaceDark["2"]};
  --color-surface-3: ${t.surfaceDark["3"]};
  --color-surface: var(--color-surface-1);
  --color-text: var(--color-neutral-1100);
  --color-text-muted: var(--color-neutral-900);
  --color-border: rgba(255,255,255,0.07);
  --color-border-strong: rgba(255,255,255,0.13);
  --highlight-top: inset 0 1px 0 rgba(255,255,255,0.04);
${flat("space", t.spacing)}
${flat("radius", t.radius)}
${flat("fontSize", t.fontSize)}
${flat("tracking", t.letterSpacing)}
${Object.entries(t.fontFamily).map(([k, v]) => `  --font-${k}: ${v};`).join("\n")}
${Object.entries(t.motion).map(([k, v]) => `  --motion-${k}: ${v};`).join("\n")}
${flat("shadow", t.elevation)}
${Object.entries(t.zIndex).map(([k, v]) => `  --z-${k}: ${v};`).join("\n")}
}
`;

const light = `
.theme-light {
${rampCss("color-neutral", t.neutralLight)}
  --color-bg: ${t.surfaceLight.bg};
  --color-surface-1: ${t.surfaceLight["1"]};
  --color-surface-2: ${t.surfaceLight["2"]};
  --color-surface-3: ${t.surfaceLight["3"]};
  --color-surface: var(--color-surface-1);
  --color-text: var(--color-neutral-1100);
  --color-text-muted: var(--color-neutral-700);
  --color-border: rgba(0,0,0,0.08);
  --color-border-strong: rgba(0,0,0,0.14);
  --highlight-top: inset 0 1px 0 rgba(255,255,255,0.6);
}
`;

const highContrast = `
.contrast-high {
  --color-border: rgba(255,255,255,0.25);
  --color-border-strong: rgba(255,255,255,0.45);
}
`;

writeFileSync(out, [dark, light, highContrast].join("\n"));
console.log("wrote", out);
