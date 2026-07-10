import { z } from "zod";

/**
 * Runtime environment schema shared by every JustMail process (api, workers,
 * cli). Fail-fast at boot: an invalid env is a fatal error, never a silent
 * bug.
 */
export const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),

  // Data plane wires
  DATABASE_URL: z.string().url(),
  DATABASE_READONLY_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),

  // Secrets (never in the repo)
  ENCRYPTION_KEY: z.string().min(32),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  EVENTS_INGEST_TOKEN: z.string().min(16),

  // Hostnames
  JM_WEB_HOST: z.string().optional(),
  JM_ADMIN_HOST: z.string().optional(),
  JM_WEBMAIL_HOST: z.string().optional(),
  JM_LANDING_HOST: z.string().optional(),
  JM_API_HOST: z.string().optional(),
  MAIL_HOSTNAME: z.string().default("mail.localhost"),

  // DNS provider (Cloudflare v1.0 first-party)
  DNS_PROVIDER: z
    .enum(["cloudflare", "route53", "desec", "none"])
    .default("cloudflare"),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  ROUTE53_ACCESS_KEY_ID: z.string().optional(),
  ROUTE53_SECRET_ACCESS_KEY: z.string().optional(),
  DESEC_TOKEN: z.string().optional(),

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
  STORAGE_CDN_URL: z.string().optional(),

  // Mail plane
  DKIM_DIR: z.string().default("/var/lib/justmail/dkim"),
  OUTBOUND_MODE: z.enum(["direct", "smarthost"]).default("direct"),
  RELAYHOST: z.string().optional(),

  // Feature flags
  ENABLE_WEB_PUSH: z.coerce.boolean().default(true),
  ENABLE_PLUGINS: z.coerce.boolean().default(true),
  ENABLE_WEBAUTHN: z.coerce.boolean().default(true),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof Env>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`Invalid environment:\n  ${issues}`);
  }
  return parsed.data;
}
