import { afterEach, describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DkimService } from "./dkim.service";
import { config } from "../config";

// Minimal Db stub that records every SQL string it is asked to run, so a test
// can assert the rotation guard short-circuits before touching the database.
function svc() {
  const calls: string[] = [];
  const db = {
    query: async (sql: string) => {
      calls.push(sql);
      return { rows: [] };
    },
  };
  return { service: new DkimService(db as never, {} as never, {} as never), calls };
}

describe("DkimService.rotateDue gating", () => {
  const orig = {
    enabled: config.DKIM_ROTATION_ENABLED,
    provider: config.DNS_PROVIDER,
    token: config.CLOUDFLARE_API_TOKEN,
  };
  afterEach(() => {
    config.DKIM_ROTATION_ENABLED = orig.enabled;
    config.DNS_PROVIDER = orig.provider;
    config.CLOUDFLARE_API_TOKEN = orig.token;
  });

  it("no-ops when rotation is disabled", async () => {
    config.DKIM_ROTATION_ENABLED = false;
    const { service, calls } = svc();
    await expect(service.rotateDue()).resolves.toEqual({ started: [], promoted: [] });
    expect(calls).toHaveLength(0);
  });

  it("no-ops when enabled but no publishable DNS provider", async () => {
    config.DKIM_ROTATION_ENABLED = true;
    config.DNS_PROVIDER = "none";
    config.CLOUDFLARE_API_TOKEN = undefined;
    const { service, calls } = svc();
    await expect(service.rotateDue()).resolves.toEqual({ started: [], promoted: [] });
    expect(calls).toHaveLength(0);
  });

  it("no-ops when cloudflare is selected but the token is missing", async () => {
    config.DKIM_ROTATION_ENABLED = true;
    config.DNS_PROVIDER = "cloudflare";
    config.CLOUDFLARE_API_TOKEN = undefined;
    const { service, calls } = svc();
    await expect(service.rotateDue()).resolves.toEqual({ started: [], promoted: [] });
    expect(calls).toHaveLength(0);
  });
});

// Captures the SQL issued inside the activate() transaction so we can assert the
// invariant-preserving order (retire the outgoing key before promoting the new
// one, so the one-active-per-domain unique index is never transiently violated).
function activateSvc(targetExists: boolean) {
  const txCalls: string[] = [];
  const db = {
    query: async () => ({ rows: [], rowCount: 0 }),
    tx: (fn: (tx: { query: (sql: string) => Promise<unknown> }) => unknown) =>
      Promise.resolve(
        fn({
          query: async (sql: string) => {
            txCalls.push(sql);
            if (sql.includes("FOR UPDATE")) {
              return { rowCount: targetExists ? 1 : 0, rows: [] };
            }
            return { rowCount: 1, rows: [] };
          },
        }),
      ),
  };
  const orgs = { requireRole: async () => "admin" };
  const audit = { log: () => undefined };
  return {
    service: new DkimService(db as never, orgs as never, audit as never),
    txCalls,
  };
}

describe("DkimService.activate invariant", () => {
  const origDir = config.DKIM_DIR;
  afterEach(() => {
    config.DKIM_DIR = origDir;
  });

  it("retires the outgoing active key before promoting the target", async () => {
    config.DKIM_DIR = mkdtempSync(join(tmpdir(), "dkim-test-"));
    const { service, txCalls } = activateSvc(true);
    await service.activate(
      { userId: "u1" } as never,
      "org-1",
      "dom-1",
      "key-1",
    );
    const retireIdx = txCalls.findIndex((s) =>
      s.includes("SET status = 'retired'"),
    );
    const activateIdx = txCalls.findIndex((s) =>
      s.includes("SET status = 'active'"),
    );
    expect(retireIdx).toBeGreaterThanOrEqual(0);
    expect(activateIdx).toBeGreaterThan(retireIdx);
  });

  it("throws NotFound when the key does not belong to the domain", async () => {
    const { service } = activateSvc(false);
    await expect(
      service.activate({ userId: "u1" } as never, "org-1", "dom-1", "nope"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
