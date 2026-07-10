import { z } from "zod";
import { Email, IsoDate, Uuid } from "./primitives.js";
import { OrgRole } from "./auth.js";

export const Invite = z.object({
  id: Uuid,
  org_id: Uuid,
  email: Email,
  role: OrgRole,
  invited_by: Uuid.nullable(),
  expires_at: IsoDate,
  accepted_at: IsoDate.nullable(),
  created_at: IsoDate,
});
export type Invite = z.infer<typeof Invite>;

export const CreateInviteRequest = z.object({
  email: Email,
  role: OrgRole,
});
export type CreateInviteRequest = z.infer<typeof CreateInviteRequest>;

export const AcceptInviteRequest = z.object({
  password: z.string().min(12).max(256),
  name: z.string().min(1).max(200),
});
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequest>;

export const InvitePreview = z.object({
  org_name: z.string(),
  email: Email,
  role: OrgRole,
  needs_signup: z.boolean(),
});
export type InvitePreview = z.infer<typeof InvitePreview>;
