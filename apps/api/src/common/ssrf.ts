import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Thrown when a user-supplied URL resolves to a non-public address. Callers turn
// this into a 400 (creation) or a recorded delivery failure (runtime) rather
// than letting an outbound request reach cloud metadata or internal services.
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

// True for any IPv4/IPv6 literal that must never be reachable from a webhook:
// loopback, RFC1918 private, link-local (incl. the 169.254.169.254 cloud
// metadata endpoint), CGNAT, unique-local, and the unspecified address.
export function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isBlockedV4(ip);
  if (v === 6) return isBlockedV6(ip);
  return true; // not a parseable IP → refuse rather than guess
}

function isBlockedV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = p as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved
  return false;
}

function isBlockedV6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]!; // drop any zone id
  if (addr === "::" || addr === "::1") return true; // unspecified / loopback
  // IPv4-mapped (::ffff:a.b.c.d) — evaluate the embedded v4 address.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]!);
  if (addr.startsWith("fe80")) return true; // link-local
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // fc00::/7 ULA
  return false;
}

/**
 * Reject a webhook target unless it is a plain http(s) URL whose host resolves
 * exclusively to public addresses. Every resolved address is checked, so a name
 * that returns even one private A/AAAA record is refused.
 */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("Only http(s) webhook URLs are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0) {
    if (isBlockedAddress(host)) {
      throw new SsrfError("Webhook host is not a public address");
    }
    return;
  }
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfError("Webhook host does not resolve");
  }
  if (addrs.length === 0 || addrs.some((a) => isBlockedAddress(a.address))) {
    throw new SsrfError("Webhook host resolves to a non-public address");
  }
}
