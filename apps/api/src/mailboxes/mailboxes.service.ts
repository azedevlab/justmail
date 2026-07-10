import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import argon2 from "argon2";
import type {
  CreateMailboxRequest,
  Mailbox,
  UpdateMailboxRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import type { SessionPrincipal } from "../auth/auth.service";

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

interface MailboxRow {
  id: string;
  domain_id: string;
  local_part: string;
  name: string;
  quota_mb: string | number;
  quota_used_bytes: string | number;
  status: Mailbox["status"];
  imap_enabled: boolean;
  pop3_enabled: boolean;
  smtp_enabled: boolean;
  sieve_enabled: boolean;
  autoresponder: Mailbox["autoresponder"] | null;
  forward_to: string[];
  forward_keep_copy: boolean;
  created_at: Date;
  domain_name: string;
  org_id: string;
}

@Injectable()
export class MailboxesService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(orgId: string, domainId: string, userId: string): Promise<Mailbox[]> {
    await this.assertDomain(orgId, domainId, userId);
    const { rows } = await this.db.query<MailboxRow>(
      `SELECT m.*, d.name AS domain_name, d.org_id
       FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE m.domain_id = $1 ORDER BY m.local_part`,
      [domainId],
    );
    return rows.map(toMailbox);
  }

  async listOrg(orgId: string, userId: string): Promise<Mailbox[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<MailboxRow>(
      `SELECT m.*, d.name AS domain_name, d.org_id
       FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE d.org_id = $1 ORDER BY d.name, m.local_part`,
      [orgId],
    );
    return rows.map(toMailbox);
  }

  async get(orgId: string, id: string, userId: string): Promise<Mailbox> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<MailboxRow>(
      `SELECT m.*, d.name AS domain_name, d.org_id
       FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE m.id = $1 AND d.org_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Mailbox not found" });
    return toMailbox(rows[0]);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    req: CreateMailboxRequest,
    ip?: string,
  ): Promise<Mailbox> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.assertDomain(orgId, domainId, principal.userId);
    await this.enforceLimits(orgId, domainId);

    const passwordHash = await argon2.hash(req.password, ARGON2_OPTS);
    const inserted = await this.db
      .query<{ id: string }>(
        `INSERT INTO mailboxes (domain_id, local_part, name, password_hash, quota_mb)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [domainId, req.local_part.toLowerCase(), req.name, passwordHash, req.quota_mb],
      )
      .catch((err: Error & { code?: string }) => {
        if (err.code === "23505") {
          throw new ConflictException({ title: "Mailbox already exists" });
        }
        throw err;
      });

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "mailbox.create",
      targetType: "mailbox",
      targetId: inserted.rows[0]!.id,
      ip,
      meta: { local_part: req.local_part, domain_id: domainId },
    });

    const created = await this.get(orgId, inserted.rows[0]!.id, principal.userId);
    void this.webhooks.emit(orgId, "mailbox.created", {
      id: created.id,
      address: created.address,
      quota_mb: created.quota_mb,
    });
    return created;
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    req: UpdateMailboxRequest,
    ip?: string,
  ): Promise<Mailbox> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, id, principal.userId);

    const sets: string[] = ["updated_at = now()"];
    const values: unknown[] = [id];
    const pushSet = (col: string, val: unknown) => {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    };
    if (req.name !== undefined) pushSet("name", req.name);
    if (req.quota_mb !== undefined) pushSet("quota_mb", req.quota_mb);
    if (req.status !== undefined) pushSet("status", req.status);
    if (req.imap_enabled !== undefined) pushSet("imap_enabled", req.imap_enabled);
    if (req.pop3_enabled !== undefined) pushSet("pop3_enabled", req.pop3_enabled);
    if (req.smtp_enabled !== undefined) pushSet("smtp_enabled", req.smtp_enabled);
    if (req.sieve_enabled !== undefined) pushSet("sieve_enabled", req.sieve_enabled);
    if (req.autoresponder !== undefined) pushSet("autoresponder", req.autoresponder);
    if (req.forward_to !== undefined) pushSet("forward_to", req.forward_to);
    if (req.forward_keep_copy !== undefined)
      pushSet("forward_keep_copy", req.forward_keep_copy);

    await this.db.query(
      `UPDATE mailboxes SET ${sets.join(", ")} WHERE id = $1`,
      values,
    );

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "mailbox.update",
      targetType: "mailbox",
      targetId: id,
      ip,
      meta: req,
    });

    return this.get(orgId, id, principal.userId);
  }

  async setPassword(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    password: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, id, principal.userId);
    const passwordHash = await argon2.hash(password, ARGON2_OPTS);
    await this.db.query(
      "UPDATE mailboxes SET password_hash = $2, updated_at = now() WHERE id = $1",
      [id, passwordHash],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "mailbox.password_set",
      targetType: "mailbox",
      targetId: id,
      ip,
    });
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const box = await this.get(orgId, id, principal.userId);
    await this.db.query("DELETE FROM mailboxes WHERE id = $1", [id]);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "mailbox.delete",
      targetType: "mailbox",
      targetId: id,
      ip,
      meta: { address: box.address },
    });
    void this.webhooks.emit(orgId, "mailbox.deleted", {
      id,
      address: box.address,
    });
  }

  async exportCsv(orgId: string, userId: string): Promise<string> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const boxes = await this.listOrg(orgId, userId);
    const rows = [
      "address,name,quota_mb,status,forward_to",
      ...boxes.map((b) =>
        [
          csv(b.address),
          csv(b.name),
          b.quota_mb,
          b.status,
          csv(b.forward_to.join(";")),
        ].join(","),
      ),
    ];
    return rows.join("\n") + "\n";
  }

  private async assertDomain(orgId: string, domainId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM domains WHERE id = $1 AND org_id = $2",
      [domainId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Domain not found" });
  }

  private async enforceLimits(orgId: string, domainId: string) {
    const { rows } = await this.db.query<{ n: string; max: number | null }>(
      `SELECT (SELECT count(*) FROM mailboxes WHERE domain_id = $1) AS n,
              (SELECT max_mailboxes FROM domains WHERE id = $1) AS max`,
      [domainId],
    );
    const cap = rows[0]?.max;
    if (cap && Number(rows[0]!.n) >= cap) {
      throw new ConflictException({
        title: "Mailbox limit reached",
        detail: `Domain caps at ${cap} mailboxes.`,
      });
    }
    void orgId;
  }
}

function toMailbox(r: MailboxRow): Mailbox {
  return {
    id: r.id,
    domain_id: r.domain_id,
    domain_name: r.domain_name,
    team_id: (r as unknown as { team_id?: string | null }).team_id ?? null,
    local_part: r.local_part,
    address: `${r.local_part}@${r.domain_name}`,
    name: r.name,
    quota_mb: Number(r.quota_mb),
    quota_used_bytes: Number(r.quota_used_bytes),
    status: r.status,
    imap_enabled: r.imap_enabled,
    pop3_enabled: r.pop3_enabled,
    smtp_enabled: r.smtp_enabled,
    sieve_enabled: r.sieve_enabled,
    autoresponder: r.autoresponder,
    forward_to: r.forward_to ?? [],
    forward_keep_copy: r.forward_keep_copy,
    created_at: r.created_at.toISOString(),
  };
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
