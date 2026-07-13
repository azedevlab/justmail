import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import {
  MAX_DEPTH,
  MAX_PARTS,
  MimeLimitError,
  assertStructureWithinLimits,
  parseMime,
} from "./index";

// Builds a message whose multipart/mixed parts are nested `depth` levels deep,
// each level declaring its own boundary — the shape a depth-bomb takes.
function nested(depth: number): string {
  const headerFor = (i: number) =>
    `Content-Type: multipart/mixed; boundary="b${i}"\r\n\r\n`;
  let body = "the innermost text\r\n";
  for (let i = depth; i >= 1; i--) {
    body = `--b${i}\r\n${i === depth ? "Content-Type: text/plain\r\n\r\n" : headerFor(i + 1)}${body}--b${i}--\r\n`;
  }
  return `From: a@example.com\r\nTo: b@example.com\r\nSubject: nested\r\n${headerFor(1)}${body}`;
}

// A flat multipart/mixed carrying `n` sibling text parts.
function siblings(n: number): string {
  let body = "";
  for (let i = 0; i < n; i++) {
    body += `--b\r\nContent-Type: text/plain\r\n\r\npart ${i}\r\n`;
  }
  return `From: a@example.com\r\nSubject: many\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n${body}--b--\r\n`;
}

describe("parseMime happy path", () => {
  it("parses a simple text message", async () => {
    const raw =
      "From: alice@example.com\r\nTo: bob@example.com\r\nSubject: hi\r\n\r\nhello world\r\n";
    const p = await parseMime(raw);
    expect(p.subject).toBe("hi");
    expect(p.from).toContain("alice@example.com");
    expect(p.text.trim()).toBe("hello world");
  });

  it("parses a multipart message with an attachment", async () => {
    const raw = [
      "From: alice@example.com",
      "Subject: with attachment",
      'Content-Type: multipart/mixed; boundary="X"',
      "",
      "--X",
      "Content-Type: text/plain",
      "",
      "body text",
      "--X",
      "Content-Type: application/octet-stream",
      "Content-Disposition: attachment; filename=note.txt",
      "",
      "ZmlsZQ==",
      "--X--",
      "",
    ].join("\r\n");
    const p = await parseMime(raw);
    expect(p.text).toContain("body text");
    expect(p.attachments.length).toBe(1);
    expect(p.attachments[0].filename).toBe("note.txt");
  });

  it("accepts a Buffer and a stream source", async () => {
    const raw = "From: a@b.com\r\nSubject: s\r\n\r\nx\r\n";
    const fromBuf = await parseMime(Buffer.from(raw));
    const fromStream = await parseMime(Readable.from([Buffer.from(raw)]));
    expect(fromBuf.subject).toBe("s");
    expect(fromStream.subject).toBe("s");
  });
});

describe("parseMime malformed input", () => {
  it("does not throw on a message with no headers or body", async () => {
    const p = await parseMime("");
    expect(p.subject).toBe("");
    expect(p.attachments).toEqual([]);
  });

  it("tolerates a dangling multipart boundary with no closing marker", async () => {
    const raw =
      'Subject: broken\r\nContent-Type: multipart/mixed; boundary="Y"\r\n\r\n--Y\r\nContent-Type: text/plain\r\n\r\ntrailing\r\n';
    const p = await parseMime(raw);
    expect(p.text).toContain("trailing");
  });
});

describe("structure limits", () => {
  it("accepts nesting at exactly the depth limit", () => {
    expect(() =>
      assertStructureWithinLimits(Buffer.from(nested(MAX_DEPTH))),
    ).not.toThrow();
  });

  it("rejects nesting beyond the depth limit", () => {
    expect(() =>
      assertStructureWithinLimits(Buffer.from(nested(MAX_DEPTH + 1))),
    ).toThrow(MimeLimitError);
  });

  it("rejects a message with more parts than the limit", () => {
    expect(() =>
      assertStructureWithinLimits(Buffer.from(siblings(MAX_PARTS + 1))),
    ).toThrow(MimeLimitError);
  });

  it("is a no-op for a non-multipart message", () => {
    expect(() =>
      assertStructureWithinLimits(
        Buffer.from("Subject: plain\r\n\r\njust text\r\n"),
      ),
    ).not.toThrow();
  });

  it("parseMime surfaces the limit error before parsing", async () => {
    await expect(parseMime(nested(MAX_DEPTH + 5))).rejects.toBeInstanceOf(
      MimeLimitError,
    );
  });
});
