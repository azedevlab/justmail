import { z } from "zod";
import { Email, IsoDate, LocalPart, Uuid } from "./primitives.js";

export const MailboxStatus = z.enum(["active", "suspended", "disabled"]);
export type MailboxStatus = z.infer<typeof MailboxStatus>;

export const Autoresponder = z.object({
  enabled: z.boolean(),
  subject: z.string().max(200).default(""),
  body: z.string().max(4000).default(""),
  starts_at: IsoDate.nullable().optional(),
  ends_at: IsoDate.nullable().optional(),
});
export type Autoresponder = z.infer<typeof Autoresponder>;

export const Mailbox = z.object({
  id: Uuid,
  domain_id: Uuid,
  domain_name: z.string(),
  team_id: Uuid.nullable(),
  local_part: z.string(),
  address: z.string(),
  name: z.string(),
  quota_mb: z.number().int(),
  quota_used_bytes: z.number().int(),
  status: MailboxStatus,
  imap_enabled: z.boolean(),
  pop3_enabled: z.boolean(),
  smtp_enabled: z.boolean(),
  sieve_enabled: z.boolean(),
  autoresponder: Autoresponder.nullable(),
  forward_to: z.array(Email),
  forward_keep_copy: z.boolean(),
  created_at: IsoDate,
});
export type Mailbox = z.infer<typeof Mailbox>;

export const CreateMailboxRequest = z.object({
  local_part: LocalPart,
  name: z.string().max(200).default(""),
  password: z.string().min(10).max(256),
  quota_mb: z
    .number()
    .int()
    .min(0)
    .max(1024 * 1024)
    .default(1024),
  team_id: Uuid.nullable().optional(),
});
export type CreateMailboxRequest = z.infer<typeof CreateMailboxRequest>;

export const UpdateMailboxRequest = z.object({
  name: z.string().max(200).optional(),
  quota_mb: z
    .number()
    .int()
    .min(0)
    .max(1024 * 1024)
    .optional(),
  status: MailboxStatus.optional(),
  imap_enabled: z.boolean().optional(),
  pop3_enabled: z.boolean().optional(),
  smtp_enabled: z.boolean().optional(),
  sieve_enabled: z.boolean().optional(),
  autoresponder: Autoresponder.nullable().optional(),
  forward_to: z.array(Email).max(10).optional(),
  forward_keep_copy: z.boolean().optional(),
  team_id: Uuid.nullable().optional(),
});
export type UpdateMailboxRequest = z.infer<typeof UpdateMailboxRequest>;

export const SetMailboxPasswordRequest = z.object({
  password: z.string().min(10).max(256),
});
export type SetMailboxPasswordRequest = z.infer<
  typeof SetMailboxPasswordRequest
>;
