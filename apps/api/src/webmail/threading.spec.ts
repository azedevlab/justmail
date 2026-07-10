import { describe, expect, it } from "vitest";
import {
  computeThreadId,
  headerValue,
  normalizeSubject,
  parseReferences,
} from "./threading";

describe("normalizeSubject", () => {
  it("strips repeated reply/forward prefixes and lowercases", () => {
    expect(normalizeSubject("Re: Fwd: Re:  Hello World")).toBe("hello world");
    expect(normalizeSubject("FW: Report")).toBe("report");
    expect(normalizeSubject("  ")).toBe("");
  });
});

describe("parseReferences", () => {
  it("extracts angle-bracketed ids", () => {
    expect(parseReferences("<a@x> <b@y>\n <c@z>")).toEqual([
      "<a@x>",
      "<b@y>",
      "<c@z>",
    ]);
    expect(parseReferences(null)).toEqual([]);
  });
});

describe("headerValue", () => {
  it("reads a folded header value", () => {
    const raw = "References: <a@x>\r\n <b@y>\r\nOther: z\r\n";
    expect(headerValue(raw, "references")).toBe("<a@x> <b@y>");
  });
});

describe("computeThreadId", () => {
  it("prefers a native thread id", () => {
    expect(computeThreadId({ nativeThreadId: "gmail-123" })).toBe("gmail-123");
  });

  it("groups a root and its replies under the same id", () => {
    const root = computeThreadId({ messageId: "<root@x>" });
    const reply = computeThreadId({
      messageId: "<r2@x>",
      inReplyTo: "<root@x>",
      references: ["<root@x>"],
    });
    const replyToReply = computeThreadId({
      messageId: "<r3@x>",
      inReplyTo: "<r2@x>",
      references: ["<root@x>", "<r2@x>"],
    });
    expect(reply).toBe(root);
    expect(replyToReply).toBe(root);
  });

  it("falls back to normalized subject when no ids exist", () => {
    const a = computeThreadId({ subject: "Weekly sync" });
    const b = computeThreadId({ subject: "Re: Weekly sync" });
    expect(a).toBe(b);
    expect(a).toMatch(/^s:/);
  });

  it("returns null when nothing is groupable", () => {
    expect(computeThreadId({ subject: "" })).toBeNull();
    expect(computeThreadId({})).toBeNull();
  });
});
