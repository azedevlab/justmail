import { z } from "zod";

// ── RFC 9457 problem details ─────────────────────────────────────────────────

export const Problem = z.object({
  type: z.string().default("about:blank"),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  errors: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
export type Problem = z.infer<typeof Problem>;

// ── Auth ─────────────────────────────────────────────────────────────────────

export const OrgRole = z.enum(["owner", "admin", "member", "viewer"]);
export type OrgRole = z.infer<typeof OrgRole>;

export const BootstrapRequest = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
  name: z.string().min(1).max(200),
  org_name: z.string().min(1).max(200),
});
export type BootstrapRequest = z.infer<typeof BootstrapRequest>;

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
  totp_code: z.string().regex(/^\d{6}$/).optional(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SessionOrg = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  role: OrgRole,
});
export type SessionOrg = z.infer<typeof SessionOrg>;

export const Me = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  totp_enabled: z.boolean(),
  orgs: z.array(SessionOrg),
});
export type Me = z.infer<typeof Me>;

export const SessionInfo = z.object({
  id: z.string().uuid(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  current: z.boolean(),
});
export type SessionInfo = z.infer<typeof SessionInfo>;

export const TwoFaSetupResponse = z.object({
  secret: z.string(),
  otpauth_url: z.string(),
});
export type TwoFaSetupResponse = z.infer<typeof TwoFaSetupResponse>;

export const TwoFaVerifyRequest = z.object({
  totp_code: z.string().regex(/^\d{6}$/),
});
export type TwoFaVerifyRequest = z.infer<typeof TwoFaVerifyRequest>;

export const TwoFaDisableRequest = z.object({
  password: z.string().min(1).max(256),
});
export type TwoFaDisableRequest = z.infer<typeof TwoFaDisableRequest>;

// ── Organizations ────────────────────────────────────────────────────────────

export const Org = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  plan: z.string(),
  created_at: z.string(),
});
export type Org = z.infer<typeof Org>;

export const CreateOrgRequest = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
    .optional(),
});
export type CreateOrgRequest = z.infer<typeof CreateOrgRequest>;

export const UpdateOrgRequest = z.object({
  name: z.string().min(1).max(200).optional(),
});
export type UpdateOrgRequest = z.infer<typeof UpdateOrgRequest>;

export const OrgMember = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: OrgRole,
  created_at: z.string(),
});
export type OrgMember = z.infer<typeof OrgMember>;

export const AddMemberRequest = z.object({
  email: z.string().email(),
  role: OrgRole,
});
export type AddMemberRequest = z.infer<typeof AddMemberRequest>;

export const UpdateMemberRequest = z.object({
  role: OrgRole,
});
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequest>;

// ── Domains ──────────────────────────────────────────────────────────────────

// RFC 1035 host label (a-z0-9, hyphen not at edges), joined with dots.
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const LOCAL_PART = /^[a-z0-9._%+-]{1,64}$/;

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
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string(),
  status: DomainStatus,
  verification_token: z.string(),
  is_primary: z.boolean(),
  catch_all_target: z.string().email().nullable(),
  max_mailboxes: z.number().int().nullable(),
  max_quota_mb: z.number().int().nullable(),
  outbound_mode: OutboundMode,
  mailbox_count: z.number().int(),
  created_at: z.string(),
});
export type Domain = z.infer<typeof Domain>;

export const CreateDomainRequest = z.object({
  name: z.string().regex(HOSTNAME, "must be a valid domain"),
  is_primary: z.boolean().optional(),
});
export type CreateDomainRequest = z.infer<typeof CreateDomainRequest>;

export const UpdateDomainRequest = z.object({
  is_primary: z.boolean().optional(),
  catch_all_target: z.string().email().nullable().optional(),
  max_mailboxes: z.number().int().min(0).nullable().optional(),
  max_quota_mb: z.number().int().min(0).nullable().optional(),
  outbound_mode: OutboundMode.optional(),
  status: z.enum(["active", "suspended"]).optional(),
});
export type UpdateDomainRequest = z.infer<typeof UpdateDomainRequest>;

