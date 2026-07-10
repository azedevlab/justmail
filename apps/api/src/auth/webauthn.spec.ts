import { describe, expect, it } from "vitest";
import { expectedOrigins, rpId } from "./webauthn";

describe("webauthn config derivation", () => {
  it("falls back to localhost RP id when no hosts are configured", () => {
    expect(rpId()).toBe("localhost");
  });

  it("returns local dev origins when no app hosts are set", () => {
    const origins = expectedOrigins();
    expect(origins.every((o) => o.startsWith("http"))).toBe(true);
    expect(origins).toContain("http://localhost:3001");
  });
});
