import { describe, expect, it } from "vitest";
import { SettingsService } from "./settings.service";
import { config } from "../config";

// Minimal Db stub returning a canned settings row.
function svcWith(value: unknown) {
  const db = { query: async () => ({ rows: value === undefined ? [] : [{ value }] }) };
  return new SettingsService(
    db as never,
    {} as never,
    {} as never,
  );
}

describe("SettingsService.attachmentLimits", () => {
  it("falls back to config defaults when unset", async () => {
    const limits = await svcWith(undefined).attachmentLimits("org-1");
    expect(limits).toEqual({
      maxTotalBytes: config.WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
      maxCount: config.WEBMAIL_ATTACHMENT_MAX_COUNT,
    });
  });

  it("applies stored overrides", async () => {
    const limits = await svcWith({
      max_total_bytes: 5_000_000,
      max_count: 3,
    }).attachmentLimits("org-1");
    expect(limits).toEqual({ maxTotalBytes: 5_000_000, maxCount: 3 });
  });

  it("clamps overrides above the deployment ceiling", async () => {
    const limits = await svcWith({
      max_total_bytes: config.WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES * 10,
      max_count: config.WEBMAIL_ATTACHMENT_MAX_COUNT + 100,
    }).attachmentLimits("org-1");
    expect(limits).toEqual({
      maxTotalBytes: config.WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
      maxCount: config.WEBMAIL_ATTACHMENT_MAX_COUNT,
    });
  });

  it("ignores non-positive overrides", async () => {
    const limits = await svcWith({ max_total_bytes: 0, max_count: -5 }).attachmentLimits(
      "org-1",
    );
    expect(limits).toEqual({
      maxTotalBytes: config.WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
      maxCount: config.WEBMAIL_ATTACHMENT_MAX_COUNT,
    });
  });
});
