import { describe, expect, it } from "vitest";
import {
  BIMI_MAX_BYTES,
  bimiDmarcOk,
  bimiLogoUrl,
  bimiRecordContent,
  dmarcPolicy,
  validateBimiSvg,
} from "./bimi";

const svg = (inner = "") =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`,
  );

describe("bimiRecordContent / bimiLogoUrl", () => {
  it("formats the default-selector TXT with an https l= and empty a=", () => {
    expect(bimiLogoUrl("example.com")).toBe(
      "https://example.com/.well-known/bimi-logo.svg",
    );
    expect(bimiRecordContent("example.com")).toBe(
      "v=BIMI1; l=https://example.com/.well-known/bimi-logo.svg; a=",
    );
  });
});

describe("validateBimiSvg", () => {
  it("accepts a clean SVG", () => {
    expect(validateBimiSvg(svg("<rect width='10' height='10'/>"), "image/svg+xml")).toBeNull();
  });

  it("rejects a non-svg content type", () => {
    expect(validateBimiSvg(svg(), "image/png")).not.toBeNull();
  });

  it("rejects empty and oversized bodies", () => {
    expect(validateBimiSvg(Buffer.alloc(0), "image/svg+xml")).not.toBeNull();
    expect(
      validateBimiSvg(Buffer.alloc(BIMI_MAX_BYTES + 1, 0x20), "image/svg+xml"),
    ).not.toBeNull();
  });

  it("rejects files without an <svg> root", () => {
    expect(validateBimiSvg(Buffer.from("<html></html>"), "image/svg+xml")).not.toBeNull();
  });

  it("rejects scripts, event handlers, and foreignObject", () => {
    expect(validateBimiSvg(svg("<script>alert(1)</script>"), "image/svg+xml")).not.toBeNull();
    expect(validateBimiSvg(svg("<a onclick='x()'/>"), "image/svg+xml")).not.toBeNull();
    expect(validateBimiSvg(svg("<foreignObject/>"), "image/svg+xml")).not.toBeNull();
  });

  it("rejects external references and entity declarations", () => {
    expect(
      validateBimiSvg(svg("<image href='https://evil/x.png'/>"), "image/svg+xml"),
    ).not.toBeNull();
    expect(
      validateBimiSvg(Buffer.from("<!DOCTYPE svg [<!ENTITY x 'y'>]><svg/>"), "image/svg+xml"),
    ).not.toBeNull();
  });
});

describe("dmarcPolicy / bimiDmarcOk", () => {
  it("extracts p= and gates on quarantine/reject", () => {
    expect(dmarcPolicy("v=DMARC1; p=quarantine; rua=mailto:x@y")).toBe("quarantine");
    expect(dmarcPolicy("v=DMARC1; p=none")).toBe("none");
    expect(dmarcPolicy(null)).toBeNull();
    expect(bimiDmarcOk("reject")).toBe(true);
    expect(bimiDmarcOk("quarantine")).toBe(true);
    expect(bimiDmarcOk("none")).toBe(false);
    expect(bimiDmarcOk(null)).toBe(false);
  });
});
