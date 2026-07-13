import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { resolveTxt, resolveMx, resolveCname, resolve } from "node:dns/promises";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";
import { getDnsProvider } from "./dns-provider";
import {
  caaEqual,
  caaToString,
  chooseExisting,
  parseCaa,
  staleDuplicates,
} from "./dns-reconcile";

interface RecordRow {
  id: string;
  domain_id: string;
  purpose: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority: number | null;
  provider_record_id: string | null;
  managed: boolean;
}

@Injectable()
export class DnsService {
  private readonly logger = new Logger(DnsService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  /** Reconcile: for every expected record on the domain, upsert into Cloudflare. */
  async syncToProvider(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rows: dr } = await this.db.query<{ name: string }>(
      "SELECT name FROM domains WHERE id = $1 AND org_id = $2",
      [domainId, orgId],
    );
    if (!dr[0]) throw new NotFoundException({ title: "Domain not found" });
    const provider = getDnsProvider();
    const zoneId = await provider.findZoneId(dr[0].name);
    if (!zoneId) {
      throw new NotFoundException({
        title: "DNS zone not found",
        detail: `No ${provider.name} zone for ${dr[0].name}. Add it to your DNS provider first.`,
      });
    }

    const { rows: records } = await this.db.query<RecordRow>(
      "SELECT * FROM dns_records WHERE domain_id = $1 AND managed",
      [domainId],
    );

    const applied: Array<{ purpose: string; action: string }> = [];
    for (const r of records) {
      try {
        const existing = await provider.listRecords(zoneId, r.name, r.type);
        // Match the record by identity, not position: creating a fresh record
        // when none of ours exists (rather than clobbering an unrelated TXT),
        // and updating the one that is genuinely ours otherwise.
        const chosen = chooseExisting(r, existing);
        const exact =
          chosen !== undefined && chosen.content.replace(/^"|"$/g, "").trim() ===
            r.content.replace(/^"|"$/g, "").trim();
        const cfRec = await provider.upsertRecord(zoneId, chosen, {
          type: r.type,
          name: r.name,
          content: r.content,
          ttl: r.ttl,
          priority: r.priority ?? undefined,
        });
        // Remove duplicate SPF/DKIM/DMARC records that would otherwise make the
        // record invalid (e.g. two SPF records => permerror, never green).
        let removed = 0;
        for (const dup of staleDuplicates(r, existing, cfRec)) {
          await provider.deleteRecord(zoneId, dup.id);
          removed += 1;
        }
        await this.db.query(
          `UPDATE dns_records SET provider_record_id = $2, check_status = 'propagating',
             updated_at = now() WHERE id = $1`,
          [r.id, cfRec.id],
        );
        applied.push({
          purpose: r.purpose,
          action: removed
            ? `fixed (${removed} stale removed)`
            : chosen === undefined
              ? "created"
              : exact
                ? "kept"
                : "updated",
        });
      } catch (err) {
        this.logger.warn(`sync ${r.purpose}: ${(err as Error).message}`);
        applied.push({ purpose: r.purpose, action: "error" });
      }
    }

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "dns.sync",
      targetType: "domain",
      targetId: domainId,
      ip,
      meta: { applied },
    });
    return { applied };
  }

  /** Check DNS: resolve every expected record and update check_status. */
  async check(orgId: string, domainId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    // requireRole proves the caller's role in orgId, not that the domain is in
    // that org — confirm ownership before resolving/returning its records.
    const { rows: owned } = await this.db.query(
      "SELECT 1 FROM domains WHERE id = $1 AND org_id = $2",
      [domainId, orgId],
    );
    if (!owned[0]) throw new NotFoundException({ title: "Domain not found" });
    await this.checkRecords(domainId);
    const { rows: updated } = await this.db.query(
      `SELECT id, purpose, type, name, content, ttl, priority, observed_content,
              check_status, last_checked_at
       FROM dns_records WHERE domain_id = $1 ORDER BY purpose, name`,
      [domainId],
    );
    return updated.map((u) => ({
      ...u,
      last_checked_at: u.last_checked_at
        ? (u.last_checked_at as Date).toISOString()
        : null,
    }));
  }

  /**
   * Export every expected record as a BIND-format zone snippet. This is the
   * provider-agnostic path for operators who run their own/local DNS (BIND,
   * PowerDNS, Knot, NSD, Technitium, dnsmasq): download once, import into the
   * zone, then Recheck — no Cloudflare or API credentials required.
   */
  async zoneFile(orgId: string, domainId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows: dr } = await this.db.query<{ name: string }>(
      "SELECT name FROM domains WHERE id = $1 AND org_id = $2",
      [domainId, orgId],
    );
    if (!dr[0]) throw new NotFoundException({ title: "Domain not found" });
    const { rows } = await this.db.query<RecordRow>(
      "SELECT * FROM dns_records WHERE domain_id = $1 ORDER BY purpose, name",
      [domainId],
    );
    return { filename: `${dr[0].name}.zone`, zone: toZoneFile(dr[0].name, rows) };
  }

  /**
   * Worker sweep: re-resolve unsettled records (propagating/missing/error)
   * every tick and refresh settled ones every few hours, so statuses converge
   * to reality — and drift gets noticed — without anyone clicking Recheck.
   */
  async recheckDue(): Promise<{ domains: number }> {
    const { rows } = await this.db.query<{ domain_id: string }>(
      `SELECT DISTINCT domain_id FROM dns_records
        WHERE check_status IN ('propagating', 'missing', 'error')
           OR last_checked_at IS NULL
           OR last_checked_at < now() - interval '6 hours'`,
    );
    for (const r of rows) {
      await this.checkRecords(r.domain_id).catch((err: Error) => {
        this.logger.warn(`recheck ${r.domain_id}: ${err.message}`);
      });
    }
    return { domains: rows.length };
  }

  private async checkRecords(domainId: string): Promise<void> {
    const { rows } = await this.db.query<RecordRow>(
      "SELECT * FROM dns_records WHERE domain_id = $1",
      [domainId],
    );
    for (const r of rows) {
      let observed: string | null = null;
      let status: string;
      try {
        if (r.type === "CAA") {
          // CAA can't be compared as raw text: the resolver returns structured
          // objects while our desired content is BIND-style. Compare canonical
          // (flags, tag, value) tuples so a correctly-published record isn't
          // reported as drifted.
          const recs = (await resolve(r.name, "CAA")) as unknown as Array<
            Record<string, unknown>
          >;
          const parsed = recs
            .map((x) => parseCaa(x))
            .filter((x): x is NonNullable<typeof x> => x !== null);
          observed = parsed.length ? parsed.map(caaToString).join(" | ") : null;
          const expected = parseCaa(r.content);
          const matches = parsed.some((p) => caaEqual(p, expected));
          status = matches ? "ok" : observed ? "drifted" : "missing";
        } else {
          observed = await this.resolveOne(r.type, r.name);
          const matches =
            observed !== null && observed.includes(strip(r.content));
          status = matches ? "ok" : observed ? "drifted" : "missing";
        }
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        // NXDOMAIN / no-data answers mean "not published", not a lookup fault.
        if (code === "ENOTFOUND" || code === "ENODATA") {
          status = "missing";
        } else {
          observed = (err as Error).message;
          status = "error";
        }
      }
      await this.db.query(
        `UPDATE dns_records SET observed_content = $2, check_status = $3,
           last_checked_at = now() WHERE id = $1`,
        [r.id, observed, status],
      );
    }
  }

  private async resolveOne(type: string, name: string): Promise<string | null> {
    if (type === "TXT") {
      const txt = await resolveTxt(name);
      return txt.map((chunks) => chunks.join("")).join(" | ");
    }
    if (type === "MX") {
      const mx = await resolveMx(name);
      return mx.map((m) => `${m.priority} ${m.exchange}`).join(" | ");
    }
    if (type === "CNAME") {
      const c = await resolveCname(name);
      return c.join(" | ");
    }
    const generic = await resolve(name, type as "A" | "AAAA" | "CAA");
    return JSON.stringify(generic);
  }
}

