/**
 * Structured extraction from raw mail-stack log lines shipped by vector.
 * Focus: capture the fields dashboards / queue views need without ambition.
 */

export interface ParsedEvent {
  event: string;
  direction: "inbound" | "outbound" | null;
  queue_id: string | null;
  from_addr: string | null;
  to_addr: string | null;
  size_bytes: number | null;
  spam_score: number | null;
  spam_action: string | null;
  tls_version: string | null;
  dsn: string | null;
  message_id: string | null;
  relay: string | null;
  delay_ms: number | null;
}

const EMPTY: ParsedEvent = {
  event: "",
  direction: null,
  queue_id: null,
  from_addr: null,
  to_addr: null,
  size_bytes: null,
  spam_score: null,
  spam_action: null,
  tls_version: null,
  dsn: null,
  message_id: null,
  relay: null,
  delay_ms: null,
};

// Postfix component/queue-id format: `postfix/<component>[<pid>]: <queue-id>: ...`
const POSTFIX_QID = /postfix\/(\w+)\[\d+\]:\s+([0-9A-F]{8,}):/i;
// key=value fragments (from, to, relay, dsn, delay, size, ...).
const KV = /(\w+)=(?:<([^>]*)>|([^\s,]+))/g;

export function parsePostfix(message: string): ParsedEvent | null {
  const qid = message.match(POSTFIX_QID);
  if (!qid) return null;
  const [, component, queueId] = qid;
  const kv: Record<string, string> = {};
  for (const m of message.matchAll(KV)) {
    const k = m[1]!;
    const v = m[2] ?? m[3] ?? "";
    kv[k] = v;
  }
  const dsn = kv.dsn ?? null;
  const status = kv.status ?? null;
  const event =
    status && dsn
      ? `postfix.${component}.${status}`
      : `postfix.${component}`;
  const direction: ParsedEvent["direction"] =
    component === "smtpd" || component === "cleanup" ? "inbound"
    : component === "smtp" || component === "pipe" || component === "lmtp" ? "outbound"
    : null;
  return {
    ...EMPTY,
    event,
    direction,
    queue_id: queueId ?? null,
    from_addr: kv.from ?? null,
    to_addr: kv.to ?? null,
    relay: kv.relay ?? null,
    dsn,
    size_bytes: kv.size ? Number(kv.size) : null,
    delay_ms: kv.delay ? Math.round(Number(kv.delay) * 1000) : null,
  };
}

const DOVECOT_AUTH = /(?:auth failed|authentication failure|SASL (?:LOGIN|PLAIN) authentication failed)/;
const DOVECOT_LOGIN_OK = /Login: user=<([^>]+)>/;
const DOVECOT_TLS = /TLS(?:v?)([0-9.]+)/i;

export function parseDovecot(message: string): ParsedEvent | null {
  if (DOVECOT_AUTH.test(message)) {
    const user = message.match(/user=<?([\w.@+-]+)>?/)?.[1] ?? null;
    return { ...EMPTY, event: "dovecot.auth_failed", to_addr: user };
  }
  const ok = message.match(DOVECOT_LOGIN_OK);
  if (ok) {
    const tls = message.match(DOVECOT_TLS)?.[1] ?? null;
    return { ...EMPTY, event: "dovecot.login", to_addr: ok[1] ?? null, tls_version: tls };
  }
  return null;
}

const RSPAMD = /<(?<qid>[a-z0-9]+)>;\s+task;.*?score=(?<score>-?\d+(?:\.\d+)?)\s*\/\s*(?<threshold>-?\d+(?:\.\d+)?).*?action=(?<action>[\w-]+)/;

export function parseRspamd(message: string): ParsedEvent | null {
  const m = message.match(RSPAMD);
  if (!m || !m.groups) return null;
  return {
    ...EMPTY,
    event: `rspamd.${m.groups.action}`,
    queue_id: m.groups.qid ?? null,
    spam_score: Number(m.groups.score),
    spam_action: m.groups.action ?? null,
  };
}

export function parseByService(service: string, message: string): ParsedEvent {
  const trimmed = message.trim();
  const parsed =
    service === "postfix"
      ? parsePostfix(trimmed)
      : service === "dovecot"
      ? parseDovecot(trimmed)
      : service === "rspamd"
      ? parseRspamd(trimmed)
      : null;
  if (parsed) return parsed;
  return { ...EMPTY, event: `${service || "unknown"}.log` };
}
