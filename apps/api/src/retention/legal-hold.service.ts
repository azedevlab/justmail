import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateLegalHoldRequest, LegalHold } from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface HoldRow {
  id: string;
  org_id: string;
  mailbox_id: string | null;
  mailbox_address: string | null;
  reason: string;
  created_by: string | null;
  created_at: Date;
  released_at: Date | null;
}

@Injectable()
export class LegalHoldService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, userId: string): Promise<LegalHold[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<HoldRow>(
      `SELECT h.id, h.org_id, h.mailbox_id,
              CASE WHEN h.mailbox_id IS NULL THEN NULL
                   ELSE m.local_part || '@' || d.name END AS mailbox_address,
              h.reason, h.created_by, h.created_at, h.released_at
       FROM legal_holds h
       LEFT JOIN mailboxes m ON m.id = h.mailbox_id
       LEFT JOIN domains d ON d.id = m.domain_id
       WHERE h.org_id = $1
       ORDER BY h.released_at IS NOT NULL, h.created_at DESC`,
      [orgId],
    );
    return rows.map(toHold);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    req: CreateLegalHoldRequest,
    ip?: string,
  ): Promise<LegalHold> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const mailboxId = req.mailbox_id ?? null;
    if (mailboxId) await this.assertMailbox(orgId, mailboxId);

    // Reject a duplicate active hold at the same scope.
    const dup = await this.db.query(
      `SELECT 1 FROM legal_holds
       WHERE org_id = $1 AND released_at IS NULL
         AND mailbox_id IS NOT DISTINCT FROM $2`,
      [orgId, mailboxId],
    );
    if (dup.rowCount) {
      throw new ConflictException({ title: "An active hold already exists here" });
    }

    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO legal_holds (org_id, mailbox_id, reason, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, mailboxId, req.reason ?? "", principal.userId],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "legal_hold.create",
      targetType: mailboxId ? "mailbox" : "organization",
      targetId: mailboxId ?? orgId,
      ip,
      meta: { reason: req.reason ?? "" },
    });
    return this.get(orgId, rows[0]!.id, principal.userId);
  }

  async release(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rowCount } = await this.db.query(
      `UPDATE legal_holds SET released_at = now(), released_by = $3
       WHERE id = $2 AND org_id = $1 AND released_at IS NULL`,
      [orgId, id, principal.userId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Active hold not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "legal_hold.release",
      targetType: "legal_hold",
      targetId: id,
      ip,
    });
  }

  /** Mailbox IDs under an active org-wide or mailbox-scoped hold. */
  async heldMailboxIds(orgId: string): Promise<{ orgWide: boolean; ids: Set<string> }> {
    const { rows } = await this.db.query<{ mailbox_id: string | null }>(
      `SELECT mailbox_id FROM legal_holds
       WHERE org_id = $1 AND released_at IS NULL`,
      [orgId],
    );
    const ids = new Set<string>();
    let orgWide = false;
    for (const r of rows) {
      if (r.mailbox_id === null) orgWide = true;
      else ids.add(r.mailbox_id);
    }
    return { orgWide, ids };
  }

  private async get(orgId: string, id: string, userId: string): Promise<LegalHold> {
    const list = await this.list(orgId, userId);
    const found = list.find((h) => h.id === id);
    if (!found) throw new NotFoundException({ title: "Hold not found" });
    return found;
  }

  private async assertMailbox(orgId: string, mailboxId: string) {
    const { rows } = await this.db.query(
      `SELECT 1 FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE m.id = $1 AND d.org_id = $2`,
      [mailboxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Mailbox not found" });
  }
}

function toHold(r: HoldRow): LegalHold {
  return {
    id: r.id,
    org_id: r.org_id,
    mailbox_id: r.mailbox_id,
    mailbox_address: r.mailbox_address,
    reason: r.reason,
    created_by: r.created_by,
    created_at: r.created_at.toISOString(),
    released_at: r.released_at ? r.released_at.toISOString() : null,
  };
}
