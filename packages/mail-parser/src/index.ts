import { simpleParser, type ParsedMail, type Source } from "mailparser";

/**
 * Defensive MIME parser. Wraps mailparser with:
 *  - part-count and nesting-depth limits to blunt zip-bomb-style attacks
 *  - a whitelist of extracted headers so we don't fan out to unbounded meta
 *  - a normalised return shape typed by JustMail's own contracts
 *
 * This module is the single funnel through which every inbound message body
 * flows on its way to storage and the webmail reader.
 */

const MAX_PARTS = 200;
const MAX_DEPTH = 8;
const MAX_HEADERS = 200;

/**
 * Raised when a message's MIME structure exceeds a defensive limit, before it is
 * ever handed to mailparser. Callers translate this into a 4xx rather than
 * letting a hostile depth/part bomb burn parser CPU and memory.
 */
export class MimeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MimeLimitError";
  }
}

export interface ParsedMessage {
  message_id: string | null;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: Date | null;
  text: string;
  html: string | null;
  headers: Record<string, string>;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    contentId: string | null;
    disposition: "attachment" | "inline";
    content: Buffer;
  }>;
}

export async function parseMime(source: Source): Promise<ParsedMessage> {
  // Materialise first so we can vet the structure before mailparser walks it: a
  // stream handed straight to simpleParser would already be consumed by the time
  // any limit tripped, and depth is invisible in its flattened output.
  const raw = await toBuffer(source);
  assertStructureWithinLimits(raw);
  const parsed = await simpleParser(raw);
  return normalise(parsed);
}

async function toBuffer(source: Source): Promise<Buffer> {
  if (typeof source === "string") return Buffer.from(source);
  if (Buffer.isBuffer(source)) return source;
  const chunks: Buffer[] = [];
  for await (const chunk of source as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Enforce nesting-depth and part-count caps by tracking multipart boundaries in
// the raw bytes. mailparser's simpleParser flattens the tree, so these limits
// have to be measured here or not at all — hence the historical dead MAX_DEPTH.
function assertStructureWithinLimits(raw: Buffer): void {
  // latin1 preserves every byte 1:1, so boundary matching is unaffected by any
  // transfer encoding of the payload.
  const text = raw.toString("latin1");

  // Collect every declared boundary token up front; nested parts declare their
  // own, and a delimiter line only counts if it names a boundary we've seen.
  const boundaries = new Set<string>();
  const declRe = /boundary\s*=\s*"?([^";\r\n]+)"?/gi;
  for (let m = declRe.exec(text); m; m = declRe.exec(text)) {
    if (m[1]) boundaries.add(m[1].trim());
  }
  if (boundaries.size === 0) return; // non-multipart: nothing to nest

  const stack: string[] = [];
  let parts = 0;
  const delimRe = /^--(.+?)(--)?[ \t]*$/;
  for (const line of text.split(/\r?\n/)) {
    const m = delimRe.exec(line);
    if (!m) continue;
    const token = m[1];
    if (!token || !boundaries.has(token)) continue;
    const isClose = m[2] === "--";
    if (isClose) {
      const idx = stack.lastIndexOf(token);
      if (idx >= 0) stack.length = idx;
      continue;
    }
    if (stack[stack.length - 1] !== token) {
      stack.push(token);
      if (stack.length > MAX_DEPTH) {
        throw new MimeLimitError(
          `MIME nesting depth exceeds limit of ${MAX_DEPTH}`,
        );
      }
    }
    if (++parts > MAX_PARTS) {
      throw new MimeLimitError(`MIME part count exceeds limit of ${MAX_PARTS}`);
    }
  }
}

function normalise(p: ParsedMail): ParsedMessage {
  const headers: Record<string, string> = {};
  let count = 0;
  for (const [name, value] of p.headers.entries()) {
    if (count++ >= MAX_HEADERS) break;
    headers[String(name)] =
      typeof value === "string" ? value : safeStringify(value);
  }

  const atts = (p.attachments ?? []).slice(0, MAX_PARTS).map((a) => ({
    filename: a.filename ?? "",
    contentType: a.contentType ?? "application/octet-stream",
    size: a.size ?? 0,
    contentId: (a.contentId ?? null) as string | null,
    disposition:
      (a.contentDisposition as "attachment" | "inline") ?? "attachment",
    content: a.content as Buffer,
  }));

  return {
    message_id: (p.messageId ?? null) as string | null,
    subject: p.subject ?? "",
    from: p.from?.text ?? "",
    to: addressesToString(p.to),
    cc: addressesToString(p.cc),
    date: p.date ?? null,
    text: p.text ?? "",
    html: (p.html as string | false) || null,
    headers,
    attachments: atts,
  };
}

function addressesToString(list: ParsedMail["to"]): string {
  if (!list) return "";
  if (Array.isArray(list)) return list.map((l) => l.text).join(", ");
  return list.text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export { MAX_PARTS, MAX_DEPTH, MAX_HEADERS, assertStructureWithinLimits };
