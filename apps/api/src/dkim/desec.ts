/**
 * Minimal deSEC (desec.io) client for the DNS Center reconciler + DKIM rotation.
 * Reads token from DESEC_TOKEN — never falls back to hardcoded values.
 *
 * deSEC groups records into RRsets keyed by (subname, type) with no per-record
 * ids, so we synthesize a stable id `${subname}/${type}` and treat a publish as
 * "this (name,type) holds exactly this one record" — which is what DKIM/SPF/DMARC
 * rotation needs. TXT content is stored quoted; MX as "priority target.".
 */
import { config } from "../config";
import type { CfRecord } from "./cloudflare";

const BASE = "https://desec.io/api/v1";

interface DesecRRset {
  subname: string;
  type: string;
  ttl: number;
  records: string[];
}

/** subname is the label below the zone apex ("" for the apex itself). */
export function subnameFor(zone: string, name: string): string {
  const n = name.replace(/\.$/, "");
  const z = zone.replace(/\.$/, "");
  if (n === z) return "";
  if (n.endsWith(`.${z}`)) return n.slice(0, -(z.length + 1));
  return n;
}

/** Synthetic, stable id for a deSEC RRset (no native record ids exist). */
export function synthId(subname: string, type: string): string {
  return `${subname}/${type}`;
}

/** deSEC stores TXT quoted; the reconciler works with the raw value. */
export function encodeContent(type: string, content: string, priority?: number): string {
  if (type === "TXT") {
    // A single DNS TXT character-string caps at 255 bytes, so long values
    // (notably an RSA-2048 DKIM key at ~400 chars) must be split into several
    // quoted strings or deSEC rejects the RRset with a 400. Peel any quoting
    // off first so re-encoding an already-quoted value doesn't nest quotes.
    const inner = content.replace(/"\s+"/g, "").replace(/^"|"$/g, "");
    const chunks = inner.match(/.{1,255}/gs) ?? [""];
    return chunks.map((c) => `"${c}"`).join(" ");
  }
  if (type === "MX" && priority !== undefined) {
    const target = content.endsWith(".") ? content : `${content}.`;
    return `${priority} ${target}`;
  }
  return content;
}

export function decodeContent(type: string, record: string): { content: string; priority?: number } {
  if (type === "TXT") {
    // deSEC returns TXT in presentation form: one or more quoted strings that
    // concatenate to the logical value. Strip the quotes and the whitespace
    // between chunks so a split DKIM key round-trips to its original value.
    return { content: record.replace(/"\s+"/g, "").replace(/^"|"$/g, "") };
  }
  if (type === "MX") {
    const [prio, ...rest] = record.split(/\s+/);
    return { content: rest.join(" ").replace(/\.$/, ""), priority: Number(prio) };
  }
  return { content: record };
}

async function desec<T>(pathAndQuery: string, init: RequestInit = {}): Promise<T> {
  if (!config.DESEC_TOKEN) {
    throw new Error("DESEC_TOKEN not configured");
  }
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    ...init,
    headers: {
      Authorization: `Token ${config.DESEC_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`deSEC ${init.method ?? "GET"} ${pathAndQuery}: ${res.status} ${text}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** deSEC has no zone id; the owned domain name *is* the zone handle. */
export async function findZoneId(domain: string): Promise<string | null> {
  const domains = await desec<Array<{ name: string }>>("/domains/");
  const owned = new Set(domains.map((d) => d.name.replace(/\.$/, "")));
  const parts = domain.replace(/\.$/, "").split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (owned.has(candidate)) return candidate;
  }
  return null;
}

export async function listRecords(
  zoneId: string,
  name: string,
  type: string,
): Promise<CfRecord[]> {
  const subname = subnameFor(zoneId, name);
  const key = subname === "" ? "@" : subname;
  let rrset: DesecRRset | null;
  try {
    rrset = await desec<DesecRRset>(`/domains/${zoneId}/rrsets/${key}/${type}/`);
  } catch (err) {
    if (err instanceof Error && err.message.includes(": 404")) return [];
    throw err;
  }
  if (!rrset) return [];
  return rrset.records.map((record) => {
    const { content, priority } = decodeContent(type, record);
    return {
      id: synthId(subname, type),
      type,
      name: name.replace(/\.$/, ""),
      content,
      priority,
      ttl: rrset.ttl,
    };
  });
}

export async function upsertRecord(
  zoneId: string,
  _existing: CfRecord | undefined,
  payload: {
    type: string;
    name: string;
    content: string;
    ttl: number;
    priority?: number;
  },
): Promise<CfRecord> {
  const subname = subnameFor(zoneId, payload.name);
  const key = subname === "" ? "@" : subname;
  const body = JSON.stringify({
    subname,
    type: payload.type,
    ttl: Math.max(payload.ttl, 3600),
    records: [encodeContent(payload.type, payload.content, payload.priority)],
  });
  await desec<DesecRRset>(`/domains/${zoneId}/rrsets/${key}/${payload.type}/`, {
    method: "PUT",
    body,
  });
  return {
    id: synthId(subname, payload.type),
    type: payload.type,
    name: payload.name,
    content: payload.content,
    priority: payload.priority,
    ttl: payload.ttl,
  };
}

export async function deleteRecord(zoneId: string, id: string): Promise<void> {
  const [subname, type] = id.split("/");
  const key = subname === "" ? "@" : subname;
  await desec<void>(`/domains/${zoneId}/rrsets/${key}/${type}/`, {
    method: "DELETE",
  });
}
