import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type {
  AddMemberRequest,
  CreateOrgRequest,
  Org,
  OrgMember,
  OrgQuota,
  OrgRole,
  UpdateOrgRequest,
} from "@justmail/contracts";
import { randomBytes } from "node:crypto";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import type { SessionPrincipal } from "../auth/auth.service";

const ROLE_RANK: Record<OrgRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

@Injectable()
export class OrgsService {
  constructor(
    private readonly db: Db,
    @Inject(forwardRef(() => AuditService))
    private readonly audit: AuditService,
  ) {}

  /** Throws unless the user is a member with at least `minRole`. */
  async requireRole(
    orgId: string,
    userId: string,
    minRole: OrgRole,
  ): Promise<OrgRole> {
    const memberRow = await this.db.query<{ role: OrgRole }>(
      "SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2",
      [orgId, userId],
    );
    let role = memberRow.rows[0]?.role;
    // API-key principals authenticate as their key.id — grant admin on the
    // org the key was issued for.
    if (!role) {
      const keyRow = await this.db.query<{ org_id: string }>(
        "SELECT org_id FROM api_keys WHERE id = $1 AND revoked_at IS NULL",
        [userId],
      );
      if (keyRow.rows[0]?.org_id === orgId) role = "admin";
    }
    if (!role) throw new NotFoundException({ title: "Organization not found" });
    if ((ROLE_RANK[role] ?? -1) < ROLE_RANK[minRole]) {
      throw new ForbiddenException({
        title: "Insufficient role",
        detail: `Requires ${minRole} or higher.`,
      });
    }
    return role;
  }

  async listForUser(userId: string): Promise<Org[]> {
    const { rows } = await this.db.query(
      `SELECT o.id, o.name, o.slug, o.plan, o.created_at
       FROM org_members m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1
       UNION
       SELECT o.id, o.name, o.slug, o.plan, o.created_at
       FROM api_keys k JOIN organizations o ON o.id = k.org_id
       WHERE k.id = $1 AND k.revoked_at IS NULL
       ORDER BY created_at`,
      [userId],
    );
    return rows.map(toOrg);
  }

  async create(principal: SessionPrincipal, req: CreateOrgRequest, ip?: string) {
    const slug = req.slug ?? slugify(req.name);
    const org = await this.db
      .tx(async (tx) => {
        const { rows } = await tx.query(
          `INSERT INTO organizations (name, slug) VALUES ($1, $2)
           RETURNING id, name, slug, plan, created_at`,
          [req.name, slug],
        );
        await tx.query(
          "INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')",
          [rows[0]!.id, principal.userId],
        );
        return rows[0]!;
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === "23505") {
          throw new ConflictException({ title: "Slug already in use" });
        }
        throw err;
      });

