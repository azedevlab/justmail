import { Global, Inject, Injectable, Logger, Module } from "@nestjs/common";
import { Db } from "../db/db.service";
import { REDIS, RedisModule, type RedisClient } from "../common/redis.module";
import { open, seal } from "../common/secretbox";
import { config } from "../config";

export interface CachedCreds {
  address: string;
  password: string;
}

interface StoredValue {
  address: string;
  sealed: string;
  /** epoch seconds; only used by the settings-table fallback path */
  expiresAt: number;
}

const TTL = config.WEBMAIL_CREDENTIAL_TTL_SECONDS;

// Redis key for one unlocked mailbox, and a per-session index set so logout can
// purge every mailbox a session unlocked without a SCAN.
const credKey = (sessionId: string, mailboxId: string) =>
  `webmail:cred:${sessionId}:${mailboxId}`;
const idxKey = (sessionId: string) => `webmail:cred:idx:${sessionId}`;

// Settings-table fallback key (used only when Redis is unavailable). Keeps the
// original prefix so any pre-existing rows are still recognised.
const settingsKey = (sessionId: string, mailboxId: string) =>
  `webmail.session:${sessionId}.${mailboxId}`;
const settingsPrefix = (sessionId: string) => `webmail.session:${sessionId}.`;

/** Stores unlocked-mailbox passwords sealed with the platform key, with a
 *  sliding TTL. Prefers Redis (natural expiry, cross-replica); falls back to a
 *  `settings` row carrying its own expiry when Redis is not configured. */
@Injectable()
export class WebmailCredentialStore {
  private readonly logger = new Logger(WebmailCredentialStore.name);

  constructor(
    private readonly db: Db,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  async store(
    sessionId: string,
    mailboxId: string,
    address: string,
    password: string,
  ): Promise<void> {
    const sealed = seal(password);
    if (this.redis) {
      const payload = JSON.stringify({ address, sealed });
      await this.redis
        .multi()
        .set(credKey(sessionId, mailboxId), payload, "EX", TTL)
        .sadd(idxKey(sessionId), mailboxId)
        .expire(idxKey(sessionId), TTL)
        .exec();
      return;
    }
    const value: StoredValue = {
      address,
      sealed,
      expiresAt: Math.floor(Date.now() / 1000) + TTL,
    };
    await this.db.query(
      `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2::jsonb, NULL)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [settingsKey(sessionId, mailboxId), JSON.stringify(value)],
    );
  }

  /** Return sealed creds and slide the TTL forward, or null if locked/expired. */
  async get(sessionId: string, mailboxId: string): Promise<CachedCreds | null> {
    if (this.redis) {
      const raw = await this.redis.get(credKey(sessionId, mailboxId));
      if (!raw) return null;
      await this.redis.expire(credKey(sessionId, mailboxId), TTL);
      await this.redis.expire(idxKey(sessionId), TTL);
      const v = JSON.parse(raw) as { address: string; sealed: string };
      return { address: v.address, password: open(v.sealed) };
    }
    const { rows } = await this.db.query<{ value: StoredValue }>(
      "SELECT value FROM settings WHERE key = $1",
      [settingsKey(sessionId, mailboxId)],
    );
    const v = rows[0]?.value;
    if (!v) return null;
    if (v.expiresAt <= Math.floor(Date.now() / 1000)) {
      await this.remove(sessionId, mailboxId);
      return null;
    }
    // Slide the fallback TTL too so active sessions don't expire mid-use.
    await this.db.query(
      `UPDATE settings SET value = jsonb_set(value, '{expiresAt}', to_jsonb($2::bigint)), updated_at = now()
       WHERE key = $1`,
      [settingsKey(sessionId, mailboxId), Math.floor(Date.now() / 1000) + TTL],
    );
    return { address: v.address, password: open(v.sealed) };
  }

  async remove(sessionId: string, mailboxId: string): Promise<void> {
    if (this.redis) {
      await this.redis
        .multi()
        .del(credKey(sessionId, mailboxId))
        .srem(idxKey(sessionId), mailboxId)
        .exec();
      return;
    }
    await this.db.query("DELETE FROM settings WHERE key = $1", [
      settingsKey(sessionId, mailboxId),
    ]);
  }

  /** Drop every mailbox a session unlocked. Called on logout. */
  async purgeSession(sessionId: string): Promise<void> {
    if (this.redis) {
      const ids = await this.redis.smembers(idxKey(sessionId));
      const keys = ids.map((id) => credKey(sessionId, id));
      keys.push(idxKey(sessionId));
      if (keys.length > 0) await this.redis.del(...keys);
      return;
    }
    await this.db.query("DELETE FROM settings WHERE key LIKE $1", [
      `${settingsPrefix(sessionId)}%`,
    ]);
  }

  /** Delete expired settings-table rows. No-op under Redis (TTL is automatic).
   *  Returns the number of rows removed. */
  async sweepExpired(): Promise<number> {
    if (this.redis) return 0;
    const { rowCount } = await this.db.query(
      `DELETE FROM settings
       WHERE key LIKE 'webmail.session:%'
         AND (value->>'expiresAt')::bigint <= $1`,
      [Math.floor(Date.now() / 1000)],
    );
    if (rowCount && rowCount > 0) {
      this.logger.log(`swept ${rowCount} expired webmail credential row(s)`);
    }
    return rowCount ?? 0;
  }
}

@Global()
@Module({
  imports: [RedisModule],
  providers: [WebmailCredentialStore],
  exports: [WebmailCredentialStore],
})
export class CredentialStoreModule {}
