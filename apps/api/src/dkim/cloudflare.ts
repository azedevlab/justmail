/**
 * Minimal Cloudflare v4 client for the DNS Center reconciler.
 * Reads token from CLOUDFLARE_API_TOKEN — never falls back to hardcoded values.
 */
import { config } from "../config";
import { parseCaa } from "./dns-reconcile";

const BASE = "https://api.cloudflare.com/client/v4";

interface CfResult<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

export interface CfRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  priority?: number;
  ttl: number;
}

async function cf<T>(pathAndQuery: string, init: RequestInit = {}): Promise<T> {
  if (!config.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN not configured");
  }
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json()) as CfResult<T>;
  if (!body.success) {
    throw new Error(
      `Cloudflare ${init.method ?? "GET"} ${pathAndQuery}: ${body.errors
        .map((e) => `${e.code} ${e.message}`)
        .join("; ")}`,
    );
  }
  return body.result;
}

export async function findZoneId(domain: string): Promise<string | null> {
  // Try progressively shorter suffixes (foo.bar.baz → bar.baz → baz).
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    const zones = await cf<Array<{ id: string; name: string }>>(
      `/zones?name=${encodeURIComponent(candidate)}`,
    );
    if (zones[0]) return zones[0].id;
  }
  return null;
}

export async function listRecords(
  zoneId: string,
  name: string,
  type: string,
): Promise<CfRecord[]> {
  return cf<CfRecord[]>(
    `/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(name)}`,
  );
}

export async function upsertRecord(
  zoneId: string,
  existing: CfRecord | undefined,
  payload: {
    type: string;
    name: string;
    content: string;
    ttl: number;
    priority?: number;
    proxied?: boolean;
  },
): Promise<CfRecord> {
  const record: Record<string, unknown> = {
    type: payload.type,
    name: payload.name,
    ttl: payload.ttl,
    proxied: payload.proxied ?? false,
  };
  if (payload.type === "CAA") {
    // Cloudflare rejects CAA sent as a plain content string; it must be the
    // structured { flags, tag, value } form.
    const caa = parseCaa(payload.content);
    if (!caa) throw new Error(`Invalid CAA record content: ${payload.content}`);
    record.data = { flags: caa.flags, tag: caa.tag, value: caa.value };
  } else {
    record.content = payload.content;
    if (payload.priority !== undefined) record.priority = payload.priority;
  }
  const body = JSON.stringify(record);
  if (existing) {
    return cf<CfRecord>(`/zones/${zoneId}/dns_records/${existing.id}`, {
      method: "PUT",
      body,
    });
  }
  return cf<CfRecord>(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body,
  });
}

export async function deleteRecord(zoneId: string, id: string): Promise<void> {
  await cf<{ id: string }>(`/zones/${zoneId}/dns_records/${id}`, {
    method: "DELETE",
  });
}
