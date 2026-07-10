import { createHash } from "node:crypto";

export interface ThreadInput {
  // Native server thread id (e.g. Gmail X-GM-THRID). Preferred when present.
  nativeThreadId?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  subject?: string | null;
}

// Reply/forward prefixes across common locales, stripped for subject grouping.
const SUBJECT_PREFIX = /^\s*(re|fwd?|aw|wg|sv|vs|antwort|rif|res)(\[\d+\])?:\s*/i;

/** Lowercase, strip repeated Re:/Fwd: prefixes, and collapse whitespace. */
export function normalizeSubject(subject: string | null | undefined): string {
  let s = (subject ?? "").trim();
  let prev: string;
  do {
    prev = s;
    s = s.replace(SUBJECT_PREFIX, "");
  } while (s !== prev);
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extract angle-bracketed message-ids from a References/In-Reply-To value. */
export function parseReferences(value: string | null | undefined): string[] {
  if (!value) return [];
  return (value.match(/<[^>]+>/g) ?? []).map((s) => s.trim());
}

// Pull a single header value (with folded continuation lines) from a raw header
// block. ImapFlow returns requested headers as a Buffer of `Name: value` lines.
export function headerValue(
  raw: string | null | undefined,
  name: string,
): string | null {
  if (!raw) return null;
  const re = new RegExp(
    `(?:^|\\r?\\n)${name}:\\s*([\\s\\S]*?)(?:\\r?\\n(?![ \\t])|$)`,
    "i",
  );
  const m = re.exec(raw);
  return m ? m[1]!.replace(/\r?\n[ \t]+/g, " ").trim() : null;
}

function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

/**
 * Derive a stable conversation id. Uses the references root (the first entry of
 * the References chain, which every conformant reply carries), then In-Reply-To,
 * then the message's own id; falls back to a normalized-subject group when no
 * message-ids exist. Returns null when nothing groupable is present.
 */
export function computeThreadId(input: ThreadInput): string | null {
  if (input.nativeThreadId) return input.nativeThreadId;
  const refs = input.references ?? [];
  const root =
    refs[0] ?? input.inReplyTo ?? input.messageId ?? null;
  if (root) return `r:${shortHash(root.trim())}`;
  const subject = normalizeSubject(input.subject);
  if (subject) return `s:${shortHash(subject)}`;
  return null;
}