export const DnsRecord = z.object({
  id: z.string().uuid(),
  purpose: z.enum([
    "mx",
    "spf",
    "dkim",
    "dmarc",
    "verification",
    "mta_sts",
    "tls_rpt",
    "autoconfig",
    "autodiscover",
    "bimi",
    "caa",
    "custom",
  ]),
  type: z.string(),
  name: z.string(),
  content: z.string(),
  ttl: z.number().int(),
  priority: z.number().int().nullable(),
  observed_content: z.string().nullable(),
  check_status: z.enum([
    "unknown",
    "pending",
    "propagating",
    "ok",
    "drifted",
    "missing",
    "error",
  ]),
  last_checked_at: z.string().nullable(),
});
export type DnsRecord = z.infer<typeof DnsRecord>;

export const DomainVerifyResponse = z.object({
  status: DomainStatus,
  records: z.array(DnsRecord),
});
export type DomainVerifyResponse = z.infer<typeof DomainVerifyResponse>;

// ── Mailboxes ────────────────────────────────────────────────────────────────

export const MailboxStatus = z.enum(["active", "suspended", "disabled"]);
export type MailboxStatus = z.infer<typeof MailboxStatus>;

export const Autoresponder = z.object({
  enabled: z.boolean(),
  subject: z.string().max(200).default(""),
  body: z.string().max(4000).default(""),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});
export type Autoresponder = z.infer<typeof Autoresponder>;

export const Mailbox = z.object({
  id: z.string().uuid(),
  domain_id: z.string().uuid(),
  domain_name: z.string(),
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
  forward_to: z.array(z.string().email()),
  forward_keep_copy: z.boolean(),
  created_at: z.string(),
});
export type Mailbox = z.infer<typeof Mailbox>;

export const CreateMailboxRequest = z.object({
  local_part: z.string().regex(LOCAL_PART, "invalid local part"),
  name: z.string().max(200).default(""),
  password: z.string().min(10).max(256),
  quota_mb: z.number().int().min(0).max(1024 * 1024).default(1024),
});
export type CreateMailboxRequest = z.infer<typeof CreateMailboxRequest>;

export const UpdateMailboxRequest = z.object({
  name: z.string().max(200).optional(),
  quota_mb: z.number().int().min(0).max(1024 * 1024).optional(),
  status: MailboxStatus.optional(),
  imap_enabled: z.boolean().optional(),
  pop3_enabled: z.boolean().optional(),
  smtp_enabled: z.boolean().optional(),
  sieve_enabled: z.boolean().optional(),
  autoresponder: Autoresponder.nullable().optional(),
  forward_to: z.array(z.string().email()).max(10).optional(),
  forward_keep_copy: z.boolean().optional(),
});
export type UpdateMailboxRequest = z.infer<typeof UpdateMailboxRequest>;

export const SetMailboxPasswordRequest = z.object({
  password: z.string().min(10).max(256),
});
export type SetMailboxPasswordRequest = z.infer<typeof SetMailboxPasswordRequest>;

// ── Aliases ──────────────────────────────────────────────────────────────────

export const Alias = z.object({
  id: z.string().uuid(),
  domain_id: z.string().uuid(),
  domain_name: z.string(),
  source: z.string(),
  address: z.string(),
  destinations: z.array(z.string().email()),
  enabled: z.boolean(),
  created_at: z.string(),
});
export type Alias = z.infer<typeof Alias>;

export const CreateAliasRequest = z.object({
  source: z.string().regex(LOCAL_PART, "invalid source local part"),
  destinations: z.array(z.string().email()).min(1).max(20),
  enabled: z.boolean().optional(),
});
export type CreateAliasRequest = z.infer<typeof CreateAliasRequest>;