function strip(s: string): string {
  return s.replace(/^"|"$/g, "").trim();
}

export interface ZoneRecord {
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority?: number | null;
}

// Render expected records as a portable BIND zone snippet. Owner names are
// fully qualified (trailing dot) so the file imports cleanly regardless of the
// target server's $ORIGIN.
export function toZoneFile(domain: string, records: ZoneRecord[]): string {
  const lines = [
    `; JustMail DNS records for ${domain}`,
    `; Import into any authoritative DNS server (BIND, PowerDNS, Knot, NSD, Technitium, dnsmasq).`,
    `; Owner names are fully qualified. After the zone reloads, click "Recheck" to verify.`,
    "",
  ];
  for (const r of records) {
    const head = `${fqdn(r.name)}\t${r.ttl}\tIN\t${r.type}`;
    if (r.type === "TXT") lines.push(`${head}\t${txtRdata(r.content)}`);
    else if (r.type === "MX") lines.push(`${head}\t${r.priority ?? 10} ${fqdn(r.content)}`);
    else if (r.type === "CNAME") lines.push(`${head}\t${fqdn(r.content)}`);
    else lines.push(`${head}\t${r.content}`);
  }
  return lines.join("\n") + "\n";
}

function fqdn(name: string): string {
  return name.endsWith(".") ? name : `${name}.`;
}

// TXT rdata is one or more quoted character-strings, each capped at 255 bytes.
function txtRdata(content: string): string {
  const chunks = content.match(/.{1,255}/gs) ?? [""];
  return chunks.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(" ");
}
