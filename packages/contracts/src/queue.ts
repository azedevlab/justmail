import { z } from "zod";
import { IsoDate } from "./primitives.js";

export const QueueSnapshot = z.object({
  active: z.number().int(),
  deferred: z.number().int(),
  hold: z.number().int(),
  oldest_age_s: z.number().int(),
  taken_at: IsoDate.nullable(),
});
export type QueueSnapshot = z.infer<typeof QueueSnapshot>;

export const DeferredEntry = z.object({
  queue_id: z.string(),
  from_addr: z.string().nullable(),
  to_addr: z.string().nullable(),
  dsn: z.string().nullable(),
  last_seen: IsoDate,
  attempts: z.number().int(),
});
export type DeferredEntry = z.infer<typeof DeferredEntry>;

export const TraceStep = z.object({
  event: z.string(),
  direction: z.enum(["inbound", "outbound"]).nullable(),
  from_addr: z.string().nullable(),
  to_addr: z.string().nullable(),
  relay: z.string().nullable(),
  dsn: z.string().nullable(),
  spam_score: z.number().nullable(),
  spam_action: z.string().nullable(),
  tls_version: z.string().nullable(),
  size_bytes: z.number().int().nullable(),
  detail: z.string().nullable(),
  occurred_at: IsoDate,
});
export type TraceStep = z.infer<typeof TraceStep>;
