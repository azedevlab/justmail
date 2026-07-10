import { z } from "zod";
import { IsoDate, Iso2, Uuid } from "./primitives.js";

export const BlockedIpSource = z.enum(["fail2ban", "manual", "country"]);
export type BlockedIpSource = z.infer<typeof BlockedIpSource>;

export const BlockedIp = z.object({
  id: Uuid,
  ip: z.string(),
  source: BlockedIpSource,
  reason: z.string(),
  expires_at: IsoDate.nullable(),
  created_at: IsoDate,
});
export type BlockedIp = z.infer<typeof BlockedIp>;

export const CreateBlockedIpRequest = z.object({
  ip: z.string().min(2).max(64),
  reason: z.string().max(500).default(""),
  expires_at: IsoDate.nullable().optional(),
});
export type CreateBlockedIpRequest = z.infer<typeof CreateBlockedIpRequest>;

export const CountryBlock = z.object({
  enabled: z.boolean(),
  countries: z.array(Iso2).max(250),
});
export type CountryBlock = z.infer<typeof CountryBlock>;

export const IpWarmup = z.object({
  enabled: z.boolean(),
  started_at: IsoDate,
  days: z.number().int().min(1).max(90),
  daily_limit_start: z.number().int().min(1).max(1_000_000),
  daily_limit_target: z.number().int().min(1).max(10_000_000),
});
export type IpWarmup = z.infer<typeof IpWarmup>;

export const SecurityScoreFactor = z.object({
  id: z.string(),
  label: z.string(),
  ok: z.boolean(),
  weight: z.number().int(),
});
export type SecurityScoreFactor = z.infer<typeof SecurityScoreFactor>;

export const SecurityScore = z.object({
  score: z.number().int().min(0).max(100),
  factors: z.array(SecurityScoreFactor),
});
export type SecurityScore = z.infer<typeof SecurityScore>;
