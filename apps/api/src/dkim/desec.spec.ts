import { describe, expect, it } from "vitest";
import { decodeContent, encodeContent, subnameFor, synthId } from "./desec";

describe("subnameFor", () => {
  it("returns empty string for the apex", () => {
    expect(subnameFor("example.com", "example.com")).toBe("");
    expect(subnameFor("example.com.", "example.com.")).toBe("");
  });

  it("strips the zone suffix for a subdomain", () => {
    expect(subnameFor("example.com", "jm202607._domainkey.example.com")).toBe(
      "jm202607._domainkey",
    );
    expect(subnameFor("example.com", "mail.example.com")).toBe("mail");
  });

  it("leaves an unrelated name untouched", () => {
    expect(subnameFor("example.com", "other.net")).toBe("other.net");
  });
});

describe("synthId", () => {
  it("joins subname and type", () => {
    expect(synthId("_dmarc", "TXT")).toBe("_dmarc/TXT");
    expect(synthId("", "MX")).toBe("/MX");
  });
});

describe("encodeContent / decodeContent", () => {
  it("quotes TXT values without double-quoting", () => {
    expect(encodeContent("TXT", "v=spf1 -all")).toBe('"v=spf1 -all"');
    expect(encodeContent("TXT", '"v=spf1 -all"')).toBe('"v=spf1 -all"');
  });

  it("round-trips TXT", () => {
    expect(decodeContent("TXT", encodeContent("TXT", "v=DKIM1; k=rsa"))).toEqual({
      content: "v=DKIM1; k=rsa",
    });
  });

  it("splits a long DKIM value into <=255-byte quoted strings", () => {
    const key = "v=DKIM1; k=rsa; p=" + "A".repeat(400);
    const encoded = encodeContent("TXT", key);
    const strings = encoded.match(/"[^"]*"/g) ?? [];
    expect(strings.length).toBeGreaterThan(1);
    for (const s of strings) expect(s.length - 2).toBeLessThanOrEqual(255);
    expect(decodeContent("TXT", encoded)).toEqual({ content: key });
  });

  it("formats MX as priority + fqdn target", () => {
    expect(encodeContent("MX", "mail.example.com", 10)).toBe("10 mail.example.com.");
    expect(encodeContent("MX", "mail.example.com.", 10)).toBe("10 mail.example.com.");
  });

  it("round-trips MX", () => {
    expect(decodeContent("MX", encodeContent("MX", "mail.example.com", 10))).toEqual({
      content: "mail.example.com",
      priority: 10,
    });
  });
});
