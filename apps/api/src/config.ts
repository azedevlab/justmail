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
