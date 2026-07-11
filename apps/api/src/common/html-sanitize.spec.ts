import { describe, expect, it } from "vitest";
import { sanitizeMailHtml } from "./html-sanitize";

describe("sanitizeMailHtml", () => {
  it("strips script tags and their contents", () => {
    const out = sanitizeMailHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toBe("<p>hi</p>");
  });

  it("removes event-handler attributes", () => {
    const out = sanitizeMailHtml('<a href="https://x.com" onclick="steal()">x</a>');
    expect(out).not.toContain("onclick");
    expect(out).toContain('href="https://x.com"');
  });

  it("drops javascript: URLs", () => {
    const out = sanitizeMailHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("forces safe rel/target on links", () => {
    const out = sanitizeMailHtml('<a href="https://x.com">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps basic formatting tags", () => {
    const out = sanitizeMailHtml("<p><strong>bold</strong> <em>italic</em></p>");
    expect(out).toBe("<p><strong>bold</strong> <em>italic</em></p>");
  });

  it("drops style attributes and disallowed tags", () => {
    const out = sanitizeMailHtml('<div style="position:fixed">x</div><iframe></iframe>');
    expect(out).not.toContain("style");
    expect(out).not.toContain("iframe");
    expect(out).toContain("<div>x</div>");
  });

  it("keeps text-align but drops other styles", () => {
    const out = sanitizeMailHtml(
      '<p style="text-align:center;position:fixed">x</p>',
    );
    expect(out).toContain("text-align:center");
    expect(out).not.toContain("position");
  });

  it("allows http and cid image sources but not others", () => {
    const ok = sanitizeMailHtml('<img src="https://x.com/a.png">');
    expect(ok).toContain('src="https://x.com/a.png"');
    const bad = sanitizeMailHtml('<img src="javascript:1">');
    expect(bad).not.toContain("javascript:");
  });
});
