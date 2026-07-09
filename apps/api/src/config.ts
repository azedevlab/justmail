import { z } from "zod";

const Env = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().min(32),
  EVENTS_INGEST_TOKEN: z.string().min(16),
  JM_WEB_HOST: z.string().optional(),
  JM_API_HOST: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  DKIM_DIR: z.string().default("/var/lib/justmail/dkim"),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  MAIL_HOSTNAME: z.string().default("mail.devlab.az"),
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
