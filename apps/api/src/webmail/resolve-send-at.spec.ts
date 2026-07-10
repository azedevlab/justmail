import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { resolveSendAt } from "./webmail.service";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("resolveSendAt", () => {
  it("defaults to now + undo window when no send_at is given", () => {
    const at = resolveSendAt(null, NOW, 10, 30);
    expect(at.getTime()).toBe(NOW + 10_000);
  });

  it("honours a future send_at within the horizon", () => {
    const future = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    const at = resolveSendAt(future, NOW, 10, 30);
    expect(at.toISOString()).toBe(future);
  });

  it("clamps a send_at earlier than the undo floor up to the floor", () => {
    const soon = new Date(NOW + 2_000).toISOString();
    const at = resolveSendAt(soon, NOW, 10, 30);
    expect(at.getTime()).toBe(NOW + 10_000);
  });

  it("rejects a send_at beyond the max horizon", () => {
    const tooFar = new Date(NOW + 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(() => resolveSendAt(tooFar, NOW, 10, 30)).toThrow(BadRequestException);
  });

  it("rejects an unparseable send_at", () => {
    expect(() => resolveSendAt("not-a-date", NOW, 10, 30)).toThrow(
      BadRequestException,
    );
  });
});
