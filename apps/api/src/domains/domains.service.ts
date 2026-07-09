import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateDomainRequest,
  Domain,
  DomainVerifyResponse,
  UpdateDomainRequest,
} from "@justmail/types";
import { resolveTxt } from "node:dns/promises";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import type { SessionPrincipal } from "../auth/auth.service";
import { config } from "../config";

// Expected DNS records seeded on domain create. `content` uses ${DOMAIN} and
// ${TOKEN} placeholders substituted when we insert into dns_records.
const SEED_RECORDS: Array<{
  purpose: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority?: number;
}> = [
  { purpose: "verification", type: "TXT", name: "_justmail-verify.${DOMAIN}", content: "justmail-verify=${TOKEN}", ttl: 300 },
  { purpose: "mx", type: "MX", name: "${DOMAIN}", content: "mail.${MAIL_ROOT}", ttl: 3600, priority: 10 },
  { purpose: "spf", type: "TXT", name: "${DOMAIN}", content: "v=spf1 mx include:${MAIL_ROOT} ~all", ttl: 3600 },
  { purpose: "dmarc", type: "TXT", name: "_dmarc.${DOMAIN}", content: "v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}; ruf=mailto:dmarc@${DOMAIN}; fo=1", ttl: 3600 },
  { purpose: "mta_sts", type: "TXT", name: "_mta-sts.${DOMAIN}", content: "v=STSv1; id=${TOKEN}", ttl: 3600 },
  { purpose: "tls_rpt", type: "TXT", name: "_smtp._tls.${DOMAIN}", content: "v=TLSRPTv1; rua=mailto:tls-rpt@${DOMAIN}", ttl: 3600 },
  { purpose: "autoconfig", type: "CNAME", name: "autoconfig.${DOMAIN}", content: "autoconfig.${MAIL_ROOT}", ttl: 3600 },
  { purpose: "autodiscover", type: "CNAME", name: "autodiscover.${DOMAIN}", content: "autodiscover.${MAIL_ROOT}", ttl: 3600 },
  // BIMI default selector — l= points at an org-hosted logo SVG; a= (Verified
  // Mark Certificate URL) is left empty until the customer uploads one via
  // the Deliverability screen.
  { purpose: "bimi", type: "TXT", name: "default._bimi.${DOMAIN}", content: "v=BIMI1; l=https://${DOMAIN}/.well-known/bimi-logo.svg;", ttl: 3600 },
  // CAA locks down issuance to Let's Encrypt so a hijacked DNS account can't
  // mint rogue certs from another CA.
  { purpose: "caa", type: "CAA", name: "${DOMAIN}", content: "0 issue \"letsencrypt.org\"", ttl: 3600 },
];

interface DomainRow {
  id: string;
  org_id: string;
  name: string;
  status: Domain["status"];
  verification_token: string;
  is_primary: boolean;
  catch_all_target: string | null;
  max_mailboxes: number | null;
  max_quota_mb: string | number | null;
  outbound_mode: Domain["outbound_mode"];
  mailbox_count: string | number;
  created_at: Date;
}

@Injectable()
export class DomainsService {
  private readonly mailRoot: string;

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {
    // Derive the platform's own root (e.g. api.justmail.devlab.az → devlab.az).
    // Falls back to whatever's after the second dot; users can override in settings.
    this.mailRoot = extractRoot(config.JM_WEB_HOST ?? "justmail.local");
  }

  async list(orgId: string, userId: string): Promise<Domain[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<DomainRow>(
      `SELECT d.*, (SELECT count(*) FROM mailboxes m WHERE m.domain_id = d.id) AS mailbox_count
       FROM domains d WHERE org_id = $1 ORDER BY created_at`,
      [orgId],
    );
    return rows.map(toDomain);
  }

