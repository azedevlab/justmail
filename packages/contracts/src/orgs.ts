import { z } from "zod";
import { Email, IsoDate, Slug, Uuid } from "./primitives.js";
import { OrgRole } from "./auth.js";

export const Org = z.object({
  id: Uuid,
  name: z.string(),
  slug: Slug,
  plan: z.string(),
  created_at: IsoDate,
});
export type Org = z.infer<typeof Org>;

export const CreateOrgRequest = z.object({
  name: z.string().min(1).max(200),
  slug: Slug.optional(),
});
export type CreateOrgRequest = z.infer<typeof CreateOrgRequest>;

export const UpdateOrgRequest = z.object({
  name: z.string().min(1).max(200).optional(),
});
export type UpdateOrgRequest = z.infer<typeof UpdateOrgRequest>;

export const OrgQuota = z.object({
  org_id: Uuid,
  // Allocation ceiling in MB; null means unlimited.
  storage_quota_mb: z.number().int().nonnegative().nullable(),
  // Sum of every mailbox's quota_mb in the org (allocated capacity).
  allocated_mb: z.number().int().nonnegative(),
  // Sum of actual bytes stored across the org's mailboxes.
  used_bytes: z.number().int().nonnegative(),
  mailbox_count: z.number().int().nonnegative(),
});
export type OrgQuota = z.infer<typeof OrgQuota>;

export const UpdateQuotaRequest = z.object({
  storage_quota_mb: z.number().int().nonnegative().nullable(),
});
export type UpdateQuotaRequest = z.infer<typeof UpdateQuotaRequest>;

export const OrgMember = z.object({
  user_id: Uuid,
  email: Email,
  name: z.string(),
  role: OrgRole,
  team_id: Uuid.nullable(),
  created_at: IsoDate,
});
export type OrgMember = z.infer<typeof OrgMember>;

export const AddMemberRequest = z.object({
  email: Email,
  role: OrgRole,
  team_id: Uuid.nullable().optional(),
});
export type AddMemberRequest = z.infer<typeof AddMemberRequest>;

export const UpdateMemberRequest = z.object({
  role: OrgRole.optional(),
  team_id: Uuid.nullable().optional(),
});
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequest>;

export const Team = z.object({
  id: Uuid,
  org_id: Uuid,
  name: z.string(),
  slug: Slug,
  created_at: IsoDate,
});
export type Team = z.infer<typeof Team>;

export const CreateTeamRequest = z.object({
  name: z.string().min(1).max(200),
  slug: Slug.optional(),
});
export type CreateTeamRequest = z.infer<typeof CreateTeamRequest>;
