import { afterEach, describe, expect, it } from "vitest";
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
