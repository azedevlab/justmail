import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
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
  ];

  const timers = runners.map((r) =>
    setInterval(async () => {
      try {
        await r.fn();
      } catch (err) {
        logger.warn(`${r.label} tick failed: ${(err as Error).message}`);
      }
    }, r.ms),
  );

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, async () => {
      timers.forEach(clearInterval);
      await app.close();
      process.exit(0);
    });
  }
}

void main();
