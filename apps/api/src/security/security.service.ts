import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  BlockedIp,
  CreateBlockedIpRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface BlockedIpRow {
  id: string;
  ip: string;
  source: BlockedIp["source"];
  reason: string;
  expires_at: Date | null;
  created_at: Date;
}

@Injectable()
export class SecurityService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async listBlockedIps(orgId: string, userId: string): Promise<BlockedIp[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<BlockedIpRow>(
      `SELECT id, ip::text, source, reason, expires_at, created_at
       FROM blocked_ips ORDER BY created_at DESC LIMIT 500`,
    );
    return rows.map(toBlocked);
  }

  async blockIp(
    principal: SessionPrincipal,
    orgId: string,
    req: CreateBlockedIpRequest,
    ip?: string,
  ): Promise<BlockedIp> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rows } = await this.db.query<BlockedIpRow>(
      `INSERT INTO blocked_ips (ip, source, reason, expires_at)
       VALUES ($1::inet, 'manual', $2, $3)
       ON CONFLICT (ip) DO UPDATE SET reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at
       RETURNING id, ip::text, source, reason, expires_at, created_at`,
      [req.ip, req.reason, req.expires_at ?? null],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "security.ip.block",
      targetType: "ip",
      ip,
      meta: { ip: req.ip, reason: req.reason },
    });
    void this.webhooks.emit(orgId, "security.ip.blocked", {
      ip: req.ip,
      reason: req.reason,
      source: "manual",
    });
    return toBlocked(rows[0]!);
  }

  async unblockIp(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rowCount } = await this.db.query(
      "DELETE FROM blocked_ips WHERE id = $1",
      [id],
    );
    if (!rowCount) throw new NotFoundException({ title: "IP not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "security.ip.unblock",
      targetType: "ip",
      targetId: id,
      ip,
    });
  }

  /** Rough deliverability/security score for the dashboard card. */
  async score(orgId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{
      domains: string;
      verified: string;
      spf: string;
      dkim: string;
      dmarc: string;
      mta_sts: string;
      tls_rpt: string;
    }>(
      `SELECT
         count(*) FILTER (WHERE d.status <> 'suspended') AS domains,
         count(*) FILTER (WHERE d.status = 'active') AS verified,
         count(DISTINCT d.id) FILTER (WHERE r.purpose = 'spf' AND r.check_status = 'ok') AS spf,
         count(DISTINCT d.id) FILTER (WHERE r.purpose = 'dkim' AND r.check_status = 'ok') AS dkim,
         count(DISTINCT d.id) FILTER (WHERE r.purpose = 'dmarc' AND r.check_status = 'ok') AS dmarc,
         count(DISTINCT d.id) FILTER (WHERE r.purpose = 'mta_sts' AND r.check_status = 'ok') AS mta_sts,
         count(DISTINCT d.id) FILTER (WHERE r.purpose = 'tls_rpt' AND r.check_status = 'ok') AS tls_rpt
       FROM domains d LEFT JOIN dns_records r ON r.domain_id = d.id
       WHERE d.org_id = $1`,
      [orgId],
    );
    const r = rows[0]!;
    const domains = Number(r.domains);
    const factors: Array<{ id: string; label: string; ok: boolean; weight: number }> = [
      { id: "verified", label: "Domains verified", ok: Number(r.verified) === domains && domains > 0, weight: 20 },
      { id: "spf", label: "SPF present", ok: Number(r.spf) === domains && domains > 0, weight: 15 },
      { id: "dkim", label: "DKIM signing", ok: Number(r.dkim) === domains && domains > 0, weight: 20 },
      { id: "dmarc", label: "DMARC policy", ok: Number(r.dmarc) === domains && domains > 0, weight: 20 },
      { id: "mta_sts", label: "MTA-STS", ok: Number(r.mta_sts) === domains && domains > 0, weight: 15 },
      { id: "tls_rpt", label: "TLS-RPT", ok: Number(r.tls_rpt) === domains && domains > 0, weight: 10 },
    ];
    const total = factors.reduce((acc, f) => acc + (f.ok ? f.weight : 0), 0);
    return { score: total, factors };
  }
}

function toBlocked(r: BlockedIpRow): BlockedIp {
  return {
    id: r.id,
    ip: r.ip,
    source: r.source,
    reason: r.reason,
    expires_at: r.expires_at ? r.expires_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
  };
}
