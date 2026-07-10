// Pure vCard 3.0 (RFC 2426) parse/serialize. No I/O — the CardDAV client owns
// transport. We support the property subset JustMail exposes on a contact:
// UID, FN, N, EMAIL, TEL, ORG, NOTE. Unknown properties are ignored on read
// and dropped on write (Radicale stores whatever we PUT).

export interface VCardEmail {
  address: string;
  label?: string;
}

export interface VCardPhone {
  number: string;
  label?: string;
}

export interface VCard {
  uid: string;
  full_name: string;
  emails: VCardEmail[];
  phones: VCardPhone[];
  organization: string | null;
  note: string | null;
}

const PRODID = "-//JustMail//Contacts//EN";

// A single logical property line after unfolding: NAME;PARAM=v;PARAM=v:VALUE
interface RawProperty {
  name: string;
  params: Map<string, string[]>;
  value: string;
}

// RFC 2425 line unfolding: a CRLF followed by a space or tab is a soft wrap.
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

// Unescape a component value per RFC 2426 §5: \n \N -> newline, \\ \, \; literal.
function unescapeValue(v: string): string {
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

function escapeValue(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// Split on an unescaped delimiter (used for structured N and TYPE lists).
function splitUnescaped(v: string, delim: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (ch === "\\" && i + 1 < v.length) {
      cur += ch + v[++i];
    } else if (ch === delim) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function parseProperty(line: string): RawProperty | null {
  // The value starts at the first unquoted colon; everything before is
  // NAME plus optional ;PARAM sections.
  let colon = -1;
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon === -1) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = splitUnescaped(head, ";");
  const name = segments[0]!.toUpperCase();
  const params = new Map<string, string[]>();
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]!;
    const eq = seg.indexOf("=");
    if (eq === -1) {
      // vCard 2.1-style bare param (e.g. TYPE implied): treat as TYPE value.
      const key = "TYPE";
      const list = params.get(key) ?? [];
      list.push(seg.replace(/"/g, ""));
      params.set(key, list);
      continue;
    }
    const key = seg.slice(0, eq).toUpperCase();
    const rawVal = seg.slice(eq + 1);
    const values = rawVal.split(",").map((p) => p.replace(/"/g, ""));
    const list = params.get(key) ?? [];
    list.push(...values);
    params.set(key, list);
  }
  return { name, params, value };
}

function firstType(prop: RawProperty): string | undefined {
  const types = prop.params.get("TYPE");
  if (!types || types.length === 0) return undefined;
  const label = types.find((t) => t.toLowerCase() !== "pref") ?? types[0]!;
  return label.toLowerCase();
}

export function parseVCard(text: string): VCard | null {
  const lines = unfoldLines(text);
  const emails: VCardEmail[] = [];
  const phones: VCardPhone[] = [];
  let uid = "";
  let fn = "";
  let nFallback = "";
  let organization: string | null = null;
  let note: string | null = null;
  let inCard = false;

  for (const line of lines) {
    if (!line) continue;
    const prop = parseProperty(line);
    if (!prop) continue;
    switch (prop.name) {
      case "BEGIN":
        if (prop.value.toUpperCase() === "VCARD") inCard = true;
        break;
      case "END":
        inCard = false;
        break;
      case "UID":
        uid = unescapeValue(prop.value).replace(/^urn:uuid:/i, "");
        break;
      case "FN":
        fn = unescapeValue(prop.value);
        break;
      case "N": {
        // N = Family;Given;Additional;Prefix;Suffix — build a display fallback.
        const parts = splitUnescaped(prop.value, ";").map(unescapeValue);
        const [family = "", given = ""] = parts;
        nFallback = [given, family].filter(Boolean).join(" ").trim();
        break;
      }
      case "EMAIL": {
        const address = unescapeValue(prop.value).trim();
        if (address) emails.push({ address, label: firstType(prop) });
        break;
      }
      case "TEL": {
        const number = unescapeValue(prop.value).trim();
        if (number) phones.push({ number, label: firstType(prop) });
        break;
      }
      case "ORG": {
        // ORG is structured (Company;Unit;…); keep the first component.
        const org = splitUnescaped(prop.value, ";").map(unescapeValue)[0]!.trim();
        organization = org || null;
        break;
      }
      case "NOTE": {
        const n = unescapeValue(prop.value);
        note = n.length > 0 ? n : null;
        break;
      }
      default:
        break;
    }
  }

  void inCard;
  if (!uid) return null;
  return {
    uid,
    full_name: fn || nFallback || "",
    emails,
    phones,
    organization,
    note,
  };
}

export function serializeVCard(card: VCard): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");
  lines.push(`PRODID:${PRODID}`);
  lines.push(`UID:${escapeValue(card.uid)}`);
  lines.push(`FN:${escapeValue(card.full_name)}`);
  // Minimal N derived from FN so clients that require N still render a name.
  lines.push(`N:${escapeValue(card.full_name)};;;;`);
  for (const email of card.emails) {
    const type = email.label ? `;TYPE=${escapeParam(email.label)}` : "";
    lines.push(`EMAIL${type}:${escapeValue(email.address)}`);
  }
  for (const phone of card.phones) {
    const type = phone.label ? `;TYPE=${escapeParam(phone.label)}` : "";
    lines.push(`TEL${type}:${escapeValue(phone.number)}`);
  }
  if (card.organization) lines.push(`ORG:${escapeValue(card.organization)}`);
  if (card.note) lines.push(`NOTE:${escapeValue(card.note)}`);
  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// Parameter values allow a narrower charset; strip anything that would need
// quoting so we can emit them bare (labels are free-form client TYPE values).
function escapeParam(v: string): string {
  return v.replace(/[";:,]/g, "").trim();
}

// RFC 2425 folding: wrap lines longer than 75 octets, continuation prefixed
// with a single space. We approximate octets with UTF-16 length, which is fine
// for the ASCII-dominant properties we emit.
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
