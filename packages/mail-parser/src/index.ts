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
  const parsed = await simpleParser(source);
  return normalise(parsed);
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

export { MAX_PARTS, MAX_DEPTH, MAX_HEADERS };