  async get(orgId: string, domainId: string, userId: string): Promise<Domain> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<DomainRow>(
      `SELECT d.*, (SELECT count(*) FROM mailboxes m WHERE m.domain_id = d.id) AS mailbox_count
       FROM domains d WHERE id = $1 AND org_id = $2`,
      [domainId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Domain not found" });
    return toDomain(rows[0]);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    req: CreateDomainRequest,
    ip?: string,
  ): Promise<Domain> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const name = req.name.toLowerCase();

    const created = await this.db
      .tx(async (tx) => {
        if (req.is_primary) {
          await tx.query(
            "UPDATE domains SET is_primary = false WHERE org_id = $1 AND is_primary",
            [orgId],
          );
        }
        const inserted = await tx.query<DomainRow>(
          `INSERT INTO domains (org_id, name, is_primary)
           VALUES ($1, $2, COALESCE($3, false))
           RETURNING *`,
          [orgId, name, req.is_primary ?? null],
        );
        const domain = inserted.rows[0]!;
        await seedDnsRecords(tx, domain.id, name, domain.verification_token, this.mailRoot);
        return domain;
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === "23505") {
          throw new ConflictException({ title: "Domain already in use" });
        }
        throw err;
      });

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "domain.create",
      targetType: "domain",
      targetId: created.id,
      ip,
      meta: { name },
    });

    return this.get(orgId, created.id, principal.userId);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    req: UpdateDomainRequest,
    ip?: string,
  ): Promise<Domain> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, domainId, principal.userId); // 404 guard

    await this.db.tx(async (tx) => {
      if (req.is_primary) {
        await tx.query(
          "UPDATE domains SET is_primary = false WHERE org_id = $1 AND id <> $2 AND is_primary",
          [orgId, domainId],
        );
      }
      const sets: string[] = ["updated_at = now()"];
      const values: unknown[] = [domainId];
      const pushSet = (col: string, val: unknown) => {
        values.push(val);
        sets.push(`${col} = $${values.length}`);
      };
      if (req.is_primary !== undefined) pushSet("is_primary", req.is_primary);
      if (req.catch_all_target !== undefined) pushSet("catch_all_target", req.catch_all_target);
      if (req.max_mailboxes !== undefined) pushSet("max_mailboxes", req.max_mailboxes);
      if (req.max_quota_mb !== undefined) pushSet("max_quota_mb", req.max_quota_mb);
      if (req.outbound_mode !== undefined) pushSet("outbound_mode", req.outbound_mode);
      if (req.status !== undefined) pushSet("status", req.status);
      await tx.query(
        `UPDATE domains SET ${sets.join(", ")} WHERE id = $1`,
        values,
      );
    });

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "domain.update",
      targetType: "domain",
      targetId: domainId,
      ip,
      meta: req,
    });

    return this.get(orgId, domainId, principal.userId);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const domain = await this.get(orgId, domainId, principal.userId);
    if (domain.mailbox_count > 0) {
      throw new ConflictException({
        title: "Domain has mailboxes",
        detail: "Delete mailboxes first.",
      });
    }
    await this.db.query("DELETE FROM domains WHERE id = $1", [domainId]);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "domain.delete",
      targetType: "domain",
      targetId: domainId,
      ip,
      meta: { name: domain.name },
    });
  }

  async verify(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    ip?: string,
  ): Promise<DomainVerifyResponse> {
    await this.orgs.requireRole(orgId, principal.userId, "member");
    const domain = await this.get(orgId, domainId, principal.userId);

    const expected = `justmail-verify=${domain.verification_token}`;
    let ok = false;
    let observed: string | null = null;
    try {
      const records = await resolveTxt(`_justmail-verify.${domain.name}`);
      const flat = records.map((r) => r.join(""));
      observed = flat.join("; ");
      ok = flat.includes(expected);
    } catch (err) {
      observed = (err as Error).message;
    }

    const nextStatus: Domain["status"] = ok
      ? "active"
      : domain.status === "active"
      ? "active"
      : "verifying";

    await this.db.tx(async (tx) => {
      await tx.query(
        `UPDATE dns_records SET check_status = $2, observed_content = $3, last_checked_at = now()
         WHERE domain_id = $1 AND purpose = 'verification'`,
        [domainId, ok ? "ok" : observed?.length ? "drifted" : "missing", observed],
      );
      if (domain.status !== nextStatus) {
        await tx.query(
          "UPDATE domains SET status = $2, updated_at = now() WHERE id = $1",
          [domainId, nextStatus],
        );
      }
    });

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "domain.verify",
      targetType: "domain",
      targetId: domainId,
      ip,
      meta: { ok, status: nextStatus },
    });
    if (ok && domain.status !== "active") {
      void this.webhooks.emit(orgId, "domain.verified", {
        id: domainId,
        name: domain.name,
      });
    }

    return this.getDns(orgId, domainId, principal.userId).then((records) => ({
      status: nextStatus,
      records,
    }));
  }

  async getDns(orgId: string, domainId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    await this.get(orgId, domainId, userId); // 404 guard
    const { rows } = await this.db.query(
      `SELECT id, purpose, type, name, content, ttl, priority, observed_content,
              check_status, last_checked_at
       FROM dns_records WHERE domain_id = $1 ORDER BY purpose, name`,
      [domainId],
    );
    return rows.map((r) => ({
      id: r.id,
      purpose: r.purpose,
      type: r.type,
      name: r.name,
      content: r.content,
      ttl: r.ttl,
      priority: r.priority,
      observed_content: r.observed_content,
      check_status: r.check_status,
      last_checked_at: r.last_checked_at ? (r.last_checked_at as Date).toISOString() : null,
    }));
  }
}

async function seedDnsRecords(
  tx: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  domainId: string,
  name: string,
  token: string,
  mailRoot: string,
): Promise<void> {
  const subst = (s: string) =>
    s.replace(/\$\{DOMAIN\}/g, name).replace(/\$\{TOKEN\}/g, token).replace(/\$\{MAIL_ROOT\}/g, mailRoot);
  for (const r of SEED_RECORDS) {
    await tx.query(
      `INSERT INTO dns_records (domain_id, purpose, type, name, content, ttl, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [domainId, r.purpose, r.type, subst(r.name), subst(r.content), r.ttl, r.priority ?? null],
    );
  }
}

function toDomain(r: DomainRow): Domain {
  return {
    id: r.id,
    org_id: r.org_id,
    name: r.name,
    status: r.status,
    verification_token: r.verification_token,
    is_primary: r.is_primary,
    catch_all_target: r.catch_all_target,
    max_mailboxes: r.max_mailboxes,
    max_quota_mb: r.max_quota_mb === null ? null : Number(r.max_quota_mb),
    outbound_mode: r.outbound_mode,
    mailbox_count: Number(r.mailbox_count),
    created_at: r.created_at.toISOString(),
  };
}

function extractRoot(host: string): string {
  const parts = host.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : host;
}
