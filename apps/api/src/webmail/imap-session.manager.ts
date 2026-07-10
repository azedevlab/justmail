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
import type { CachedCreds } from "./credential.store";

interface PoolEntry {
  client: ImapFlow | null;
  address: string;
  lastUsed: number;
  inUse: number;
  // Serializes work on a single connection: ImapFlow multiplexes one command
  // at a time, so overlapping requests on the same client must queue.
  chain: Promise<unknown>;
}

/**
 * Pools one authenticated IMAP connection per session+mailbox. Connections are
 * reused across requests (no connect/logout per call), health-checked before
 * handing out, evicted LRU past a hard cap, and swept when idle past the TTL.
 */
@Injectable()
export class ImapSessionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapSessionManager.name);
  private readonly pool = new Map<string, PoolEntry>();
  private sweepTimer?: ReturnType<typeof setInterval>;

  onModuleInit(): void {
    // Halve the TTL so an entry is never handed out much past its deadline.
    const everyMs = Math.max(
      (config.IMAP_POOL_IDLE_TTL_SECONDS * 1000) / 2,
      15_000,
    );
    this.sweepTimer = setInterval(() => this.sweepIdle(), everyMs);
    this.sweepTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await Promise.all(
      [...this.pool.values()].map((e) => this.closeEntry(e)),
    );
    this.pool.clear();
  }

  /**
   * Borrow a connected client for this session+mailbox, run fn, and return the
   * client to the pool. Calls for the same key run one at a time.
   */
  async run<T>(
    sessionId: string,
    mailboxId: string,
    creds: CachedCreds,
    fn: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    const key = `${sessionId}:${mailboxId}`;
    let entry = this.pool.get(key);
    if (!entry) {
      entry = {
        client: null,
        address: creds.address,
        lastUsed: Date.now(),
        inUse: 0,
        chain: Promise.resolve(),
      };
    }
    // Move to the end so the Map stays in LRU order (oldest first).
    this.pool.delete(key);
    this.pool.set(key, entry);
    const e = entry;

    e.inUse++;
    const result = e.chain.then(async () => {
      const client = await this.ensureConnected(e, creds);
      e.lastUsed = Date.now();
      return fn(client);
    });
    // Keep the queue alive even if this op rejects.
    e.chain = result.catch(() => undefined);
    try {
      return await result;
    } finally {
      e.inUse--;
      e.lastUsed = Date.now();
      this.evictOverCap(key);
    }
  }

  /** Drop every pooled connection for a session (called on logout/lock). */
  async purgeSession(sessionId: string): Promise<void> {
    const prefix = `${sessionId}:`;
    const doomed: string[] = [];
    for (const [key, entry] of this.pool) {
      if (key.startsWith(prefix)) {
        doomed.push(key);
        void this.closeEntry(entry);
      }
    }
    for (const key of doomed) this.pool.delete(key);
  }

  /** Close connections idle past the TTL. Returns how many were closed. */
  sweepIdle(): number {
    const cutoff = Date.now() - config.IMAP_POOL_IDLE_TTL_SECONDS * 1000;
    let closed = 0;
    for (const [key, entry] of this.pool) {
      if (entry.inUse === 0 && entry.lastUsed < cutoff) {
        void this.closeEntry(entry);
        this.pool.delete(key);
        closed++;
      }
    }
    return closed;
  }

  private async ensureConnected(
    entry: PoolEntry,
    creds: CachedCreds,
  ): Promise<ImapFlow> {
    if (entry.client?.usable) return entry.client;
    const client = new ImapFlow({
      host: config.IMAP_HOST,
      port: config.IMAP_PORT,
      secure: true,
      auth: { user: creds.address, pass: creds.password },
      tls: { rejectUnauthorized: config.IMAP_TLS_REJECT_UNAUTHORIZED },
      logger: false,
    });
    client.on("error", (err) =>
      this.logger.warn(`imap connection error: ${err.message}`),
    );
    await client.connect();
    entry.client = client;
    entry.address = creds.address;
    return client;
  }

  private evictOverCap(current: string): void {
    if (this.pool.size <= config.IMAP_POOL_MAX) return;
    for (const [key, entry] of this.pool) {
      if (this.pool.size <= config.IMAP_POOL_MAX) break;
      if (key === current || entry.inUse > 0) continue;
      void this.closeEntry(entry);
      this.pool.delete(key);
    }
  }

  private async closeEntry(entry: PoolEntry): Promise<void> {
    const client = entry.client;
    entry.client = null;
    if (!client) return;
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

@Global()
@Module({
  providers: [ImapSessionManager],
  exports: [ImapSessionManager],
})
export class ImapSessionModule {}
