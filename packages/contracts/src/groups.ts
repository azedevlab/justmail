import { z } from "zod";
import { Email, IsoDate, LocalPart, Uuid } from "./primitives.js";

// A mail group (distribution list): one address that fans a delivered message
// out to every member. Backed by the mail_aliases view so Postfix expands it at
// delivery time exactly like an alias.
export const MailGroup = z.object({
  id: Uuid,
  domain_id: Uuid,
  domain_name: z.string(),
  local_part: z.string(),
  address: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  // When true, members may send outbound mail using the group address as From.
  allow_member_send: z.boolean(),
  member_count: z.number().int(),
  created_at: IsoDate,
});
export type MailGroup = z.infer<typeof MailGroup>;

export const MailGroupMember = z.object({
  id: Uuid,
  address: Email,
  created_at: IsoDate,
});
export type MailGroupMember = z.infer<typeof MailGroupMember>;

export const MailGroupDetail = MailGroup.extend({
  members: z.array(MailGroupMember),
});
export type MailGroupDetail = z.infer<typeof MailGroupDetail>;

export const CreateMailGroupRequest = z.object({
  local_part: LocalPart,
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  members: z.array(Email).max(1000).default([]),
  enabled: z.boolean().optional(),
  allow_member_send: z.boolean().optional(),
});
export type CreateMailGroupRequest = z.infer<typeof CreateMailGroupRequest>;

export const UpdateMailGroupRequest = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  allow_member_send: z.boolean().optional(),
});
export type UpdateMailGroupRequest = z.infer<typeof UpdateMailGroupRequest>;

export const MailGroupMembersRequest = z.object({
  members: z.array(Email).max(1000),
});
export type MailGroupMembersRequest = z.infer<typeof MailGroupMembersRequest>;
