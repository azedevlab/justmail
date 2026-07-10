import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const ColorRamp = z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).length(12);
export type ColorRamp = z.infer<typeof ColorRamp>;

export const ThemeTokens = z.object({
  brand: ColorRamp,
  neutral: ColorRamp,
  ok: z.string(),
  warn: z.string(),
  bad: z.string(),
  font_sans: z.string(),
  font_mono: z.string(),
  radius_base: z.number(),
  radius_lg: z.number(),
  mode: z.enum(["light", "dark", "system"]),
});
export type ThemeTokens = z.infer<typeof ThemeTokens>;

export const Theme = z.object({
  id: Uuid,
  org_id: Uuid.nullable(),
  domain_id: Uuid.nullable(),
  name: z.string(),
  tokens: ThemeTokens,
  css_extra: z.string(),
  created_at: IsoDate,
  updated_at: IsoDate,
});
export type Theme = z.infer<typeof Theme>;

export const UpsertThemeRequest = z.object({
  name: z.string().min(1).max(200),
  tokens: ThemeTokens,
  css_extra: z.string().max(50_000).default(""),
  domain_id: Uuid.nullable().optional(),
});
export type UpsertThemeRequest = z.infer<typeof UpsertThemeRequest>;
