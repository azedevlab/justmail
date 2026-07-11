import { describe, expect, it } from "vitest";
import { commonDomainSuffix, expectedOrigins, rpId } from "./webauthn";

describe("webauthn config derivation", () => {
  it("falls back to localhost RP id when no hosts are configured", () => {
    expect(rpId()).toBe("localhost");
  });

  it("derives the shared registrable parent of sibling app hosts", () => {
    expect(
      commonDomainSuffix(["app.example.com", "webmail.example.com"]),
    ).toBe("example.com");
  });

  it("returns the single host verbatim when only one is configured", () => {
    expect(commonDomainSuffix(["webmail.example.com"])).toBe(
      "webmail.example.com",
    );
  });

  it("refuses a bare public suffix when hosts share only a TLD", () => {
    expect(commonDomainSuffix(["foo.com", "bar.com"])).toBeUndefined();
  });

  it("returns local dev origins when no app hosts are set", () => {
    const origins = expectedOrigins();
    expect(origins.every((o) => o.startsWith("http"))).toBe(true);
    expect(origins).toContain("http://localhost:3001");
  });
});
