import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const RetentionPolicy = z.object({
  org_id: Uuid,
  enabled: z.boolean(),
  // Messages older than this many days are expunged; null = keep forever.
  delete_after_days: z.number().int().positive().nullable(),
  folders: z.array(z.string()),
  // True only when the deployment has a Dovecot master credential configured;
  // without it, pruning cannot run and the UI surfaces the requirement.
  master_configured: z.boolean(),
  updated_at: IsoDate,
});
export type RetentionPolicy = z.infer<typeof RetentionPolicy>;

export const UpdateRetentionRequest = z.object({
  enabled: z.boolean().optional(),
  delete_after_days: z.number().int().positive().nullable().optional(),
  folders: z.array(z.string().min(1).max(255)).max(64).optional(),
});
export type UpdateRetentionRequest = z.infer<typeof UpdateRetentionRequest>;

export const LegalHold = z.object({
  id: Uuid,
  org_id: Uuid,
  // null = the whole org is held.
  mailbox_id: Uuid.nullable(),
  mailbox_address: z.string().nullable(),
  reason: z.string(),
  created_by: Uuid.nullable(),
  created_at: IsoDate,
  released_at: IsoDate.nullable(),
});
export type LegalHold = z.infer<typeof LegalHold>;

export const CreateLegalHoldRequest = z.object({
  mailbox_id: Uuid.nullable().optional(),
  reason: z.string().max(2000).optional(),
});
export type CreateLegalHoldRequest = z.infer<typeof CreateLegalHoldRequest>;

export const MailboxExport = z.object({
  id: Uuid,
  org_id: Uuid,
  mailbox_id: Uuid,
  mailbox_address: z.string().nullable(),
  format: z.literal("mbox"),
  status: z.enum(["pending", "running", "done", "error"]),
  message_count: z.number().int().nonnegative(),
  size_bytes: z.number().int().nonnegative(),
  error: z.string().nullable(),
  created_at: IsoDate,
  finished_at: IsoDate.nullable(),
});
export type MailboxExport = z.infer<typeof MailboxExport>;

export const CreateExportRequest = z.object({
  mailbox_id: Uuid,
});
export type CreateExportRequest = z.infer<typeof CreateExportRequest>;
