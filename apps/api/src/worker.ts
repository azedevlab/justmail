import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { Pool } from "pg";
import { AppModule } from "./app.module";
import { Db } from "./db/db.service";
import { runMigrations } from "./db/migrate";
import { WebhooksService } from "./webhooks/webhooks.service";
import { QueueSnapshotService } from "./worker/queue-snapshot.service";
import { DnsblService } from "./worker/dnsbl.service";
import { WebmailCredentialStore } from "./webmail/credential.store";
import { WebmailService } from "./webmail/webmail.service";
import { LdapService } from "./ldap/ldap.service";
import { RetentionService } from "./retention/retention.service";
import { BackupEngine } from "./backups/backup-engine.service";
import { DkimService } from "./dkim/dkim.service";
import { DnsService } from "./dkim/dns.service";
import { config } from "./config";

// Ticks: each background loop no-ops when nothing is due, so its cadence bounds
// latency, not load. All intervals are config-driven (seconds → ms). LDAP polls
// frequently but each directory honours its own configured interval.
const WEBHOOK_MS = config.WEBHOOK_POLL_SECONDS * 1_000;
const QUEUE_MS = config.QUEUE_SNAPSHOT_POLL_SECONDS * 1_000;
const DNSBL_MS = config.DNSBL_POLL_SECONDS * 1_000;
const CRED_SWEEP_MS = config.CRED_SWEEP_POLL_SECONDS * 1_000;
const LDAP_MS = config.LDAP_POLL_SECONDS * 1_000;
const RETENTION_MS = config.RETENTION_POLL_SECONDS * 1_000;
const BACKUP_MS = config.BACKUP_POLL_SECONDS * 1_000;
const DKIM_ROTATE_MS = config.DKIM_ROTATION_POLL_SECONDS * 1_000;
const DNS_RECHECK_MS = config.DNS_RECHECK_POLL_SECONDS * 1_000;
const SEND_MS = config.WEBMAIL_SEND_POLL_SECONDS * 1_000;

async function main(): Promise<void> {
  const logger = new Logger("worker");
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: false,
  });
  await runMigrations(app.get(Db).pool);
  const webhooks = app.get(WebhooksService);
  const queueSnap = app.get(QueueSnapshotService);
  const dnsbl = app.get(DnsblService);
  const credStore = app.get(WebmailCredentialStore);
  const webmail = app.get(WebmailService);
  const ldap = app.get(LdapService);
  const retention = app.get(RetentionService);
  const backups = app.get(BackupEngine);
  const dkim = app.get(DkimService);
  const dns = app.get(DnsService);
  logger.log("justmail worker up");

  const runners: Array<{ label: string; ms: number; fn: () => Promise<unknown> }> = [
    { label: "webhooks", ms: WEBHOOK_MS, fn: () => webhooks.tick() },
    { label: "queue", ms: QUEUE_MS, fn: () => queueSnap.tick() },
    { label: "dnsbl", ms: DNSBL_MS, fn: () => dnsbl.tick() },
    { label: "cred-sweep", ms: CRED_SWEEP_MS, fn: () => credStore.sweepExpired() },
    { label: "send", ms: SEND_MS, fn: () => webmail.processDueSends() },
    { label: "ldap", ms: LDAP_MS, fn: () => ldap.runDueSyncs() },
    { label: "retention", ms: RETENTION_MS, fn: () => retention.runDuePruning() },
    { label: "backups", ms: BACKUP_MS, fn: () => backups.runDue() },
    { label: "dkim-rotate", ms: DKIM_ROTATE_MS, fn: () => dkim.rotateDue() },
    { label: "dns-recheck", ms: DNS_RECHECK_MS, fn: () => dns.recheckDue() },
  ];

  // Each loop mutates shared state, so with more than one worker replica a
  // naive setInterval would double-fire (double-send, double-rotate, etc.).
  // Guard every tick with a Postgres session advisory lock keyed by the loop:
  // whichever replica grabs the lock runs the tick; others skip until next tick.
  // A dedicated pool holds these locks so a held lock never starves the query
  // pool the tick body itself needs.
  const lockPool = new Pool({
    connectionString: config.DATABASE_URL,
    max: runners.length + 1,
    ssl: config.DATABASE_SSL
      ? { rejectUnauthorized: config.DATABASE_SSL_REJECT_UNAUTHORIZED }
      : undefined,
  });

  const runLocked = async (r: (typeof runners)[number]) => {
    const client = await lockPool.connect();
    try {
      const { rows } = await client.query<{ ok: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS ok",
        [lockKey(r.label)],
      );
      if (!rows[0]?.ok) return; // another replica owns this loop this tick
      try {
        await r.fn();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [lockKey(r.label)]);
      }
    } finally {
      client.release();
    }
  };

  const timers = runners.map((r) =>
    setInterval(() => {
      runLocked(r).catch((err) => {
        logger.warn(`${r.label} tick failed: ${(err as Error).message}`);
      });
    }, r.ms),
  );

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, async () => {
      timers.forEach(clearInterval);
      await lockPool.end();
      await app.close();
      process.exit(0);
    });
  }
}

// Stable 31-bit advisory-lock key for a loop label (deterministic across
// replicas so they contend on the same key). djb2, masked to a positive int.
function lockKey(label: string): number {
  let h = 5381;
  for (let i = 0; i < label.length; i++) h = ((h << 5) + h + label.charCodeAt(i)) | 0;
  return (h & 0x7fffffff) || 1;
}

void main();
