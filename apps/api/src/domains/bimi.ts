// BIMI (Brand Indicators for Message Identification) helpers.
//
// The published record is the `default` selector TXT at default._bimi.<domain>:
//   v=BIMI1; l=<https url to SVG logo>; a=
// `l=` points at the public bimi-logo.svg route on the domain's own web host;
// `a=` (Verified Mark Certificate) is left empty — self-hosters rarely have a
// VMC, and Gmail/Apple Mail still render the logo from `l=` alone.
//
// BIMI requires SVG Tiny Portable/Secure (SVG Tiny 1.2, no scripts, no external
// references). We can't fully validate the profile without a schema, but we can
// reject the dangerous constructs that make an SVG unsafe to serve or that
// mailbox providers refuse: scripts, foreignObject, and external/remote refs.

/** Max logo size. The BIMI SVG P/S profile keeps marks tiny; 32KB is generous. */
export const BIMI_MAX_BYTES = 32 * 1024;

export const BIMI_CONTENT_TYPE = "image/svg+xml";

/** Public path the logo is served at, relative to the domain's web host. */
export const BIMI_LOGO_PATH = ".well-known/bimi-logo.svg";

export interface BimiValidationError {
  reason: string;
}

/**
 * Validate an uploaded BIMI logo. Returns null when acceptable, otherwise a
 * reason. Enforces size, well-formed-ish SVG, and rejects the unsafe constructs
 * disallowed by the SVG Tiny P/S profile.
 */
export function validateBimiSvg(
  body: Buffer,
  contentType: string | undefined,
): BimiValidationError | null {
  if (contentType && !contentType.toLowerCase().startsWith(BIMI_CONTENT_TYPE)) {
    return { reason: `Logo must be ${BIMI_CONTENT_TYPE}, got ${contentType}` };
  }
  if (body.length === 0) return { reason: "Logo is empty" };
  if (body.length > BIMI_MAX_BYTES) {
    return {
      reason: `Logo is ${body.length} bytes; the limit is ${BIMI_MAX_BYTES}`,
    };
  }
  const svg = body.toString("utf8");
  if (!/<svg[\s>]/i.test(svg)) {
    return { reason: "File does not contain an <svg> root element" };
  }
  // Scripts / event handlers / active content make the mark unsafe to serve.
  if (/<script[\s/>]/i.test(svg)) return { reason: "SVG must not contain <script>" };
  if (/<foreignObject[\s/>]/i.test(svg)) {
    return { reason: "SVG must not contain <foreignObject>" };
  }
  if (/\son\w+\s*=/i.test(svg)) {
    return { reason: "SVG must not contain inline event handlers (on*)" };
  }
  // External / remote references (images, use hrefs, entities) are disallowed by
  // the P/S profile and can leak or fetch untrusted content.
  if (/(?:xlink:href|href)\s*=\s*["'](?:https?:|\/\/|data:)/i.test(svg)) {
    return { reason: "SVG must not reference external or data: URLs" };
  }
  if (/<!ENTITY/i.test(svg) || /<!DOCTYPE[^>]+\[/i.test(svg)) {
    return { reason: "SVG must not declare entities (XXE risk)" };
  }
  return null;
}

/** The https URL the `l=` tag points at for a domain's logo. */
export function bimiLogoUrl(domain: string): string {
  return `https://${domain}/${BIMI_LOGO_PATH}`;
}

/** The full default-selector TXT record content for a domain. */
export function bimiRecordContent(domain: string): string {
  return `v=BIMI1; l=${bimiLogoUrl(domain)}; a=`;
}

/**
 * Extract the DMARC policy (p=) from a published/expected DMARC record's
 * content, lowercased. Returns null when absent. BIMI is ignored by receivers
 * unless the policy is quarantine or reject.
 */
export function dmarcPolicy(content: string | null | undefined): string | null {
  if (!content) return null;
  const m = /(?:^|;)\s*p\s*=\s*([a-z]+)/i.exec(content);
  return m ? m[1]!.toLowerCase() : null;
}

/** Whether a DMARC policy string is strong enough for BIMI to take effect. */
export function bimiDmarcOk(policy: string | null): boolean {
  return policy === "quarantine" || policy === "reject";
}