    this.audit.log({
      orgId: org.id as string,
      actorType: "user",
      actorId: principal.userId,
      action: "org.create",
      targetType: "organization",
      targetId: org.id as string,
      ip,
    });
    return toOrg(org);
  }

  async get(orgId: string, userId: string): Promise<Org> {
    await this.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query(
      "SELECT id, name, slug, plan, created_at FROM organizations WHERE id = $1",
      [orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Organization not found" });
    return toOrg(rows[0]);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    req: UpdateOrgRequest,
    ip?: string,
  ): Promise<Org> {
    await this.requireRole(orgId, principal.userId, "admin");
    const { rows } = await this.db.query(
      `UPDATE organizations SET name = COALESCE($2, name), updated_at = now()
       WHERE id = $1 RETURNING id, name, slug, plan, created_at`,
      [orgId, req.name ?? null],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "org.update",
      targetType: "organization",
      targetId: orgId,
      ip,
      meta: req,
    });
    return toOrg(rows[0]!);
  }

  async remove(principal: SessionPrincipal, orgId: string, ip?: string) {
    await this.requireRole(orgId, principal.userId, "owner");
    const domains = await this.db.query<{ n: string }>(
      "SELECT count(*) AS n FROM domains WHERE org_id = $1",
      [orgId],
    );
    if (Number(domains.rows[0]?.n ?? 0) > 0) {
      throw new ConflictException({
        title: "Organization has domains",
        detail: "Delete or move its domains first.",
      });
    }
    await this.db.query("DELETE FROM organizations WHERE id = $1", [orgId]);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "org.delete",
      targetType: "organization",
      targetId: orgId,
      ip,
    });
  }

  async listMembers(orgId: string, userId: string): Promise<OrgMember[]> {
    await this.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{
      user_id: string;
      email: string;
      name: string;
      role: OrgRole;
      created_at: Date;
    }>(
      `SELECT m.user_id, u.email, u.name, m.role, m.created_at
       FROM org_members m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1 ORDER BY m.created_at`,
      [orgId],
    );
    return rows.map((r) => ({
      user_id: r.user_id,
      email: r.email,
      name: r.name,
      role: r.role,
      team_id: null,
      created_at: r.created_at.toISOString(),
    }));
  }

  // M1 scope: add existing users only. Email invite flows land in M2.
  async addMember(
    principal: SessionPrincipal,
    orgId: string,
    req: AddMemberRequest,
    ip?: string,
  ) {
    await this.requireRole(orgId, principal.userId, "admin");
    if (req.role === "owner") {
      await this.requireRole(orgId, principal.userId, "owner");
    }
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [req.email],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        title: "User not found",
        detail: "Only existing users can be added in M1; invites arrive in M2.",
      });
    }
    const { rowCount } = await this.db.query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [orgId, rows[0].id, req.role],
    );
    if (!rowCount) {
      throw new ConflictException({ title: "Already a member" });
    }
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "org.member.add",
      targetType: "user",
      targetId: rows[0].id,
      ip,
      meta: { role: req.role },
    });
  }

  async updateMember(
    principal: SessionPrincipal,
    orgId: string,
    userId: string,
    role: OrgRole,
    ip?: string,
  ) {
    const actorRole = await this.requireRole(orgId, principal.userId, "admin");
    if (role === "owner" && actorRole !== "owner") {
      throw new ForbiddenException({ title: "Only owners can grant owner" });
    }
    await this.guardLastOwner(orgId, userId);
    const { rowCount } = await this.db.query(
      "UPDATE org_members SET role = $3 WHERE org_id = $1 AND user_id = $2",
      [orgId, userId, role],
    );
    if (!rowCount) throw new NotFoundException({ title: "Member not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "org.member.update",
      targetType: "user",
      targetId: userId,
      ip,
      meta: { role },
    });
  }

  async removeMember(
    principal: SessionPrincipal,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    if (userId !== principal.userId) {
      await this.requireRole(orgId, principal.userId, "admin");
    }
    await this.guardLastOwner(orgId, userId);
    const { rowCount } = await this.db.query(
      "DELETE FROM org_members WHERE org_id = $1 AND user_id = $2",
      [orgId, userId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Member not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "org.member.remove",
      targetType: "user",
      targetId: userId,
      ip,
    });
  }

  async getQuota(orgId: string, userId: string): Promise<OrgQuota> {
    await this.requireRole(orgId, userId, "viewer");
    return this.computeQuota(orgId);
  }

  async setQuota(
    principal: SessionPrincipal,
    orgId: string,
    storageQuotaMb: number | null,
    ip?: string,
  ): Promise<OrgQuota> {
    await this.requireRole(orgId, principal.userId, "admin");
    const usage = await this.computeQuota(orgId);
    if (storageQuotaMb !== null && storageQuotaMb < usage.allocated_mb) {
      throw new ConflictException({
        title: "Quota below current allocation",
        detail: `Org already allocates ${usage.allocated_mb} MB across ${usage.mailbox_count} mailbox(es).`,
      });
    }
    const { rowCount } = await this.db.query(
      "UPDATE organizations SET storage_quota_mb = $2, updated_at = now() WHERE id = $1",
      [orgId, storageQuotaMb],
    );
    if (!rowCount) throw new NotFoundException({ title: "Organization not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "org.quota.update",
      targetType: "organization",
      targetId: orgId,
      ip,
      meta: { storage_quota_mb: storageQuotaMb },
    });
    return { ...usage, storage_quota_mb: storageQuotaMb };
  }

  /**
   * Throws if adding `addMb` of mailbox allocation would push the org past its
   * storage ceiling. `excludeMailboxId` lets an update recompute without
   * double-counting the mailbox being resized. No-op when the org is unlimited.
   */
  async assertQuota(
    orgId: string,
    addMb: number,
    excludeMailboxId?: string,
  ): Promise<void> {
    const { rows } = await this.db.query<{ cap: string | null; used: string }>(
      `SELECT o.storage_quota_mb AS cap,
              COALESCE((SELECT sum(m.quota_mb) FROM mailboxes m
                        JOIN domains d ON d.id = m.domain_id
                        WHERE d.org_id = $1 AND ($2::uuid IS NULL OR m.id <> $2)), 0) AS used
       FROM organizations o WHERE o.id = $1`,
      [orgId, excludeMailboxId ?? null],
    );
    const cap = rows[0]?.cap;
    if (cap === null || cap === undefined) return;
    const capMb = Number(cap);
    const projected = Number(rows[0]!.used) + addMb;
    if (projected > capMb) {
      throw new ConflictException({
        title: "Org storage quota exceeded",
        detail: `Allocating ${addMb} MB would use ${projected} MB of the ${capMb} MB org quota.`,
      });
    }
  }

  private async computeQuota(orgId: string): Promise<OrgQuota> {
    const { rows } = await this.db.query<{
      cap: string | null;
      allocated: string;
      used: string;
      n: string;
    }>(
      `SELECT o.storage_quota_mb AS cap,
              COALESCE(sum(m.quota_mb), 0) AS allocated,
              COALESCE(sum(m.quota_used_bytes), 0) AS used,
              count(m.id) AS n
       FROM organizations o
       LEFT JOIN domains d ON d.org_id = o.id
       LEFT JOIN mailboxes m ON m.domain_id = d.id
       WHERE o.id = $1
       GROUP BY o.storage_quota_mb`,
      [orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Organization not found" });
    return {
      org_id: orgId,
      storage_quota_mb: rows[0].cap === null ? null : Number(rows[0].cap),
      allocated_mb: Number(rows[0].allocated),
      used_bytes: Number(rows[0].used),
      mailbox_count: Number(rows[0].n),
    };
  }

  private async guardLastOwner(orgId: string, userId: string): Promise<void> {
    const { rows } = await this.db.query<{ role: OrgRole; n: string }>(
      `SELECT role, (SELECT count(*) FROM org_members WHERE org_id = $1 AND role = 'owner') AS n
       FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId],
    );
    if (rows[0]?.role === "owner" && Number(rows[0].n) <= 1) {
      throw new ConflictException({
        title: "Cannot remove the last owner",
      });
    }
  }
}

function toOrg(row: Record<string, unknown>): Org {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    plan: row.plan as string,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `org-${randomBytes(4).toString("hex")}`;
}
