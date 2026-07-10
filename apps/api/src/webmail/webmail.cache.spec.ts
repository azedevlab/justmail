import { describe, expect, it } from "vitest";
import type { RedisClient } from "../common/redis.module";
import { WebmailCache } from "./webmail.cache";

// Minimal in-memory Redis fake covering only the commands WebmailCache uses.
class FakeRedis {
  store = new Map<string, string>();
  sets = new Map<string, Set<string>>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async smembers(key: string) {
    return [...(this.sets.get(key) ?? [])];
  }
  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) {
      if (this.store.delete(k)) n++;
      this.sets.delete(k);
    }
    return n;
  }
  multi() {
    const ops: (() => void)[] = [];
    const chain = {
      set: (k: string, v: string) => {
        ops.push(() => this.store.set(k, v));
        return chain;
      },
      sadd: (k: string, m: string) => {
        ops.push(() => {
          const s = this.sets.get(k) ?? new Set<string>();
          s.add(m);
          this.sets.set(k, s);
        });
        return chain;
      },
      expire: () => chain,
      exec: async () => {
        ops.forEach((op) => op());
        return [];
      },
    };
    return chain;
  }
}

const makeCache = () => {
  const redis = new FakeRedis();
  const cache = new WebmailCache(redis as unknown as RedisClient);
  return { redis, cache };
};

describe("WebmailCache", () => {
  it("round-trips folder and message-list snapshots", async () => {
    const { cache } = makeCache();
    await cache.setFolders("s1", "m1", [{ path: "INBOX" }]);
    await cache.setMessageList("s1", "m1", "INBOX", 100, { total: 3 });

    expect(await cache.getFolders("s1", "m1")).toEqual([{ path: "INBOX" }]);
    expect(await cache.getMessageList("s1", "m1", "INBOX", 100)).toEqual({
      total: 3,
    });
  });

  it("busts every cached view of a mailbox but leaves others intact", async () => {
    const { cache } = makeCache();
    await cache.setFolders("s1", "m1", ["a"]);
    await cache.setMessageList("s1", "m1", "INBOX", 100, { total: 1 });
    await cache.setMessageList("s1", "m1", "Sent", 100, { total: 2 });
    await cache.setFolders("s1", "m2", ["other"]);

    await cache.bustMailbox("s1", "m1");

    expect(await cache.getFolders("s1", "m1")).toBeNull();
    expect(await cache.getMessageList("s1", "m1", "INBOX", 100)).toBeNull();
    expect(await cache.getMessageList("s1", "m1", "Sent", 100)).toBeNull();
    // A different mailbox is untouched.
    expect(await cache.getFolders("s1", "m2")).toEqual(["other"]);
  });

  it("no-ops safely when Redis is unavailable", async () => {
    const cache = new WebmailCache(null);
    await cache.setFolders("s1", "m1", ["x"]);
    expect(await cache.getFolders("s1", "m1")).toBeNull();
    await expect(cache.bustMailbox("s1", "m1")).resolves.toBeUndefined();
  });
});
