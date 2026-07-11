import { describe, expect, it } from "vitest";
import { generateSecret, generateSync, generateURI, verifySync } from "otplib";

// Locks in the otplib functional API used by auth.service.ts (TOTP setup +
// verification). Guards against silent breakage on future otplib upgrades and
// proves the default crypto plugin supports synchronous HMAC.
describe("totp round trip", () => {
  it("verifies a freshly generated code", () => {
    const secret = generateSecret();
    const token = generateSync({ strategy: "totp", secret });
    expect(verifySync({ strategy: "totp", secret, token }).valid).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateSecret();
    const token = generateSync({ strategy: "totp", secret });
    const wrong = token === "000000" ? "111111" : "000000";
    expect(verifySync({ strategy: "totp", secret, token: wrong }).valid).toBe(
      false,
    );
  });

  it("builds an otpauth uri carrying issuer, label and secret", () => {
    const secret = generateSecret();
    const uri = generateURI({
      strategy: "totp",
      issuer: "JustMail",
      label: "user@example.com",
      secret,
    });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("JustMail");
    expect(uri).toContain(`secret=${secret}`);
  });
});
