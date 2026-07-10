import { describe, expect, it } from "vitest";
import { parseVCard, serializeVCard, type VCard } from "./vcard";

const card = (over: Partial<VCard>): VCard => ({
  uid: "u-1",
  full_name: "Ada Lovelace",
  emails: [],
  phones: [],
  organization: null,
  note: null,
  ...over,
});

describe("parseVCard", () => {
  it("parses a full card", () => {
    const text = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "UID:abc-123",
      "FN:Ada Lovelace",
      "N:Lovelace;Ada;;;",
      "EMAIL;TYPE=work:ada@work.example",
      "EMAIL;TYPE=home:ada@home.example",
      "TEL;TYPE=cell:+15551234",
      "ORG:Analytical Engines;R&D",
      "NOTE:First programmer",
      "END:VCARD",
    ].join("\r\n");
    const out = parseVCard(text)!;
    expect(out.uid).toBe("abc-123");
    expect(out.full_name).toBe("Ada Lovelace");
    expect(out.emails).toEqual([
      { address: "ada@work.example", label: "work" },
      { address: "ada@home.example", label: "home" },
    ]);
    expect(out.phones).toEqual([{ number: "+15551234", label: "cell" }]);
    expect(out.organization).toBe("Analytical Engines");
    expect(out.note).toBe("First programmer");
  });

  it("returns null without a UID", () => {
    const text = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:No Id\r\nEND:VCARD";
    expect(parseVCard(text)).toBeNull();
  });

  it("falls back to N when FN is absent", () => {
    const text = "BEGIN:VCARD\r\nUID:x\r\nN:Turing;Alan;;;\r\nEND:VCARD";
    expect(parseVCard(text)!.full_name).toBe("Alan Turing");
  });

  it("unfolds soft-wrapped lines", () => {
    const text =
      "BEGIN:VCARD\r\nUID:x\r\nNOTE:hello \r\n world\r\nEND:VCARD";
    expect(parseVCard(text)!.note).toBe("hello world");
  });

  it("unescapes commas, semicolons and newlines", () => {
    const text = "BEGIN:VCARD\r\nUID:x\r\nNOTE:a\\,b\\;c\\nd\r\nEND:VCARD";
    expect(parseVCard(text)!.note).toBe("a,b;c\nd");
  });

  it("strips the urn:uuid prefix from UID", () => {
    const text = "BEGIN:VCARD\r\nUID:urn:uuid:9e-1\r\nFN:X\r\nEND:VCARD";
    expect(parseVCard(text)!.uid).toBe("9e-1");
  });
});

describe("serializeVCard", () => {
  it("round-trips through the parser", () => {
    const original = card({
      uid: "round-1",
      full_name: "Grace Hopper",
      emails: [{ address: "grace@navy.example", label: "work" }],
      phones: [{ number: "+15559999" }],
      organization: "US Navy",
      note: "Compiler pioneer",
    });
    const parsed = parseVCard(serializeVCard(original))!;
    expect(parsed).toEqual(original);
  });

  it("emits required structural properties", () => {
    const out = serializeVCard(card({}));
    expect(out).toContain("BEGIN:VCARD");
    expect(out).toContain("VERSION:3.0");
    expect(out).toContain("UID:u-1");
    expect(out).toContain("FN:Ada Lovelace");
    expect(out.endsWith("END:VCARD\r\n")).toBe(true);
  });

  it("escapes special characters in values", () => {
    const out = serializeVCard(card({ note: "a,b;c\nd" }));
    expect(out).toContain("NOTE:a\\,b\\;c\\nd");
  });
});
