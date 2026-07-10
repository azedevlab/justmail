import { describe, expect, it } from "vitest";
import {
  ComposeRequest,
  FlagAction,
  Folder,
  MessageSummary,
} from "./webmail.js";

describe("ComposeRequest", () => {
  it("accepts a minimal payload and applies defaults", () => {
    const parsed = ComposeRequest.parse({ to: ["a@example.com"] });
    expect(parsed.subject).toBe("");
    expect(parsed.text).toBe("");
  });

  it("round-trips threading + scheduling fields", () => {
    const input = {
      to: ["a@example.com"],
      in_reply_to: "<msg-1@example.com>",
      references: ["<root@example.com>", "<msg-1@example.com>"],
      send_at: new Date().toISOString(),
    };
    const parsed = ComposeRequest.parse(input);
    expect(parsed.in_reply_to).toBe("<msg-1@example.com>");
    expect(parsed.references).toHaveLength(2);
  });

  it("rejects an empty recipient list", () => {
    expect(ComposeRequest.safeParse({ to: [] }).success).toBe(false);
  });
});

describe("FlagAction", () => {
  it("includes the full eight-value set", () => {
    for (const a of [
      "read",
      "unread",
      "star",
      "unstar",
      "spam",
      "not_spam",
      "important",
      "not_important",
    ]) {
      expect(FlagAction.parse(a)).toBe(a);
    }
  });

  it("rejects an unknown action", () => {
    expect(FlagAction.safeParse("delete").success).toBe(false);
  });
});

describe("Folder / MessageSummary shapes", () => {
  it("parses a folder row", () => {
    const parsed = Folder.parse({
      path: "INBOX",
      name: "Inbox",
      special_use: null,
      unread: 3,
      total: 42,
    });
    expect(parsed.unread).toBe(3);
  });

  it("parses a message summary with envelope", () => {
    const parsed = MessageSummary.parse({
      uid: 10,
      seq: 1,
      flags: ["\\Seen"],
      envelope: { subject: "Hi", to: [{ address: "a@example.com" }] },
      size: 2048,
      date: new Date().toISOString(),
      has_attachments: false,
      thread_id: null,
    });
    expect(parsed.uid).toBe(10);
    expect(parsed.envelope.subject).toBe("Hi");
  });
});
