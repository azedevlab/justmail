// Pure iCalendar (RFC 5545) VEVENT parse/serialize. No I/O — the CalDAV client
// owns transport. We support the single-VEVENT subset JustMail exposes: UID,
// SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION. Recurrence, alarms, and
// multi-VEVENT bodies are read past (ignored) and never emitted.

export interface ICalEvent {
  uid: string;
  summary: string;
  // ISO-8601 UTC instants. For all-day events these are midnight UTC on the
  // start date and the (exclusive) end date, matching VALUE=DATE semantics.
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  description: string | null;
}

const PRODID = "-//JustMail//Calendar//EN";

interface RawProperty {
  name: string;
  params: Map<string, string>;
  value: string;
}

function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (ch === "\\" && i + 1 < v.length) {
      const next = v[++i];
      if (next === "n" || next === "N") out += "\n";
      else out += next;
    } else {
      out += ch;
    }
  }
  return out;
}

function escapeText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function parseProperty(line: string): RawProperty | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = head.split(";");
  const name = segments[0]!.toUpperCase();
  const params = new Map<string, string>();
  for (let i = 1; i < segments.length; i++) {
    const eq = segments[i]!.indexOf("=");
    if (eq === -1) continue;
    params.set(
      segments[i]!.slice(0, eq).toUpperCase(),
      segments[i]!.slice(eq + 1).replace(/"/g, ""),
    );
  }
  return { name, params, value };
}

// Parse a DATE (YYYYMMDD) or DATE-TIME (YYYYMMDDTHHMMSS[Z]) value into an ISO
// UTC instant. Floating and TZID-qualified times are treated as UTC — a known
// simplification acceptable for the single-calendar-per-mailbox model.
function parseDate(prop: RawProperty): { iso: string; date: boolean } {
  const v = prop.value.trim();
  const isDate = prop.params.get("VALUE") === "DATE" || /^\d{8}$/.test(v);
  if (isDate) {
    const y = v.slice(0, 4);
    const mo = v.slice(4, 6);
    const d = v.slice(6, 8);
    return { iso: new Date(`${y}-${mo}-${d}T00:00:00Z`).toISOString(), date: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) {
    const parsed = new Date(v);
    return {
      iso: Number.isNaN(parsed.getTime())
        ? new Date(0).toISOString()
        : parsed.toISOString(),
      date: false,
    };
  }
  const [, y, mo, d, h, mi, s] = m;
  return {
    iso: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString(),
    date: false,
  };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${formatDate(iso)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}` +
    `${pad(d.getUTCSeconds())}Z`
  );
}

export function parseICal(text: string): ICalEvent | null {
  const lines = unfoldLines(text);
  let inEvent = false;
  let uid = "";
  let summary = "";
  let location: string | null = null;
  let description: string | null = null;
  let startIso = "";
  let endIso = "";
  let allDay = false;

  for (const line of lines) {
    if (!line) continue;
    const prop = parseProperty(line);
    if (!prop) continue;
    if (prop.name === "BEGIN" && prop.value.toUpperCase() === "VEVENT") {
      inEvent = true;
      continue;
    }
    if (prop.name === "END" && prop.value.toUpperCase() === "VEVENT") {
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    switch (prop.name) {
      case "UID":
        uid = unescapeText(prop.value).trim();
        break;
      case "SUMMARY":
        summary = unescapeText(prop.value);
        break;
      case "LOCATION": {
        const l = unescapeText(prop.value);
        location = l.length > 0 ? l : null;
        break;
      }
      case "DESCRIPTION": {
        const d = unescapeText(prop.value);
        description = d.length > 0 ? d : null;
        break;
      }
      case "DTSTART": {
        const p = parseDate(prop);
        startIso = p.iso;
        if (p.date) allDay = true;
        break;
      }
      case "DTEND": {
        const p = parseDate(prop);
        endIso = p.iso;
        if (p.date) allDay = true;
        break;
      }
      default:
        break;
    }
  }

  if (!uid || !startIso) return null;
  // A VEVENT without DTEND lasts until DTSTART (zero-length) per RFC 5545.
  if (!endIso) endIso = startIso;
  return {
    uid,
    summary,
    starts_at: startIso,
    ends_at: endIso,
    all_day: allDay,
    location,
    description,
  };
}

export function serializeICal(event: ICalEvent): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${PRODID}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${escapeText(event.uid)}`);
  lines.push(`DTSTAMP:${formatDateTime(new Date().toISOString())}`);
  if (event.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.starts_at)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(event.ends_at)}`);
  } else {
    lines.push(`DTSTART:${formatDateTime(event.starts_at)}`);
    lines.push(`DTEND:${formatDateTime(event.ends_at)}`);
  }
  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.description)
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}
