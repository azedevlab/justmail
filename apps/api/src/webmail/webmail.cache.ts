import { Global, Inject, Injectable, Module } from "@nestjs/common";
import { REDIS, RedisModule, type RedisClient } from "../common/redis.module";
import { config } from "../config";

const TTL = config.WEBMAIL_CACHE_TTL_SECONDS;

// Cache is scoped per session because credentials — and therefore the visible
// mailbox — are per session. An index set per mailbox lets a mutation or an
// IDLE notification drop every cached view of that mailbox without a SCAN.
const foldersKey = (sessionId: string, mailboxId: string) =>
  `webmail:cache:folders:${sessionId}:${mailboxId}`;
const listKey = (
  sessionId: string,
  mailboxId: string,
  folder: string,
  limit: number,
) => `webmail:cache:list:${sessionId}:${mailboxId}:${folder}:${limit}`;
const idxKey = (sessionId: string, mailboxId: string) =>
  `webmail:cache:idx:${sessionId}:${mailboxId}`;

/** Short-lived Redis cache for the two read-heavy, STATUS/FETCH-expensive
 *  webmail views (folder list and message list). No-ops when Redis is absent.
 *  Correctness rests on a short TTL plus explicit busting on any mutation or
 *  server-side IDLE notification for the mailbox. */
@Injectable()
export class WebmailCache {
  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  private async read<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private async write(
    sessionId: string,
    mailboxId: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    if (!this.redis) return;
    await this.redis
      .multi()
      .set(key, JSON.stringify(value), "EX", TTL)
      .sadd(idxKey(sessionId, mailboxId), key)
      .expire(idxKey(sessionId, mailboxId), TTL)
      .exec();
  }

  getFolders<T>(sessionId: string, mailboxId: string): Promise<T | null> {
    return this.read<T>(foldersKey(sessionId, mailboxId));
  }

  setFolders(sessionId: string, mailboxId: string, value: unknown) {
    return this.write(
      sessionId,
      mailboxId,
      foldersKey(sessionId, mailboxId),
      value,
    );
  }

  getMessageList<T>(
    sessionId: string,
    mailboxId: string,
    folder: string,
    limit: number,
  ): Promise<T | null> {
    return this.read<T>(listKey(sessionId, mailboxId, folder, limit));
  }

  setMessageList(
    sessionId: string,
    mailboxId: string,
    folder: string,
    limit: number,
    value: unknown,
  ) {
    return this.write(
      sessionId,
      mailboxId,
      listKey(sessionId, mailboxId, folder, limit),
      value,
    );
  }

  /** Drop every cached view of one mailbox. */
  async bustMailbox(sessionId: string, mailboxId: string): Promise<void> {
    if (!this.redis) return;
    const idx = idxKey(sessionId, mailboxId);
    const keys = await this.redis.smembers(idx);
    keys.push(idx);
    await this.redis.del(...keys);
  }
}

@Global()
@Module({
  imports: [RedisModule],
  providers: [WebmailCache],
  exports: [WebmailCache],
})
export class WebmailCacheModule {}