export const UpdateAliasRequest = z.object({
  destinations: z.array(z.string().email()).min(1).max(20).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateAliasRequest = z.infer<typeof UpdateAliasRequest>;

// ── Dashboard ────────────────────────────────────────────────────────────────

export const DashboardOverview = z.object({
  domains: z.object({ total: z.number(), active: z.number() }),
  mailboxes: z.object({ total: z.number(), active: z.number(), suspended: z.number() }),
  quota: z.object({ used_bytes: z.number(), allocated_mb: z.number() }),
  events_24h: z.object({
    inbound: z.number(),
    outbound: z.number(),
    rejected: z.number(),
    deferred: z.number(),
  }),
  queue: z.object({
    active: z.number(),
    deferred: z.number(),
    hold: z.number(),
    oldest_age_s: z.number(),
  }),
});
export type DashboardOverview = z.infer<typeof DashboardOverview>;

// ── Security ─────────────────────────────────────────────────────────────────

export const BlockedIp = z.object({
  id: z.string().uuid(),
  ip: z.string(),
  source: z.enum(["fail2ban", "manual", "country"]),
  reason: z.string(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
});
export type BlockedIp = z.infer<typeof BlockedIp>;

export const CreateBlockedIpRequest = z.object({
  ip: z.string().min(2).max(64),
  reason: z.string().max(500).default(""),
  expires_at: z.string().nullable().optional(),
});
export type CreateBlockedIpRequest = z.infer<typeof CreateBlockedIpRequest>;

// ── Settings ─────────────────────────────────────────────────────────────────

export const SettingRow = z.object({
  key: z.string(),
  value: z.unknown(),
  updated_at: z.string(),
});
export type SettingRow = z.infer<typeof SettingRow>;

export const UpsertSettingRequest = z.object({
  value: z.unknown(),
});
export type UpsertSettingRequest = z.infer<typeof UpsertSettingRequest>;

// ── Invites ──────────────────────────────────────────────────────────────────

export const Invite = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  email: z.string().email(),
  role: OrgRole,
  invited_by: z.string().uuid().nullable(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
  created_at: z.string(),
});
export type Invite = z.infer<typeof Invite>;

export const CreateInviteRequest = z.object({
  email: z.string().email(),
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
  email: z.string().email(),
  role: OrgRole,
  needs_signup: z.boolean(),
});
export type InvitePreview = z.infer<typeof InvitePreview>;

// ── API keys ─────────────────────────────────────────────────────────────────

export const ApiKey = z.object({
  id: z.string().uuid(),
  name: z.string(),
  key_prefix: z.string(),
  scopes: z.array(z.string()),
  last_used_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  revoked_at: z.string().nullable(),
});
export type ApiKey = z.infer<typeof ApiKey>;

export const CreateApiKeyRequest = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.string().min(1).max(100)).max(64).default([]),
  expires_at: z.string().nullable().optional(),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequest>;

export const CreatedApiKey = ApiKey.extend({
  token: z.string(),
});
export type CreatedApiKey = z.infer<typeof CreatedApiKey>;

// ── Webhooks ─────────────────────────────────────────────────────────────────

export const WebhookEndpoint = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()),
  active: z.boolean(),
  last_delivered_at: z.string().nullable(),
  last_status: z.number().int().nullable(),
  failure_count: z.number().int(),
  created_at: z.string(),
});
export type WebhookEndpoint = z.infer<typeof WebhookEndpoint>;

export const CreateWebhookRequest = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1).max(100)).min(1).max(64),
});
export type CreateWebhookRequest = z.infer<typeof CreateWebhookRequest>;

export const CreatedWebhook = WebhookEndpoint.extend({
  secret: z.string(),
});
export type CreatedWebhook = z.infer<typeof CreatedWebhook>;

export const WebhookDelivery = z.object({
  id: z.string().uuid(),
  event: z.string(),
  status: z.number().int().nullable(),
  attempts: z.number().int(),
  next_attempt_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
});
export type WebhookDelivery = z.infer<typeof WebhookDelivery>;

// ── Backups ──────────────────────────────────────────────────────────────────

export const BackupSchedule = z.object({
  org_id: z.string().uuid(),
  destination: z.string(),
  kinds: z.array(z.enum(["full", "mail", "db"])),
  retention_days: z.number().int(),
  enabled: z.boolean(),
  updated_at: z.string(),
});
export type BackupSchedule = z.infer<typeof BackupSchedule>;

export const UpdateBackupScheduleRequest = z.object({
  destination: z.string().max(500).optional(),
  kinds: z.array(z.enum(["full", "mail", "db"])).min(1).optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateBackupScheduleRequest = z.infer<typeof UpdateBackupScheduleRequest>;

export const BackupRun = z.object({
  id: z.string().uuid(),
  kind: z.enum(["full", "mail", "db"]),
  destination: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  size_bytes: z.number().int().nullable(),
  snapshot_ref: z.string().nullable(),
  error: z.string().nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
});
export type BackupRun = z.infer<typeof BackupRun>;

// ── DMARC ────────────────────────────────────────────────────────────────────

export const DmarcReport = z.object({
  id: z.string().uuid(),
  reporter: z.string(),
  begin_ts: z.string(),
  end_ts: z.string(),
  pass: z.number().int(),
  fail: z.number().int(),
  created_at: z.string(),
  domain_name: z.string().nullable(),
});
export type DmarcReport = z.infer<typeof DmarcReport>;
