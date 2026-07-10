import {
  Global,
  Injectable,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ImapFlow } from "imapflow";
import { config } from "../config";
import { RealtimeService } from "../realtime/realtime.service";
import { WebmailCache } from "./webmail.cache";
import type { CachedCreds } from "./credential.store";

interface Watcher {
  key: string;
  sessionId: string;
  mailboxId: string;
  folder: string;
  client: ImapFlow;
  touchedAt: number;
}

/**
 * Keeps a dedicated IMAP connection per session+mailbox parked in IDLE on the
 * currently-open folder. Server-side change notifications (new mail, flag
 * updates, expunges) are fanned out to the owning session's WebSocket topic.
 *
 * These are separate from the pooled request connections: IDLE holds the
 * mailbox open continuously, which would otherwise block pooled request ops.
 * Orphaned watchers (tab closed without unwatch) are swept once idle past the
 * TTL; the client re-arms `watch` on a timer while a folder stays open.
 */
@Injectable()
export class ImapIdleWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapIdleWatcher.name);
  private readonly watchers = new Map<string, Watcher>();
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly cache: WebmailCache,
  ) {}

  onModuleInit(): void {
    const everyMs = Math.max(
      (config.IMAP_POOL_IDLE_TTL_SECONDS * 1000) / 2,
      30_000,
    );
    this.sweepTimer = setInterval(() => this.sweepIdle(), everyMs);
    this.sweepTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await Promise.all([...this.watchers.values()].map((w) => this.stop(w)));
    this.watchers.clear();
  }

  async watch(
    sessionId: string,
    mailboxId: string,
    folder: string,
    creds: CachedCreds,
  ): Promise<void> {
    const key = `${sessionId}:${mailboxId}`;
    const existing = this.watchers.get(key);
    if (existing && existing.folder === folder && existing.client.usable) {
      existing.touchedAt = Date.now();
      return;
    }
    if (existing) {
      this.watchers.delete(key);
      await this.stop(existing);
    }
    const client = new ImapFlow({
      host: config.IMAP_HOST,
      port: config.IMAP_PORT,
      secure: true,
      auth: { user: creds.address, pass: creds.password },
      tls: { rejectUnauthorized: config.IMAP_TLS_REJECT_UNAUTHORIZED },
      logger: false,
    });
    const topic = `session:${sessionId}`;
    const emit = (type: string, data: Record<string, unknown>) => {
      // The mailbox changed under us; drop the cached views before the client's
      // reaction refetches, so it never reads a stale snapshot.
      void this.cache.bustMailbox(sessionId, mailboxId);
      this.realtime.publish(topic, [], {
        type,
        data: { mailbox_id: mailboxId, folder, ...data },
      });
    };
    client.on("exists", (e) => {
      if (e.count > e.prevCount) emit("mail:new", { count: e.count });
    });
    client.on("flags", (e) =>
      emit("mail:flags", { uid: e.uid ?? null, flags: [...e.flags] }),
    );
    client.on("expunge", (e) =>
      emit("mail:expunge", { uid: e.uid ?? null, seq: e.seq ?? null }),
    );
    client.on("error", (err) =>
      this.logger.warn(`idle watcher error (${key}): ${err.message}`),
    );
    client.on("close", () => {
      if (this.watchers.get(key)?.client === client) this.watchers.delete(key);
    });
    await client.connect();
    // Open (not lock) so the mailbox stays selected and ImapFlow auto-IDLEs.
    await client.mailboxOpen(folder);
    this.watchers.set(key, {
      key,
      sessionId,
      mailboxId,
      folder,
      client,
      touchedAt: Date.now(),
    });
  }

  async unwatch(sessionId: string, mailboxId: string): Promise<void> {
    const key = `${sessionId}:${mailboxId}`;
    const w = this.watchers.get(key);
    if (!w) return;
    this.watchers.delete(key);
    await this.stop(w);
  }

  async purgeSession(sessionId: string): Promise<void> {
    const prefix = `${sessionId}:`;
    const doomed = [...this.watchers.values()].filter((w) =>
      w.key.startsWith(prefix),
    );
    for (const w of doomed) {
      this.watchers.delete(w.key);
      void this.stop(w);
    }
  }

  sweepIdle(): number {
    const cutoff = Date.now() - config.IMAP_POOL_IDLE_TTL_SECONDS * 1000;
    let closed = 0;
    for (const w of [...this.watchers.values()]) {
      if (w.touchedAt < cutoff) {
        this.watchers.delete(w.key);
        void this.stop(w);
        closed++;
      }
    }
    return closed;
  }

  private async stop(w: Watcher): Promise<void> {
    w.client.removeAllListeners();
    try {
      await w.client.logout();
    } catch {
      w.client.close();
    }
  }
}

@Global()
@Module({
  providers: [ImapIdleWatcher],
  exports: [ImapIdleWatcher],
})
export class ImapIdleModule {}
