import { createHash } from "node:crypto";
import type { BackupFrequency } from "@justmail/contracts";

/** Next fire time for a cadence, measured from a completed run. */
export function nextRun(from: Date, frequency: BackupFrequency): Date {
  const d = new Date(from.getTime());
  if (frequency === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** A schedule is due when enabled and its next run is unset or in the past. */
export function isDue(
  sched: { enabled: boolean; next_run_at: Date | null },
  now: Date,
): boolean {
  if (!sched.enabled) return false;
  return sched.next_run_at === null || sched.next_run_at <= now;
}

export function retentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * 86_400_000);
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Translate a libpq connection URL into environment variables for the pg
 * client binaries. Passing credentials via the environment keeps them off the
 * process argv (visible in `ps`) and out of shell history.
 */
export function pgEnvFromUrl(databaseUrl: string): {
  env: Record<string, string>;
  database: string;
} {
  const u = new URL(databaseUrl);
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres";
  const env: Record<string, string> = {
    PGHOST: decodeURIComponent(u.hostname),
    PGPORT: u.port || "5432",
    PGDATABASE: database,
  };
  if (u.username) env.PGUSER = decodeURIComponent(u.username);
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  const sslmode = u.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return { env, database };
}
