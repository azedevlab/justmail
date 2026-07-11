import sanitizeHtml from "sanitize-html";

// Allowlist for user-authored mail HTML (compose bodies, signatures, templates).
// Deliberately conservative: presentational + structural tags only, no script,
// no forms, no iframes/objects. Style attributes are dropped (senders can't run
// CSS-based exfiltration or layout attacks); colour/spacing comes from tags.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike",
    "sub", "sup", "blockquote", "pre", "code", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "img",
    "table", "thead", "tbody", "tr", "td", "th",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    td: ["colspan", "rowspan", "align", "valign"],
    th: ["colspan", "rowspan", "align", "valign"],
    "*": ["style"],
  },
  // Only text-alignment survives from style attributes — it can't reference URLs
  // or positioning, so it carries no exfiltration/layout-attack risk.
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
  },
  // Only http(s), mailto, and inline data-image URLs; blocks javascript:/vbscript:.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
  allowProtocolRelative: false,
  // Force safe link behaviour so a composed/pasted link can't hijack the opener.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
  disallowedTagsMode: "discard",
};

export function sanitizeMailHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
