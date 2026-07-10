import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().url(),
  DATABASE_READONLY_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().min(32),
  EVENTS_INGEST_TOKEN: z.string().min(16),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  DKIM_DIR: z.string().default("/var/lib/justmail/dkim"),
  MAIL_HOSTNAME: z.string().default("mail.localhost"),

  // Internal mail service discovery (compose service names by default).
  IMAP_HOST: z.string().default("dovecot"),
  IMAP_PORT: z.coerce.number().int().positive().default(993),
  IMAP_TLS_REJECT_UNAUTHORIZED: z.coerce.boolean().default(false),
  // Pooled IMAP connections: cap total open clients and evict ones idle beyond
  // the TTL. Sized for a small deployment; raise for higher concurrency.
  IMAP_POOL_MAX: z.coerce.number().int().positive().default(256),
  IMAP_POOL_IDLE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  SMTP_HOST: z.string().default("postfix"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_TLS_REJECT_UNAUTHORIZED: z.coerce.boolean().default(false),

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
