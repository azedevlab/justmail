import { z } from "zod";
import { OrgRole } from "./auth.js";
import { IsoDate } from "./primitives.js";

// Admin-facing SCIM configuration. The SCIM 2.0 protocol resources (User,
// Group, ListResponse, …) are RFC 7643/7644 wire formats handled inside the
// API and are not modelled here; this covers only JustMail's own control plane.

// Maps a SCIM group displayName to the org role its members receive. Highest
// matching role wins; members with no mapped group fall back to default_role.
export const ScimGroupRoleMap = z.record(z.string(), OrgRole);
export type ScimGroupRoleMap = z.infer<typeof ScimGroupRoleMap>;

export const ScimConfigRequest = z.object({
  enabled: z.boolean().default(true),
  default_role: OrgRole.default("member"),
  group_role_map: ScimGroupRoleMap.default({}),
  // Suspend the local account when the IdP sets active=false or deletes it.
  deactivate: z.boolean().default(true),
});
export type ScimConfigRequest = z.infer<typeof ScimConfigRequest>;

export const ScimConfig = z.object({
  org_id: z.string().uuid(),
  enabled: z.boolean(),
  base_url: z.string(),
  has_token: z.boolean(),
  token_prefix: z.string().nullable(),
  default_role: OrgRole,
  group_role_map: ScimGroupRoleMap,
  deactivate: z.boolean(),
  last_request_at: IsoDate.nullable(),
  user_count: z.number().int(),
  created_at: IsoDate,
  updated_at: IsoDate,
});
export type ScimConfig = z.infer<typeof ScimConfig>;

// Returned once, on token generation/rotation. The plaintext token is never
// stored or shown again.
export const ScimTokenResult = z.object({
  token: z.string(),
  base_url: z.string(),
});
export type ScimTokenResult = z.infer<typeof ScimTokenResult>;
