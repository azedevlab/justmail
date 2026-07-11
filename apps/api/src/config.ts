import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().url(),
  DATABASE_READONLY_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).default(2),
  ENCRYPTION_KEY: z.string().min(32),
  EVENTS_INGEST_TOKEN: z.string().min(16),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  DKIM_DIR: z.string().default("/var/lib/justmail/dkim"),
  // Automatic DKIM key rotation (worker). Opt-in: only rotates when Cloudflare
  // publishing is configured, and never promotes a fresh selector to signing
  // until its TXT record actually resolves — so rotation can't break signing.
  DKIM_ROTATION_ENABLED: z.coerce.boolean().default(false),
  DKIM_ROTATION_DAYS: z.coerce.number().int().positive().default(90),
  DKIM_ROTATION_OVERLAP_HOURS: z.coerce.number().int().positive().default(24),
  DKIM_ROTATION_POLL_SECONDS: z.coerce.number().int().positive().default(3600),
  MAIL_HOSTNAME: z.string().default("mail.localhost"),

  // Internal mail service discovery (compose service names by default).
  IMAP_HOST: z.string().default("dovecot"),
  IMAP_PORT: z.coerce.number().int().positive().default(993),
  IMAP_TLS_REJECT_UNAUTHORIZED: z.coerce.boolean().default(false),
  // Pooled IMAP connections: cap total open clients and evict ones idle beyond
  // the TTL. Sized for a small deployment; raise for higher concurrency.
  IMAP_POOL_MAX: z.coerce.number().int().positive().default(256),
  IMAP_POOL_IDLE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  // Dovecot master user for admin-level mailbox access (retention pruning and
  // exports). Login is `<address>*<master-user>` with the master password.
  // Both optional: when unset, retention/export features stay disabled.
  DOVECOT_MASTER_USER: z.string().optional(),
  DOVECOT_MASTER_PASSWORD: z.string().optional(),

  SMTP_HOST: z.string().default("postfix"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_TLS_REJECT_UNAUTHORIZED: z.coerce.boolean().default(false),

  // ManageSieve (RFC 5804) for uploading per-user filter scripts. STARTTLS is
  // negotiated on the plaintext port; auth reuses the unlocked mailbox creds.
  SIEVE_HOST: z.string().default("dovecot"),
  SIEVE_PORT: z.coerce.number().int().positive().default(4190),
  SIEVE_TLS_REJECT_UNAUTHORIZED: z.coerce.boolean().default(false),
  SIEVE_SCRIPT_NAME: z.string().default("justmail"),
  SIEVE_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(15),

  // Radicale CardDAV/CalDAV store. The API reaches it over the internal network
  // and brokers per-user access with the X-Remote-User header (Radicale trusts
  // it there); external clients authenticate via the caldav.* proxy instead.
  RADICALE_URL: z.string().url().default("http://radicale:5232"),
  RADICALE_CONTACTS_COLLECTION: z.string().default("contacts"),
  RADICALE_CALENDAR_COLLECTION: z.string().default("calendar"),

  // Thumbnail generation (sharp) for image attachments.
  THUMBNAIL_ENABLED: z.coerce.boolean().default(true),
  THUMBNAIL_MAX_DIM: z.coerce.number().int().positive().default(320),
  THUMBNAIL_QUALITY: z.coerce.number().int().min(1).max(100).default(72),
  THUMBNAIL_SOURCE_MAX_BYTES: z.coerce.number().int().positive().default(25_000_000),

  // clamd (antivirus) INSTREAM scan on send. Disable in dev where no clamav runs.
  CLAMAV_ENABLED: z.coerce.boolean().default(true),
  CLAMAV_HOST: z.string().default("clamav"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  CLAMAV_CHUNK_BYTES: z.coerce.number().int().positive().default(65_536),

  // Webmail limits (bytes / counts). Defaults are conservative; raise per deploy.
  WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES: z.coerce.number().int().positive().default(15_000_000),
  WEBMAIL_ATTACHMENT_MAX_COUNT: z.coerce.number().int().positive().default(16),
  WEBMAIL_ATTACHMENT_INLINE_MAX_BYTES: z.coerce.number().int().positive().default(2_000_000),
  WEBMAIL_SEND_BODY_LIMIT: z.string().default("32mb"),
  WEBMAIL_MESSAGE_LIST_MAX: z.coerce.number().int().positive().default(200),
  // Sliding TTL for an unlocked-mailbox credential. Refreshed on each use, so
  // it expires after this many seconds of inactivity rather than living forever.
  WEBMAIL_CREDENTIAL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  // Short TTL for the folder/message-list read cache. Kept small because it is
  // busted on mutations and IDLE notifications; this only bounds cross-session
  // staleness for folders the session is not actively watching.
  WEBMAIL_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(20),

  // Undo-send: every send is held for this many seconds before dispatch so the
  // user can cancel it. A user-chosen send_at overrides this delay.
  WEBMAIL_UNDO_SEND_SECONDS: z.coerce.number().int().min(0).default(10),
  // Upper bound on how far ahead a scheduled send may be placed.
  WEBMAIL_SCHEDULED_SEND_MAX_DAYS: z.coerce.number().int().positive().default(30),
  // Worker dispatch loop: how often due sends are claimed, and the retry/backoff
  // budget for a send that fails at the SMTP step.
  WEBMAIL_SEND_POLL_SECONDS: z.coerce.number().int().positive().default(3),
  WEBMAIL_SEND_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WEBMAIL_SEND_RETRY_SECONDS: z.coerce.number().int().positive().default(60),
  // A 'sending' row older than this was stranded by a crashed dispatch; reclaim it.
  WEBMAIL_SEND_CLAIM_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),

  // Web Push (VAPID). Both keys are optional so the API boots without them;
  // push delivery is simply disabled until they are set. Generate a pair with
  // `npx web-push generate-vapid-keys`. The subject must be a mailto: or https
  // URL identifying the sender; it defaults to postmaster@MAIL_HOSTNAME.
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().optional(),
  WEB_PUSH_SUBJECT: z.string().optional(),

  // Single sign-on (OIDC/SAML). Callbacks must be reachable by the browser and
  // exactly match what is registered at the IdP; the base defaults to the public
  // API host. After login the user is returned to a relay target — an allow-list
  // built from the admin/webmail hosts, defaulting to the admin console.
  SSO_CALLBACK_BASE_URL: z.string().url().optional(),
  SSO_DEFAULT_RELAY_URL: z.string().url().optional(),
  SSO_FLOW_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  // OIDC discovery/JWKS HTTP fetch: request timeout and how long the fetched
  // documents are cached before a re-fetch.
  OIDC_HTTP_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(8),
  OIDC_METADATA_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // Backups. The worker shells out to these client binaries against
  // DATABASE_URL; override the paths if they are not on $PATH. The due-check
  // loop interval bounds how promptly a scheduled backup fires.
  PG_DUMP_BIN: z.string().default("pg_dump"),
  PG_RESTORE_BIN: z.string().default("pg_restore"),
  BACKUP_POLL_SECONDS: z.coerce.number().int().positive().default(300),

  // Worker tick cadences (seconds). Each background loop's poll interval; the
  // loop body no-ops when nothing is due, so these bound latency, not load.
  WEBHOOK_POLL_SECONDS: z.coerce.number().int().positive().default(5),
  WEBHOOK_DELIVERY_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  QUEUE_SNAPSHOT_POLL_SECONDS: z.coerce.number().int().positive().default(60),
  DNSBL_POLL_SECONDS: z.coerce.number().int().positive().default(1800),
  DNS_RECHECK_POLL_SECONDS: z.coerce.number().int().positive().default(300),
  CRED_SWEEP_POLL_SECONDS: z.coerce.number().int().positive().default(600),
  LDAP_POLL_SECONDS: z.coerce.number().int().positive().default(60),
  RETENTION_POLL_SECONDS: z.coerce.number().int().positive().default(3600),

  // Rate limiting (window seconds / max hits). Generous defaults; tune per deploy.
  RATE_LIMIT_GLOBAL_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),

  // Hostnames — kept optional so the API boots in dev without a full stack.
  JM_WEB_HOST: z.string().optional(),
  JM_ADMIN_HOST: z.string().optional(),
  JM_WEBMAIL_HOST: z.string().optional(),
  JM_LANDING_HOST: z.string().optional(),
  JM_API_HOST: z.string().optional(),

  // WebAuthn / passkeys. RP ID must be a registrable suffix shared by the admin
  // and webmail origins; defaults to the parent cookie domain (JM_WEB_HOST) or
  // "localhost" in dev. Extra allowed browser origins can be listed
  // comma-separated (defaults to the https origins of the app hosts).
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_RP_NAME: z.string().default("JustMail"),
  WEBAUTHN_ORIGINS: z.string().optional(),
  WEBAUTHN_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // DNS provider
  DNS_PROVIDER: z.enum(["cloudflare", "route53", "desec", "none"]).default("cloudflare"),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  // Storage adapter
  STORAGE_KIND: z
    .enum(["local", "s3", "r2", "minio", "b2", "azure", "gcs"])
    .default("local"),
  STORAGE_LOCAL_PATH: z.string().default("/opt/justmail/attachments"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
});

export type Config = z.infer<typeof Env>;

function load(): Config {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export const config = load();
