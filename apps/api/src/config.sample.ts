/**
 * Reference config generator: turns the zod `Env` schema into an annotated
 * `.env.example`, so the sample can never drift from what startup actually
 * validates. Keys with no default are required and must be set; keys with a
 * default are emitted commented-out showing that default.
 */
import { z } from "zod";
import { Env } from "./config.schema";

interface JsonProp {
  type?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minLength?: number;
  description?: string;
}

function hint(p: JsonProp): string {
  // Prefer the schema's human description (`.describe(...)`) when present so the
  // sample carries operator guidance, not just the machine-derived type hint.
  if (p.description) return p.description;
  const bits: string[] = [];
  if (p.enum) {
    bits.push(`one of: ${p.enum.join(", ")}`);
  } else {
    let t = p.type ?? "string";
    if (p.format) t += ` (${p.format})`;
    if (p.minLength) t += `, min ${p.minLength}`;
    bits.push(t);
  }
  return bits.join("; ");
}

export function buildEnvSample(): string {
  const schema = z.toJSONSchema(Env, { unrepresentable: "any" }) as {
    properties: Record<string, JsonProp>;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(schema.properties);
  // A key is user-required only if it is required AND has no default to fall
  // back to — zod lists defaulted keys as "required" post-parse too.
  const mustSet = entries.filter(([k, p]) => required.has(k) && p.default === undefined);
  const optional = entries.filter(([k]) => !mustSet.some(([mk]) => mk === k));

  const lines: string[] = [
    "# JustMail API configuration.",
    "# Generated from the config schema — regenerate with:",
    "#   pnpm --filter @justmail/api config:sample",
    "# Copy to .env and fill in the required values. Never commit real secrets.",
    "",
    "# ── Required (no default; must be set) ──",
  ];
  for (const [k, p] of mustSet) {
    lines.push(`${k}=            # ${hint(p)}`);
  }
  lines.push("", "# ── Optional (defaults shown; uncomment to override) ──");
  for (const [k, p] of optional) {
    const value = p.default === undefined ? "" : String(p.default);
    lines.push(`# ${k}=${value}            # ${hint(p)}`);
  }
  return `${lines.join("\n")}\n`;
}
