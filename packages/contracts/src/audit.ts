import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const AuditLog = z.object({
  id: Uuid,
  actor_type: z.string(),
  actor_id: z.string().nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  ip: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()),
  created_at: IsoDate,
});
export type AuditLog = z.infer<typeof AuditLog>;
