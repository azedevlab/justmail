import { describe, expect, it } from "vitest";
import { ImapSessionManager } from "./imap-session.manager";

// A stand-in for a pooled ImapFlow connection that records whether it was
// closed, so we can assert the manager's pool bookkeeping without a real server.
function fakeEntry(sessionId: string, mailboxId: string, lastUsed: number) {
  const client = { closed: false, logout: async () => {}, close() {} };
  const logout = client.logout;
  client.logout = async () => {
    client.closed = true;
    return logout();
  };
  client.close = () => {
    client.closed = true;
  };
  return {
    key: `${sessionId}:${mailboxId}`,
    entry: {
      client,
      address: `${mailboxId}@example.com`,
      lastUsed,
      inUse: 0,
      chain: Promise.resolve(),
    },
    client,
  };
}

function seed(
  mgr: ImapSessionManager,
  entries: ReturnType<typeof fakeEntry>[],
): void {
  const pool = (mgr as unknown as { pool: Map<string, unknown> }).pool;
  for (const e of entries) pool.set(e.key, e.entry);
}

describe("ImapSessionManager pool management", () => {
  it("sweepIdle closes entries idle past the TTL and keeps fresh ones", () => {
    const mgr = new ImapSessionManager();
    const now = Date.now();
    const stale = fakeEntry("s1", "m1", now - 3_600_000);
    const fresh = fakeEntry("s1", "m2", now);
    seed(mgr, [stale, fresh]);

    const closed = mgr.sweepIdle();

    expect(closed).toBe(1);
    expect(stale.client.closed).toBe(true);
    expect(fresh.client.closed).toBe(false);
    const pool = (mgr as unknown as { pool: Map<string, unknown> }).pool;
    expect(pool.has(stale.key)).toBe(false);
    expect(pool.has(fresh.key)).toBe(true);
  });

  it("purgeSession drops every connection for one session only", async () => {
    const mgr = new ImapSessionManager();
    const now = Date.now();
    const a = fakeEntry("s1", "m1", now);
    const b = fakeEntry("s1", "m2", now);
    const other = fakeEntry("s2", "m1", now);
    seed(mgr, [a, b, other]);

    await mgr.purgeSession("s1");

    const pool = (mgr as unknown as { pool: Map<string, unknown> }).pool;
    expect(pool.has(a.key)).toBe(false);
    expect(pool.has(b.key)).toBe(false);
    expect(pool.has(other.key)).toBe(true);
    expect(a.client.closed).toBe(true);
    expect(other.client.closed).toBe(false);
  });

  it("does not sweep an entry that is currently in use", () => {
    const mgr = new ImapSessionManager();
    const busy = fakeEntry("s1", "m1", Date.now() - 3_600_000);
    busy.entry.inUse = 1;
    seed(mgr, [busy]);

    expect(mgr.sweepIdle()).toBe(0);
    expect(busy.client.closed).toBe(false);
  });
});
