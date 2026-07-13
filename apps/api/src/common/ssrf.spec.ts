import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isBlockedAddress } from "./ssrf";

describe("isBlockedAddress", () => {
  it("blocks loopback, private, link-local and metadata addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "2606:4700::1"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("blocks anything that is not a parseable IP", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http schemes", async () => {
    await expect(assertPublicHttpUrl("ftp://example.com")).rejects.toThrow();
    await expect(
      assertPublicHttpUrl("file:///etc/passwd"),
    ).rejects.toThrow();
  });

  it("rejects an IP-literal pointing at the metadata endpoint", async () => {
    await expect(
      assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow();
  });

  it("rejects a loopback literal", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1:8080/")).rejects.toThrow();
  });

  it("rejects a malformed URL", async () => {
    await expect(assertPublicHttpUrl("http://")).rejects.toThrow();
  });

  it("allows a public IP literal", async () => {
    await expect(
      assertPublicHttpUrl("https://1.1.1.1/hook"),
    ).resolves.toBeUndefined();
  });
});
