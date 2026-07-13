import { describe, expect, it } from "vitest";
import { isSafePublicUrl } from "./avatar.service";

describe("isSafePublicUrl", () => {
  it("allows https to a public host (the default logo provider)", () => {
    expect(isSafePublicUrl("https://logo.clearbit.com/example.com")).toBe(true);
  });

  it("rejects plain http", () => {
    expect(isSafePublicUrl("http://logo.clearbit.com/example.com")).toBe(false);
  });

  it("rejects localhost and .local hosts", () => {
    expect(isSafePublicUrl("https://localhost/x")).toBe(false);
    expect(isSafePublicUrl("https://printer.local/x")).toBe(false);
  });

  it("rejects private and loopback IP literals (SSRF guard)", () => {
    expect(isSafePublicUrl("https://127.0.0.1/x")).toBe(false);
    expect(isSafePublicUrl("https://10.1.2.3/x")).toBe(false);
    expect(isSafePublicUrl("https://192.168.0.5/x")).toBe(false);
    expect(isSafePublicUrl("https://172.16.9.9/x")).toBe(false);
    expect(isSafePublicUrl("https://169.254.169.254/latest")).toBe(false);
  });

  it("allows a public IP literal", () => {
    expect(isSafePublicUrl("https://8.8.8.8/x")).toBe(true);
  });

  it("rejects malformed URLs", () => {
    expect(isSafePublicUrl("not a url")).toBe(false);
  });
});
