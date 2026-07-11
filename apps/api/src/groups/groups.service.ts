import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import type {
  CreateMailGroupRequest,
  MailGroup,
  MailGroupDetail,
  MailGroupMember,
  UpdateMailGroupRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface GroupRow {
  id: string;
  domain_id: string;
  domain_name: string;
  local_part: string;
  name: string;
  description: string | null;
  enabled: boolean;
  allow_member_send: boolean;
  member_count: string | number;
  created_at: Date;
}

interface MemberRow {
  id: string;
  address: string;
  created_at: Date;
}

const GROUP_SELECT = `
  SELECT g.id, g.domain_id, d.name AS domain_name, g.local_part, g.name,
         g.description, g.enabled, g.allow_member_send, g.created_at,
         (SELECT count(*) FROM mail_group_members m WHERE m.group_id = g.id) AS member_count
  FROM mail_groups g JOIN domains d ON d.id = g.domain_id`;

@Injectable()
export class GroupsService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async listOrg(orgId: string, userId: string): Promise<MailGroup[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<GroupRow>(
      `${GROUP_SELECT} WHERE d.org_id = $1 ORDER BY d.name, g.local_part`,
      [orgId],
    );
    return rows.map(toGroup);
  }

  async listDomain(
    orgId: string,
    domainId: string,
    userId: string,
  ): Promise<MailGroup[]> {
    await this.assertDomain(orgId, domainId, userId);
    const { rows } = await this.db.query<GroupRow>(
      `${GROUP_SELECT} WHERE g.domain_id = $1 ORDER BY g.local_part`,
      [domainId],
    );
    return rows.map(toGroup);
  }

  async get(
    orgId: string,
    id: string,
    userId: string,
  ): Promise<MailGroupDetail> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<GroupRow>(
      `${GROUP_SELECT} WHERE g.id = $1 AND d.org_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Group not found" });
    const members = await this.loadMembers(id);
    return { ...toGroup(rows[0]), members };
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    req: CreateMailGroupRequest,
    ip?: string,
  ): Promise<MailGroupDetail> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.assertDomain(orgId, domainId, principal.userId);
    const members = dedupe(req.members);
    const id = await this.db
      .tx(async (tx) => {
        const inserted = await tx.query<{ id: string }>(
          `INSERT INTO mail_groups
             (domain_id, local_part, name, description, enabled, allow_member_send)
           VALUES ($1, $2, $3, $4, COALESCE($5, true), COALESCE($6, false))
           RETURNING id`,
          [
            domainId,
            req.local_part.toLowerCase(),
            req.name,
            req.description ?? null,
            req.enabled ?? null,
            req.allow_member_send ?? null,
          ],
        );
        const gid = inserted.rows[0]!.id;
        await this.insertMembers(tx, gid, members);
        return gid;
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === "23505") {
          throw new ConflictException({ title: "Group address already exists" });
        }
        throw err;
      });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "group.create",
      targetType: "group",
      targetId: id,
      ip,
      meta: { local_part: req.local_part, members: members.length },
    });
    return this.get(orgId, id, principal.userId);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    req: UpdateMailGroupRequest,
    ip?: string,
  ): Promise<MailGroupDetail> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, id, principal.userId);
    const sets: string[] = ["updated_at = now()"];
    const values: unknown[] = [id];
    const push = (col: string, val: unknown) => {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    };
    if (req.name !== undefined) push("name", req.name);
    if (req.description !== undefined) push("description", req.description);
    if (req.enabled !== undefined) push("enabled", req.enabled);
    if (req.allow_member_send !== undefined)
      push("allow_member_send", req.allow_member_send);
    await this.db.query(
      `UPDATE mail_groups SET ${sets.join(", ")} WHERE id = $1`,
      values,
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "group.update",
      targetType: "group",
      targetId: id,
      ip,
      meta: req,
    });
    return this.get(orgId, id, principal.userId);
  }

  async setMembers(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    members: string[],
    ip?: string,
  ): Promise<MailGroupDetail> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, id, principal.userId);
    const next = dedupe(members);
    await this.db.tx(async (tx) => {
      await tx.query("DELETE FROM mail_group_members WHERE group_id = $1", [id]);
      await this.insertMembers(tx, id, next);
    });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "group.members.set",
      targetType: "group",
      targetId: id,
      ip,
      meta: { members: next.length },
    });
    return this.get(orgId, id, principal.userId);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, id, principal.userId);
    await this.db.query("DELETE FROM mail_groups WHERE id = $1", [id]);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "group.delete",
      targetType: "group",
      targetId: id,
      ip,
    });
  }

  private async loadMembers(groupId: string): Promise<MailGroupMember[]> {
    const { rows } = await this.db.query<MemberRow>(
      `SELECT id, address, created_at FROM mail_group_members
       WHERE group_id = $1 ORDER BY address`,
      [groupId],
    );
    return rows.map((r) => ({
      id: r.id,
      address: r.address,
      created_at: r.created_at.toISOString(),
    }));
  }

  private async insertMembers(
    tx: PoolClient,
    groupId: string,
    members: string[],
  ): Promise<void> {
    for (const address of members) {
      await tx.query(
        `INSERT INTO mail_group_members (group_id, address) VALUES ($1, $2)
         ON CONFLICT (group_id, address) DO NOTHING`,
        [groupId, address.toLowerCase()],
      );
    }
  }

  private async assertDomain(orgId: string, domainId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM domains WHERE id = $1 AND org_id = $2",
      [domainId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Domain not found" });
  }
}

function dedupe(addrs: string[]): string[] {
  return [...new Set(addrs.map((a) => a.trim().toLowerCase()).filter(Boolean))];
}

function toGroup(r: GroupRow): MailGroup {
  return {
    id: r.id,
    domain_id: r.domain_id,
    domain_name: r.domain_name,
    local_part: r.local_part,
    address: `${r.local_part}@${r.domain_name}`,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    allow_member_send: r.allow_member_send,
    member_count: Number(r.member_count),
    created_at: r.created_at.toISOString(),
  };
}
