import { describe, expect, it } from "vitest";
import { parseICal, serializeICal, type ICalEvent } from "./ical";

const event = (over: Partial<ICalEvent>): ICalEvent => ({
  uid: "e-1",
  summary: "Standup",
  starts_at: "2026-07-11T09:00:00.000Z",
  ends_at: "2026-07-11T09:30:00.000Z",
  all_day: false,
  location: null,
  description: null,
  ...over,
});

describe("parseICal", () => {
  it("parses a timed VEVENT", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:abc-1",
      "SUMMARY:Sync",
      "DTSTART:20260711T090000Z",
      "DTEND:20260711T093000Z",
      "LOCATION:Room 4",
      "DESCRIPTION:Weekly sync",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const out = parseICal(text)!;
    expect(out.uid).toBe("abc-1");
    expect(out.summary).toBe("Sync");
    expect(out.starts_at).toBe("2026-07-11T09:00:00.000Z");
    expect(out.ends_at).toBe("2026-07-11T09:30:00.000Z");
    expect(out.all_day).toBe(false);
    expect(out.location).toBe("Room 4");
    expect(out.description).toBe("Weekly sync");
  });

  it("parses an all-day VEVENT via VALUE=DATE", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:d-1",
      "SUMMARY:Holiday",
      "DTSTART;VALUE=DATE:20260711",
      "DTEND;VALUE=DATE:20260712",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const out = parseICal(text)!;
    expect(out.all_day).toBe(true);
    expect(out.starts_at).toBe("2026-07-11T00:00:00.000Z");
  });

  it("returns null without UID or DTSTART", () => {
    expect(parseICal("BEGIN:VEVENT\r\nSUMMARY:x\r\nEND:VEVENT")).toBeNull();
  });

  it("defaults DTEND to DTSTART when absent", () => {
    const text =
      "BEGIN:VEVENT\r\nUID:z\r\nDTSTART:20260711T090000Z\r\nEND:VEVENT";
    const out = parseICal(text)!;
    expect(out.ends_at).toBe(out.starts_at);
  });

  it("unescapes text and unfolds long lines", () => {
    const text =
      "BEGIN:VEVENT\r\nUID:z\r\nDTSTART:20260711T090000Z\r\n" +
      "DESCRIPTION:a\\,b\\;c\\nd\r\nSUMMARY:hel\r\n lo\r\nEND:VEVENT";
    const out = parseICal(text)!;
    expect(out.description).toBe("a,b;c\nd");
    expect(out.summary).toBe("hello");
  });
});

describe("serializeICal", () => {
  it("round-trips a timed event", () => {
    const original = event({
      uid: "rt-1",
      summary: "Review",
      location: "HQ",
      description: "Quarterly review",
    });
    const parsed = parseICal(serializeICal(original))!;
    expect(parsed).toEqual(original);
  });

  it("round-trips an all-day event", () => {
    const original = event({
      uid: "rt-2",
      summary: "PTO",
      all_day: true,
      starts_at: "2026-07-11T00:00:00.000Z",
      ends_at: "2026-07-12T00:00:00.000Z",
    });
    const parsed = parseICal(serializeICal(original))!;
    expect(parsed).toEqual(original);
  });

  it("emits VCALENDAR/VEVENT structure and escapes text", () => {
    const out = serializeICal(event({ summary: "a,b;c" }));
    expect(out).toContain("BEGIN:VCALENDAR");
    expect(out).toContain("BEGIN:VEVENT");
    expect(out).toContain("SUMMARY:a\\,b\\;c");
    expect(out.trim().endsWith("END:VCALENDAR")).toBe(true);
  });
});
