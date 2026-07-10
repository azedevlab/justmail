import { z } from "zod";
import { Email, Hostname, IsoDate, Uuid } from "./primitives.js";

export const DomainStatus = z.enum([
  "pending_verification",
  "verifying",
  "active",
  "suspended",
]);
export type DomainStatus = z.infer<typeof DomainStatus>;

export const OutboundMode = z.enum(["inherit", "direct", "smarthost"]);
export type OutboundMode = z.infer<typeof OutboundMode>;

export const Domain = z.object({
  id: Uuid,
  org_id: Uuid,
  name: Hostname,
  status: DomainStatus,
  verification_token: z.string(),
  is_primary: z.boolean(),
  catch_all_target: Email.nullable(),
  max_mailboxes: z.number().int().nullable(),
  max_quota_mb: z.number().int().nullable(),
  outbound_mode: OutboundMode,
  retention_days: z.number().int().nullable(),
  mailbox_count: z.number().int(),
  created_at: IsoDate,
});
export type Domain = z.infer<typeof Domain>;

export const CreateDomainRequest = z.object({
  name: Hostname,
  is_primary: z.boolean().optional(),
});
export type CreateDomainRequest = z.infer<typeof CreateDomainRequest>;

export const UpdateDomainRequest = z.object({
  is_primary: z.boolean().optional(),
  catch_all_target: Email.nullable().optional(),
  max_mailboxes: z.number().int().min(0).nullable().optional(),
  max_quota_mb: z.number().int().min(0).nullable().optional(),
  outbound_mode: OutboundMode.optional(),
  retention_days: z.number().int().min(1).nullable().optional(),
  status: z.enum(["active", "suspended"]).optional(),
});
export type UpdateDomainRequest = z.infer<typeof UpdateDomainRequest>;
