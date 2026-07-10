import { z } from "zod";
import { OrgRole } from "./auth.js";
import { IsoDate, Uuid } from "./primitives.js";

export const LdapEncryption = z.enum(["none", "starttls", "ldaps"]);
export type LdapEncryption = z.infer<typeof LdapEncryption>;

// Maps a directory group DN to the org role its members receive. Roles are
// resolved by picking the highest-ranked matching group; unmatched users fall
// back to the directory's default_role.
export const LdapGroupRoleMap = z.record(z.string(), OrgRole);
export type LdapGroupRoleMap = z.infer<typeof LdapGroupRoleMap>;

export const LdapDirectoryRequest = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  host: z.string().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65535).default(389),
  encryption: LdapEncryption.default("starttls"),
  verify_tls: z.boolean().default(true),
  bind_dn: z.string().min(1).max(1024),
  // Omitted on update keeps the stored password; empty string is rejected.
  bind_password: z.string().min(1).max(1024).optional(),
  base_dn: z.string().min(1).max(1024),
  user_filter: z.string().min(1).max(2048).default("(objectClass=person)"),
  group_filter: z.string().max(2048).optional(),
  email_attribute: z.string().min(1).max(128).default("mail"),
  name_attribute: z.string().min(1).max(128).default("cn"),
  uid_attribute: z.string().min(1).max(128).default("uid"),
  member_attribute: z.string().min(1).max(128).default("memberOf"),
  group_role_map: LdapGroupRoleMap.default({}),
  default_role: OrgRole.default("member"),
  deactivate_missing: z.boolean().default(true),
  sync_interval_minutes: z.coerce.number().int().min(5).max(10080).default(60),
});
export type LdapDirectoryRequest = z.infer<typeof LdapDirectoryRequest>;

export const LdapDirectory = z.object({
  id: Uuid,
  org_id: Uuid,
  name: z.string(),
  enabled: z.boolean(),
  host: z.string(),
  port: z.number().int(),
  encryption: LdapEncryption,
  verify_tls: z.boolean(),
  bind_dn: z.string(),
  has_bind_password: z.boolean(),
  base_dn: z.string(),
  user_filter: z.string(),
  group_filter: z.string().nullable(),
  email_attribute: z.string(),
  name_attribute: z.string(),
  uid_attribute: z.string(),
  member_attribute: z.string(),
  group_role_map: LdapGroupRoleMap,
  default_role: OrgRole,
  deactivate_missing: z.boolean(),
  sync_interval_minutes: z.number().int(),
  last_synced_at: IsoDate.nullable(),
  created_at: IsoDate,
  updated_at: IsoDate,
});
export type LdapDirectory = z.infer<typeof LdapDirectory>;

export const LdapSyncRun = z.object({
  id: Uuid,
  directory_id: Uuid,
  status: z.enum(["running", "ok", "error"]),
  created_count: z.number().int(),
  updated_count: z.number().int(),
  deactivated_count: z.number().int(),
  error: z.string().nullable(),
  started_at: IsoDate,
  finished_at: IsoDate.nullable(),
});
export type LdapSyncRun = z.infer<typeof LdapSyncRun>;

export const LdapTestResult = z.object({
  ok: z.boolean(),
  message: z.string(),
  user_count: z.number().int(),
  sample_users: z.array(
    z.object({
      email: z.string().nullable(),
      name: z.string().nullable(),
      uid: z.string().nullable(),
      groups: z.array(z.string()),
    }),
  ),
});
export type LdapTestResult = z.infer<typeof LdapTestResult>;
