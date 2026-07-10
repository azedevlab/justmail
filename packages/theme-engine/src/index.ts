import type { ThemeTokens } from "@justmail/contracts";

/**
 * Theme engine. Compiles a ThemeTokens object into CSS custom-property
 * blocks. Scopes:
 *  - `:root` — the platform baseline (from @justmail/design-tokens).
 *  - `[data-org="<id>"]` — org overrides, applied to the whole app when
 *    switched.
 *  - `[data-domain="<domain>"]` — per-domain login/mail branding.
 * Consumers concatenate the outputs; specificity handles the cascade.
 */

export interface Scope {
  kind: "org" | "domain" | "root";
  id?: string;
}

export function compileTheme(tokens: ThemeTokens, scope: Scope = { kind: "root" }): string {
  const selector =
    scope.kind === "root"
      ? ":root"
      : scope.kind === "org"
      ? `[data-org="${scope.id ?? ""}"]`
      : `[data-domain="${scope.id ?? ""}"]`;

  const rampCss = (ns: string, ramp: readonly string[]) =>
    ramp.map((c, i) => `  --${ns}-${i * 100 || 50}: ${c};`).join("\n");

  return [
    `${selector} {`,
    rampCss("color-brand", tokens.brand),
    rampCss("color-neutral", tokens.neutral),
    `  --color-ok: ${tokens.ok};`,
    `  --color-warn: ${tokens.warn};`,
    `  --color-bad: ${tokens.bad};`,
    `  --font-sans: ${tokens.font_sans};`,
    `  --font-mono: ${tokens.font_mono};`,
    `  --radius-md: ${tokens.radius_base}px;`,
    `  --radius-lg: ${tokens.radius_lg}px;`,
    `}`,
  ].join("\n");
}

/** Merge multiple scoped compilations into a single stylesheet. */
export function compileThemes(
  ...blocks: Array<{ tokens: ThemeTokens; scope?: Scope }>
): string {
  return blocks
    .map((b) => compileTheme(b.tokens, b.scope ?? { kind: "root" }))
    .join("\n\n");
}

/** Validate that the token set is safe: colors are hex, ramps have 12 stops,
 *  fonts are simple family lists. Throws on invalid tokens. */
export function assertValidTokens(tokens: ThemeTokens): void {
  const hex = /^#[0-9a-fA-F]{6}$/;
  if (tokens.brand.length !== 12) throw new Error("brand ramp must have 12 stops");
  if (tokens.neutral.length !== 12) throw new Error("neutral ramp must have 12 stops");
  for (const c of [...tokens.brand, ...tokens.neutral, tokens.ok, tokens.warn, tokens.bad]) {
    if (!hex.test(c)) throw new Error(`invalid color: ${c}`);
  }
  if (!/^[\w\s"'\-,.()]+$/.test(tokens.font_sans))
    throw new Error("font_sans contains disallowed characters");
  if (!/^[\w\s"'\-,.()]+$/.test(tokens.font_mono))
    throw new Error("font_mono contains disallowed characters");
}
