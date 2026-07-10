import { describe, expect, it } from "vitest";
import { parseRange } from "./attachments.controller";

describe("parseRange", () => {
  const size = 1000;

  it("returns undefined when no Range header is present", () => {
    expect(parseRange(undefined, size)).toBeUndefined();
  });

  it("parses a bounded range", () => {
    expect(parseRange("bytes=0-499", size)).toEqual({ start: 0, end: 499 });
  });

  it("parses an open-ended range to the last byte", () => {
    expect(parseRange("bytes=500-", size)).toEqual({ start: 500, end: 999 });
  });

  it("clamps an end past the object size", () => {
    expect(parseRange("bytes=0-5000", size)).toEqual({ start: 0, end: 999 });
  });

  it("parses a suffix range as the last N bytes", () => {
    expect(parseRange("bytes=-200", size)).toEqual({ start: 800, end: 999 });
  });

  it("rejects a malformed header", () => {
    expect(parseRange("chunks=0-1", size)).toBe("invalid");
    expect(parseRange("bytes=-", size)).toBe("invalid");
  });

  it("rejects a start beyond the object size", () => {
    expect(parseRange("bytes=1000-1100", size)).toBe("invalid");
  });

  it("rejects an inverted range", () => {
    expect(parseRange("bytes=500-100", size)).toBe("invalid");
  });

  it("rejects a zero-length suffix range", () => {
    expect(parseRange("bytes=-0", size)).toBe("invalid");
  });
});
