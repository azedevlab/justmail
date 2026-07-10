import { describe, expect, it } from "vitest";
import {
  FlagAction,
  MoveRequest,
  SendRequest,
  UnlockRequest,
} from "./webmail.service";

describe("SendRequest", () => {
  it("applies defaults for optional subject/text and accepts a minimal payload", () => {
    const parsed = SendRequest.parse({ to: ["a@example.com"] });
    expect(parsed.to).toEqual(["a@example.com"]);
    expect(parsed.subject).toBe("");
    expect(parsed.text).toBe("");
  });

  it("round-trips a full payload with attachments", () => {
    const input = {
      to: ["a@example.com", "b@example.com"],
      cc: ["c@example.com"],
      subject: "Hello",
      text: "body",
      html: "<p>body</p>",
      attachments: [
        {
          filename: "a.txt",
          mime: "text/plain",
          content_base64: Buffer.from("hi").toString("base64"),
        },
      ],
    };
    const parsed = SendRequest.parse(input);
    expect(parsed.cc).toEqual(["c@example.com"]);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments?.[0]?.filename).toBe("a.txt");
  });

  it("rejects an empty recipient list", () => {
    expect(SendRequest.safeParse({ to: [] }).success).toBe(false);
  });

  it("rejects a non-email recipient", () => {
    expect(SendRequest.safeParse({ to: ["not-an-email"] }).success).toBe(false);
  });

  it("defaults attachment mime to octet-stream", () => {
    const parsed = SendRequest.parse({
      to: ["a@example.com"],
      attachments: [{ filename: "x", content_base64: "" }],
    });
    expect(parsed.attachments?.[0]?.mime).toBe("application/octet-stream");
  });
});

describe("FlagAction", () => {
  it("accepts the four supported actions", () => {
    for (const a of ["read", "unread", "star", "unstar"]) {
      expect(FlagAction.parse(a)).toBe(a);
    }
  });

  it("rejects an unknown action", () => {
    expect(FlagAction.safeParse("spam").success).toBe(false);
  });
});

describe("MoveRequest / UnlockRequest", () => {
  it("requires a non-empty destination", () => {
    expect(MoveRequest.safeParse({ destination: "" }).success).toBe(false);
    expect(MoveRequest.parse({ destination: "Archive" }).destination).toBe(
      "Archive",
    );
  });

  it("requires a non-empty password within bounds", () => {
    expect(UnlockRequest.safeParse({ password: "" }).success).toBe(false);
    expect(UnlockRequest.parse({ password: "s3cret" }).password).toBe("s3cret");
  });
});
