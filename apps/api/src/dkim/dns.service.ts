import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { resolveTxt, resolveMx, resolveCname, resolve } from "node:dns/promises";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";
import * as cf from "./cloudflare";

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
    const zoneId = await cf.findZoneId(dr[0].name);
    if (!zoneId) {
      throw new NotFoundException({
        title: "Cloudflare zone not found",
        detail: `No zone for ${dr[0].name}. Add it to Cloudflare first.`,
      });
    }

    const { rows: records } = await this.db.query<RecordRow>(
      "SELECT * FROM dns_records WHERE domain_id = $1 AND managed",
      [domainId],
    );

    const applied: Array<{ purpose: string; action: string }> = [];
    for (const r of records) {
      try {
        const existing = await cf.listRecords(zoneId, r.name, r.type);
        const match = existing.find((e) => e.content === r.content);
        const first = existing[0];
        const cfRec = await cf.upsertRecord(zoneId, match ?? first, {
          type: r.type,
          name: r.name,
          content: r.content,
          ttl: r.ttl,
          priority: r.priority ?? undefined,
        });
        await this.db.query(
          `UPDATE dns_records SET provider_record_id = $2, check_status = 'propagating',
             updated_at = now() WHERE id = $1`,
          [r.id, cfRec.id],
        );
        applied.push({ purpose: r.purpose, action: match ? "kept" : "upserted" });
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
    const { rows } = await this.db.query<RecordRow>(
      "SELECT * FROM dns_records WHERE domain_id = $1",
      [domainId],
    );
    for (const r of rows) {
      let observed: string | null = null;
      let status: RecordRow extends { check_status: infer S } ? S : string;
      try {
        observed = await this.resolveOne(r.type, r.name);
        const matches = observed !== null && observed.includes(strip(r.content));
        status = matches ? "ok" : observed ? "drifted" : "missing";
      } catch (err) {
        observed = (err as Error).message;
        status = "error";
      }
      await this.db.query(
        `UPDATE dns_records SET observed_content = $2, check_status = $3,
           last_checked_at = now() WHERE id = $1`,
        [r.id, observed, status],
      );
    }
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
