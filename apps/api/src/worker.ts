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
import { config } from "./config";

// Ticks: webhook deliveries every 5s, queue snapshot every 60s, DNSBL check
// every 30 minutes, expired-credential sweep every 10 minutes. Scheduled/undo
// send dispatch polls on its own configured cadence.
const WEBHOOK_MS = 5_000;
const QUEUE_MS = 60_000;
const DNSBL_MS = 30 * 60_000;
const CRED_SWEEP_MS = 10 * 60_000;
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
  logger.log("justmail worker up");

  const runners: Array<{ label: string; ms: number; fn: () => Promise<unknown> }> = [
    { label: "webhooks", ms: WEBHOOK_MS, fn: () => webhooks.tick() },
    { label: "queue", ms: QUEUE_MS, fn: () => queueSnap.tick() },
    { label: "dnsbl", ms: DNSBL_MS, fn: () => dnsbl.tick() },
    { label: "cred-sweep", ms: CRED_SWEEP_MS, fn: () => credStore.sweepExpired() },
    { label: "send", ms: SEND_MS, fn: () => webmail.processDueSends() },
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
