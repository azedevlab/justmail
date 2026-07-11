/**
 * DNS provider abstraction for the DNS Center reconciler + DKIM rotation.
 *
 * The reconciler is zone-oriented: resolve the managing zone for a domain, then
 * list/upsert/delete records within it. Cloudflare is the only shipped backend;
 * Route53/deSEC are selectable via DNS_PROVIDER but need their own credentials,
 * so they surface a clear "not configured" error until wired up rather than
 * silently no-oping — a publish that appears to succeed but doesn't would break
 * DKIM/SPF alignment.
 */
import { config } from "../config";
import * as cf from "./cloudflare";

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  priority?: number;
  ttl: number;
}

export interface DnsRecordInput {
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority?: number;
  proxied?: boolean;
}

export interface DnsProvider {
  readonly name: string;
  /** Resolve the managing zone id for a (sub)domain, or null if unmanaged. */
  findZoneId(domain: string): Promise<string | null>;
  listRecords(zoneId: string, name: string, type: string): Promise<DnsRecord[]>;
  upsertRecord(
    zoneId: string,
    existing: DnsRecord | undefined,
    payload: DnsRecordInput,
  ): Promise<DnsRecord>;
  deleteRecord(zoneId: string, id: string): Promise<void>;
}

class CloudflareProvider implements DnsProvider {
  readonly name = "cloudflare";
  findZoneId(domain: string) {
    return cf.findZoneId(domain);
  }
  listRecords(zoneId: string, name: string, type: string) {
    return cf.listRecords(zoneId, name, type);
  }
  upsertRecord(
    zoneId: string,
    existing: DnsRecord | undefined,
    payload: DnsRecordInput,
  ) {
    return cf.upsertRecord(zoneId, existing, payload);
  }
  deleteRecord(zoneId: string, id: string) {
    return cf.deleteRecord(zoneId, id);
  }
}

// Selected but not yet credentialed: every operation fails loudly so a caller
// never mistakes an unconfigured backend for a successful publish.
class UnconfiguredProvider implements DnsProvider {
  constructor(readonly name: string) {}
  private fail(): never {
    throw new Error(
      `DNS provider "${this.name}" is selected but not configured`,
    );
  }
  findZoneId(): Promise<string | null> {
    return this.fail();
  }
  listRecords(): Promise<DnsRecord[]> {
    return this.fail();
  }
  upsertRecord(): Promise<DnsRecord> {
    return this.fail();
  }
  deleteRecord(): Promise<void> {
    return this.fail();
  }
}

const cloudflare = new CloudflareProvider();

export function getDnsProvider(): DnsProvider {
  switch (config.DNS_PROVIDER) {
    case "cloudflare":
      return cloudflare;
    default:
      return new UnconfiguredProvider(config.DNS_PROVIDER);
  }
}
