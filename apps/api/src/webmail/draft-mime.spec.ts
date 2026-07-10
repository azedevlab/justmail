import { describe, expect, it } from "vitest";
import { buildDraftMime } from "./webmail.service";

describe("buildDraftMime", () => {
  it("builds a MIME buffer with an empty recipient list", async () => {
    const buf = await buildDraftMime({
      from: "me@example.com",
      to: [],
      cc: [],
      bcc: [],
      subject: "Half-written",
      text: "typing...",
    });
    const mime = buf.toString("utf8");
    expect(mime).toContain("Subject: Half-written");
    expect(mime).toContain("From: me@example.com");
    // No recipient headers should be emitted for empty lists.
    expect(mime).not.toMatch(/^To:/m);
  });

  it("includes recipients and threading headers when present", async () => {
    const buf = await buildDraftMime({
      from: "me@example.com",
      to: ["a@example.com", "b@example.com"],
      cc: ["c@example.com"],
      bcc: [],
      subject: "Re: hi",
      text: "body",
      in_reply_to: "<root@example.com>",
      references: ["<root@example.com>"],
    });
    const mime = buf.toString("utf8");
    expect(mime).toContain("a@example.com");
    expect(mime).toContain("c@example.com");
    expect(mime).toContain("In-Reply-To: <root@example.com>");
    expect(mime).toContain("References: <root@example.com>");
  });
});
