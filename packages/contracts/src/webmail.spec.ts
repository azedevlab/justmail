import { describe, expect, it } from "vitest";
import {
  ComposeRequest,
  FlagAction,
  Folder,
  MessageList,
  MessageSummary,
  MessageSync,
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

describe("MessageList / MessageSync (CONDSTORE)", () => {
  it("carries modseq + uidvalidity as nullable strings", () => {
    const parsed = MessageList.parse({
      messages: [],
      total: 0,
      uid_validity: "123456789",
      mod_seq: "42",
    });
    expect(parsed.mod_seq).toBe("42");

    const nulls = MessageList.parse({
      messages: [],
      total: 0,
      uid_validity: null,
      mod_seq: null,
    });
    expect(nulls.uid_validity).toBeNull();
  });

  it("parses a flag delta and a stale signal", () => {
    const delta = MessageSync.parse({
      uid_validity: "1",
      mod_seq: "50",
      stale: false,
      changed: [{ uid: 7, flags: ["\\Seen", "\\Flagged"] }],
    });
    expect(delta.changed[0]!.uid).toBe(7);

    const stale = MessageSync.parse({
      uid_validity: "2",
      mod_seq: "1",
      stale: true,
      changed: [],
    });
    expect(stale.stale).toBe(true);
  });
});
