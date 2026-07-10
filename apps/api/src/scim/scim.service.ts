import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  OrgRole,
  ScimConfig,
  ScimConfigRequest,
  ScimGroupRoleMap,
  ScimTokenResult,
} from "@justmail/contracts";
import type { PoolClient } from "pg";
import { config } from "../config";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";
import { resolveRole } from "../ldap/mapping";

// ── Row types ────────────────────────────────────────────────────────────────
interface ConfigRow {
  org_id: string;
  enabled: boolean;
  token_hash: string | null;
  token_prefix: string | null;
  default_role: OrgRole;
  group_role_map: ScimGroupRoleMap;
  deactivate: boolean;
  last_request_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface UserRow {
  id: string;
  org_id: string;
  user_id: string;
  external_id: string | null;
  user_name: string;
  active: boolean;
  raw: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface GroupRow {
  id: string;
  org_id: string;
  external_id: string | null;
  display_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface ScimContext {
  orgId: string;
  config: ConfigRow;
}

// ── SCIM 2.0 wire shapes (RFC 7643/7644) ─────────────────────────────────────
const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
const LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const PATCH_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";

interface ScimName {
  formatted?: string;
  givenName?: string;
  familyName?: string;
}
interface ScimEmail {
  value: string;
  primary?: boolean;
  type?: string;
}
interface ScimUser {
  schemas: string[];
  id?: string;
  externalId?: string;
  userName?: string;
  name?: ScimName;
  displayName?: string;
  emails?: ScimEmail[];
  active?: boolean;
}
interface ScimMember {
  value: string;
  display?: string;
}
interface ScimGroup {
  schemas: string[];
  id?: string;
  externalId?: string;
  displayName?: string;
  members?: ScimMember[];
}
interface PatchOp {
  op: string;
  path?: string;
  value?: unknown;
}
interface PatchBody {
  schemas?: string[];
  Operations?: PatchOp[];
}

export interface ListParams {
  filter?: string;
  startIndex?: number;
  count?: number;
}

@Injectable()
export class ScimService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly orgs: OrgsService,
  ) {}

  // ── Admin control plane ────────────────────────────────────────────────────
  private apiBase(): string {
    const base = config.JM_API_HOST
      ? `https://${config.JM_API_HOST}`
      : (config.SSO_CALLBACK_BASE_URL ?? "http://localhost:3000");
    return base.replace(/\/$/, "");
  }

  baseUrl(orgId: string): string {
    return `${this.apiBase()}/v1/scim/v2/${orgId}`;
  }

  async getConfig(orgId: string, userId: string): Promise<ScimConfig> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const row = await this.ensureConfig(orgId);
    return this.toConfig(row);
  }

  async updateConfig(
    principal: SessionPrincipal,
    orgId: string,
    req: ScimConfigRequest,
    ip?: string,
  ): Promise<ScimConfig> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.ensureConfig(orgId);
    const { rows } = await this.db.query<ConfigRow>(
      `UPDATE scim_configs SET
         enabled = $2, default_role = $3, group_role_map = $4,
         deactivate = $5, updated_at = now()
       WHERE org_id = $1 RETURNING *`,
      [
        orgId,
        req.enabled,
        req.default_role,
        JSON.stringify(req.group_role_map),
        req.deactivate,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "scim.config.update",
      targetType: "scim_config",
      targetId: orgId,
      ip,
    });
    return this.toConfig(rows[0]!);
  }

  async generateToken(
    principal: SessionPrincipal,
    orgId: string,
    ip?: string,
  ): Promise<ScimTokenResult> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.ensureConfig(orgId);
    const token = `scim_${randomBytes(30).toString("base64url")}`;
    await this.db.query(
      "UPDATE scim_configs SET token_hash = $2, token_prefix = $3, updated_at = now() WHERE org_id = $1",
      [orgId, sha256(token), token.slice(0, 12)],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "scim.token.rotate",
      targetType: "scim_config",
      targetId: orgId,
      ip,
    });
    return { token, base_url: this.baseUrl(orgId) };
  }

  async revokeToken(
    principal: SessionPrincipal,
    orgId: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.db.query(
      "UPDATE scim_configs SET token_hash = NULL, token_prefix = NULL, updated_at = now() WHERE org_id = $1",
      [orgId],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "scim.token.revoke",
      targetType: "scim_config",
      targetId: orgId,
      ip,
    });
  }

  private async ensureConfig(orgId: string): Promise<ConfigRow> {
    const { rows } = await this.db.query<ConfigRow>(
      `INSERT INTO scim_configs (org_id) VALUES ($1)
       ON CONFLICT (org_id) DO UPDATE SET org_id = EXCLUDED.org_id
       RETURNING *`,
      [orgId],
    );
    return rows[0]!;
  }

  private toConfig(row: ConfigRow): ScimConfig {
    return {
      org_id: row.org_id,
      enabled: row.enabled,
      base_url: this.baseUrl(row.org_id),
      has_token: row.token_hash !== null,
      token_prefix: row.token_prefix,
      default_role: row.default_role,
      group_role_map: row.group_role_map,
      deactivate: row.deactivate,
      last_request_at: row.last_request_at
        ? row.last_request_at.toISOString()
        : null,
      user_count: 0,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  async userCount(orgId: string): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM scim_users WHERE org_id = $1",
      [orgId],
    );
    return Number(rows[0]!.n);
  }

  // ── Bearer authentication (SCIM endpoints) ─────────────────────────────────
  async authenticate(orgId: string, token: string): Promise<ScimContext> {
    const { rows } = await this.db.query<ConfigRow>(
      "SELECT * FROM scim_configs WHERE org_id = $1",
      [orgId],
    );
    const cfg = rows[0];
    if (!cfg || !cfg.enabled || !cfg.token_hash) {
      throw new UnauthorizedException({ title: "SCIM not enabled" });
    }
    const provided = sha256(token);
    if (
      provided.length !== cfg.token_hash.length ||
      !timingSafeEqual(Buffer.from(cfg.token_hash), Buffer.from(provided))
    ) {
      throw new UnauthorizedException({ title: "Invalid SCIM token" });
    }
    void this.db.query(
      "UPDATE scim_configs SET last_request_at = now() WHERE org_id = $1",
      [orgId],
    );
    return { orgId, config: cfg };
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async listUsers(ctx: ScimContext, params: ListParams): Promise<object> {
    const filter = parseEqFilter(params.filter);
    const where: string[] = ["org_id = $1"];
    const args: unknown[] = [ctx.orgId];
    if (filter?.attr === "userName") {
      args.push(filter.value.toLowerCase());
      where.push(`lower(user_name) = $${args.length}`);
    } else if (filter?.attr === "externalId") {
      args.push(filter.value);
      where.push(`external_id = $${args.length}`);
    }
    const { rows } = await this.db.query<UserRow>(
      `SELECT * FROM scim_users WHERE ${where.join(" AND ")} ORDER BY created_at`,
      args,
    );
    return this.listResponse(
      rows.map((r) => this.toUser(r, ctx)),
      params,
    );
  }

  async getUser(ctx: ScimContext, id: string): Promise<object> {
    return this.toUser(await this.loadUser(ctx, id), ctx);
  }

  async createUser(
    ctx: ScimContext,
    raw: Record<string, unknown>,
  ): Promise<object> {
    const body = raw as unknown as ScimUser;
    const userName = (body.userName ?? "").trim();
    const email = primaryEmail(body) ?? userName;
    if (!userName || !email.includes("@")) {
      throw new ConflictException({ title: "userName must be an email" });
    }
    const existing = await this.db.query<UserRow>(
      "SELECT * FROM scim_users WHERE org_id = $1 AND lower(user_name) = $2",
      [ctx.orgId, userName.toLowerCase()],
    );
    if (existing.rows[0]) {
      throw new ConflictException({ title: "User already exists" });
    }
    const active = body.active ?? true;
    const displayName = displayNameOf(body);

    const row = await this.db.tx(async (tx) => {
      const userId = await this.resolveLocalUser(tx, email, displayName);
      await tx.query(
        `INSERT INTO org_members (org_id, user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING`,
        [ctx.orgId, userId, ctx.config.default_role],
      );
      const inserted = await tx.query<UserRow>(
        `INSERT INTO scim_users
           (org_id, user_id, external_id, user_name, active, raw)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          ctx.orgId,
          userId,
          body.externalId ?? null,
          userName,
          active,
          JSON.stringify(rawOf(body)),
        ],
      );
      if (!active) {
        await tx.query("UPDATE users SET status = 'suspended' WHERE id = $1", [
          userId,
        ]);
      }
      return inserted.rows[0]!;
    });

    this.audit.log({
      orgId: ctx.orgId,
      actorType: "system",
      action: "scim.user.create",
      targetType: "user",
      targetId: row.user_id,
      meta: { userName },
    });
    return this.toUser(row, ctx);
  }

  async replaceUser(
    ctx: ScimContext,
    id: string,
    raw: Record<string, unknown>,
  ): Promise<object> {
    const body = raw as unknown as ScimUser;
    const row = await this.loadUser(ctx, id);
    const active = body.active ?? true;
    const userName = (body.userName ?? row.user_name).trim();
    const displayName = displayNameOf(body);
    const updated = await this.db.tx(async (tx) => {
      const res = await tx.query<UserRow>(
        `UPDATE scim_users SET
           external_id = $2, user_name = $3, active = $4, raw = $5, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [
          row.id,
          body.externalId ?? row.external_id,
          userName,
          active,
          JSON.stringify(rawOf(body)),
        ],
      );
      await this.applyActive(tx, row.user_id, active);
      if (displayName) {
        await tx.query(
          "UPDATE users SET name = $2, updated_at = now() WHERE id = $1",
          [row.user_id, displayName],
        );
      }
      return res.rows[0]!;
    });
    return this.toUser(updated, ctx);
  }

  async patchUser(
    ctx: ScimContext,
    id: string,
    raw: Record<string, unknown>,
  ): Promise<object> {
    const body = raw as unknown as PatchBody;
    const row = await this.loadUser(ctx, id);
    let active = row.active;
    let userName = row.user_name;
    let externalId = row.external_id;
    for (const op of body.Operations ?? []) {
      if (op.op.toLowerCase() === "remove") continue;
      const path = (op.path ?? "").toLowerCase();
      if (path === "active") active = toBool(op.value);
      else if (path === "username" && typeof op.value === "string")
        userName = op.value;
      else if (path === "externalid" && typeof op.value === "string")
        externalId = op.value;
      else if (!op.path && op.value && typeof op.value === "object") {
        const v = op.value as Record<string, unknown>;
        if ("active" in v) active = toBool(v.active);
        if (typeof v.userName === "string") userName = v.userName;
        if (typeof v.externalId === "string") externalId = v.externalId;
      }
    }
    const updated = await this.db.tx(async (tx) => {
      const res = await tx.query<UserRow>(
        `UPDATE scim_users SET active = $2, user_name = $3, external_id = $4,
           updated_at = now() WHERE id = $1 RETURNING *`,
        [row.id, active, userName, externalId],
      );
      await this.applyActive(tx, row.user_id, active);
      return res.rows[0]!;
    });
    return this.toUser(updated, ctx);
  }

  async deleteUser(ctx: ScimContext, id: string): Promise<void> {
    const row = await this.loadUser(ctx, id);
    await this.db.tx(async (tx) => {
      await tx.query("DELETE FROM scim_users WHERE id = $1", [row.id]);
      if (ctx.config.deactivate) {
        await tx.query(
          "UPDATE users SET status = 'suspended', updated_at = now() WHERE id = $1",
          [row.user_id],
        );
      }
    });
    this.audit.log({
      orgId: ctx.orgId,
      actorType: "system",
      action: "scim.user.delete",
      targetType: "user",
      targetId: row.user_id,
    });
  }

  // Reflect the SCIM active flag onto the local account: reactivating lifts a
  // prior suspension; active=false deprovisions by suspending.
  private async applyActive(
    tx: PoolClient,
    userId: string,
    active: boolean,
  ): Promise<void> {
    await tx.query(
      active
        ? "UPDATE users SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'suspended'"
        : "UPDATE users SET status = 'suspended', updated_at = now() WHERE id = $1",
      [userId],
    );
  }

  private async resolveLocalUser(
    tx: PoolClient,
    email: string,
    displayName: string,
  ): Promise<string> {
    const found = await tx.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    if (found.rows[0]) return found.rows[0].id;
    const created = await tx.query<{ id: string }>(
      "INSERT INTO users (email, name, status) VALUES ($1, $2, 'active') RETURNING id",
      [email, displayName],
    );
    return created.rows[0]!.id;
  }

  private async loadUser(ctx: ScimContext, id: string): Promise<UserRow> {
    if (!isUuid(id)) throw new NotFoundException({ title: "User not found" });
    const { rows } = await this.db.query<UserRow>(
      "SELECT * FROM scim_users WHERE id = $1 AND org_id = $2",
      [id, ctx.orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "User not found" });
    return rows[0];
  }

  private toUser(row: UserRow, ctx: ScimContext): ScimUser & {
    meta: object;
  } {
    const raw = row.raw ?? {};
    return {
      schemas: [USER_SCHEMA],
      id: row.id,
      ...(row.external_id ? { externalId: row.external_id } : {}),
      userName: row.user_name,
      ...(raw.name ? { name: raw.name as ScimName } : {}),
      ...(raw.displayName ? { displayName: raw.displayName as string } : {}),
      emails: [{ value: row.user_name, primary: true }],
      active: row.active,
      meta: {
        resourceType: "User",
        created: row.created_at.toISOString(),
        lastModified: row.updated_at.toISOString(),
        location: `${this.baseUrl(ctx.orgId)}/Users/${row.id}`,
      },
    };
  }

  // ── Groups ─────────────────────────────────────────────────────────────────
  async listGroups(ctx: ScimContext, params: ListParams): Promise<object> {
    const filter = parseEqFilter(params.filter);
    const where: string[] = ["org_id = $1"];
    const args: unknown[] = [ctx.orgId];
    if (filter?.attr === "displayName") {
      args.push(filter.value.toLowerCase());
      where.push(`lower(display_name) = $${args.length}`);
    }
    const { rows } = await this.db.query<GroupRow>(
      `SELECT * FROM scim_groups WHERE ${where.join(" AND ")} ORDER BY created_at`,
      args,
    );
    const resources = await Promise.all(
      rows.map((r) => this.toGroup(r, ctx)),
    );
    return this.listResponse(resources, params);
  }

  async getGroup(ctx: ScimContext, id: string): Promise<object> {
    return this.toGroup(await this.loadGroup(ctx, id), ctx);
  }

  async createGroup(
    ctx: ScimContext,
    raw: Record<string, unknown>,
  ): Promise<object> {
    const body = raw as unknown as ScimGroup;
    const displayName = (body.displayName ?? "").trim();
    if (!displayName) {
      throw new ConflictException({ title: "displayName is required" });
    }
    const dup = await this.db.query<GroupRow>(
      "SELECT * FROM scim_groups WHERE org_id = $1 AND lower(display_name) = $2",
      [ctx.orgId, displayName.toLowerCase()],
    );
    if (dup.rows[0]) throw new ConflictException({ title: "Group exists" });
    const row = await this.db.tx(async (tx) => {
      const inserted = await tx.query<GroupRow>(
        `INSERT INTO scim_groups (org_id, external_id, display_name)
         VALUES ($1, $2, $3) RETURNING *`,
        [ctx.orgId, body.externalId ?? null, displayName],
      );
      const group = inserted.rows[0]!;
      const memberIds = await this.setMembers(
        tx,
        ctx,
        group.id,
        (body.members ?? []).map((m) => m.value),
      );
      await this.recomputeRoles(tx, ctx, memberIds);
      return group;
    });
    return this.toGroup(row, ctx);
  }

  async patchGroup(
    ctx: ScimContext,
    id: string,
    raw: Record<string, unknown>,
  ): Promise<object> {
    const body = raw as unknown as PatchBody;
    const group = await this.loadGroup(ctx, id);
    const affected = await this.db.tx(async (tx) => {
      const touched = new Set<string>();
      for (const op of body.Operations ?? []) {
        const opName = op.op.toLowerCase();
        const path = (op.path ?? "").toLowerCase();
        if (path.startsWith("members")) {
          const values = memberValues(op.value);
          if (opName === "add") {
            const ids = await this.addMembers(tx, ctx, group.id, values);
            ids.forEach((i) => touched.add(i));
          } else if (opName === "remove") {
            // path may be members[value eq "x"]; fall back to op.value list
            const target = memberFromPath(op.path) ?? values;
            const ids = await this.removeMembers(tx, ctx, group.id, target);
            ids.forEach((i) => touched.add(i));
          } else if (opName === "replace") {
            const before = await this.memberUserIds(tx, group.id);
            before.forEach((i) => touched.add(i));
            const ids = await this.setMembers(tx, ctx, group.id, values);
            ids.forEach((i) => touched.add(i));
          }
        } else if (
          (path === "displayname" || !op.path) &&
          typeof valueDisplayName(op) === "string"
        ) {
          await tx.query(
            "UPDATE scim_groups SET display_name = $2, updated_at = now() WHERE id = $1",
            [group.id, valueDisplayName(op)],
          );
          const members = await this.memberUserIds(tx, group.id);
          members.forEach((i) => touched.add(i));
        }
      }
      await this.recomputeRoles(tx, ctx, [...touched]);
      return touched;
    });
    void affected;
    return this.toGroup(await this.loadGroup(ctx, id), ctx);
  }

  async replaceGroup(
    ctx: ScimContext,
    id: string,
    raw: Record<string, unknown>,
  ): Promise<object> {
    const body = raw as unknown as ScimGroup;
    const group = await this.loadGroup(ctx, id);
    await this.db.tx(async (tx) => {
      if (body.displayName) {
        await tx.query(
          "UPDATE scim_groups SET display_name = $2, external_id = $3, updated_at = now() WHERE id = $1",
          [group.id, body.displayName.trim(), body.externalId ?? group.external_id],
        );
      }
      const before = await this.memberUserIds(tx, group.id);
      const after = await this.setMembers(
        tx,
        ctx,
        group.id,
        (body.members ?? []).map((m) => m.value),
      );
      await this.recomputeRoles(tx, ctx, [...new Set([...before, ...after])]);
    });
    return this.toGroup(await this.loadGroup(ctx, id), ctx);
  }

  async deleteGroup(ctx: ScimContext, id: string): Promise<void> {
    const group = await this.loadGroup(ctx, id);
    await this.db.tx(async (tx) => {
      const members = await this.memberUserIds(tx, group.id);
      await tx.query("DELETE FROM scim_groups WHERE id = $1", [group.id]);
      await this.recomputeRoles(tx, ctx, members);
    });
  }

  // Resolve a SCIM member value (our scim_users.id) list against the group,
  // returning the affected local user_ids for role recomputation.
  private async setMembers(
    tx: PoolClient,
    ctx: ScimContext,
    groupId: string,
    scimUserIds: string[],
  ): Promise<string[]> {
    await tx.query("DELETE FROM scim_group_members WHERE group_id = $1", [
      groupId,
    ]);
    return this.addMembers(tx, ctx, groupId, scimUserIds);
  }

  private async addMembers(
    tx: PoolClient,
    ctx: ScimContext,
    groupId: string,
    scimUserIds: string[],
  ): Promise<string[]> {
    const userIds: string[] = [];
    for (const sid of scimUserIds) {
      if (!isUuid(sid)) continue;
      const found = await tx.query<{ user_id: string }>(
        "SELECT user_id FROM scim_users WHERE id = $1 AND org_id = $2",
        [sid, ctx.orgId],
      );
      if (!found.rows[0]) continue;
      await tx.query(
        `INSERT INTO scim_group_members (group_id, scim_user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [groupId, sid],
      );
      userIds.push(found.rows[0].user_id);
    }
    return userIds;
  }

  private async removeMembers(
    tx: PoolClient,
    ctx: ScimContext,
    groupId: string,
    scimUserIds: string[],
  ): Promise<string[]> {
    const userIds: string[] = [];
    for (const sid of scimUserIds) {
      if (!isUuid(sid)) continue;
      const found = await tx.query<{ user_id: string }>(
        "SELECT user_id FROM scim_users WHERE id = $1 AND org_id = $2",
        [sid, ctx.orgId],
      );
      await tx.query(
        "DELETE FROM scim_group_members WHERE group_id = $1 AND scim_user_id = $2",
        [groupId, sid],
      );
      if (found.rows[0]) userIds.push(found.rows[0].user_id);
    }
    return userIds;
  }

  private async memberUserIds(
    tx: PoolClient,
    groupId: string,
  ): Promise<string[]> {
    const { rows } = await tx.query<{ user_id: string }>(
      `SELECT su.user_id FROM scim_group_members gm
       JOIN scim_users su ON su.id = gm.scim_user_id
       WHERE gm.group_id = $1`,
      [groupId],
    );
    return rows.map((r) => r.user_id);
  }

  // Recompute the org role for each affected user from their SCIM group set.
  private async recomputeRoles(
    tx: PoolClient,
    ctx: ScimContext,
    userIds: string[],
  ): Promise<void> {
    for (const userId of new Set(userIds)) {
      const { rows } = await tx.query<{ display_name: string }>(
        `SELECT g.display_name FROM scim_group_members gm
         JOIN scim_users su ON su.id = gm.scim_user_id
         JOIN scim_groups g ON g.id = gm.group_id
         WHERE su.user_id = $1 AND su.org_id = $2`,
        [userId, ctx.orgId],
      );
      const role = resolveRole(
        rows.map((r) => r.display_name),
        ctx.config.group_role_map,
        ctx.config.default_role,
      );
      await tx.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [ctx.orgId, userId, role],
      );
    }
  }

  private async loadGroup(ctx: ScimContext, id: string): Promise<GroupRow> {
    if (!isUuid(id)) throw new NotFoundException({ title: "Group not found" });
    const { rows } = await this.db.query<GroupRow>(
      "SELECT * FROM scim_groups WHERE id = $1 AND org_id = $2",
      [id, ctx.orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Group not found" });
    return rows[0];
  }

  private async toGroup(
    row: GroupRow,
    ctx: ScimContext,
  ): Promise<ScimGroup & { meta: object }> {
    const { rows } = await this.db.query<{ id: string; user_name: string }>(
      `SELECT su.id, su.user_name FROM scim_group_members gm
       JOIN scim_users su ON su.id = gm.scim_user_id
       WHERE gm.group_id = $1`,
      [row.id],
    );
    return {
      schemas: [GROUP_SCHEMA],
      id: row.id,
      ...(row.external_id ? { externalId: row.external_id } : {}),
      displayName: row.display_name,
      members: rows.map((m) => ({ value: m.id, display: m.user_name })),
      meta: {
        resourceType: "Group",
        created: row.created_at.toISOString(),
        lastModified: row.updated_at.toISOString(),
        location: `${this.baseUrl(ctx.orgId)}/Groups/${row.id}`,
      },
    };
  }

  private listResponse(resources: object[], params: ListParams): object {
    const startIndex = Math.max(1, params.startIndex ?? 1);
    const count = params.count ?? resources.length;
    const page = resources.slice(startIndex - 1, startIndex - 1 + count);
    return {
      schemas: [LIST_SCHEMA],
      totalResults: resources.length,
      startIndex,
      itemsPerPage: page.length,
      Resources: page,
    };
  }

  serviceProviderConfig(): object {
    return {
      schemas: [
        "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig",
      ],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description: "Authentication via the SCIM bearer token.",
        },
      ],
    };
  }

  resourceTypes(base: string): object {
    return {
      schemas: [LIST_SCHEMA],
      totalResults: 2,
      Resources: [
        {
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
          id: "User",
          name: "User",
          endpoint: "/Users",
          schema: USER_SCHEMA,
          meta: { resourceType: "ResourceType", location: `${base}/ResourceTypes/User` },
        },
        {
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
          id: "Group",
          name: "Group",
          endpoint: "/Groups",
          schema: GROUP_SCHEMA,
          meta: { resourceType: "ResourceType", location: `${base}/ResourceTypes/Group` },
        },
      ],
    };
  }

  schemas(): object {
    return {
      schemas: [LIST_SCHEMA],
      totalResults: 2,
      Resources: [{ id: USER_SCHEMA }, { id: GROUP_SCHEMA }],
    };
  }

  patchOpSchema(): string {
    return PATCH_SCHEMA;
  }
}

// ── Pure helpers ───────────────────────────────────────────────────────────
function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function primaryEmail(body: ScimUser): string | null {
  const emails = body.emails ?? [];
  const primary = emails.find((e) => e.primary) ?? emails[0];
  return primary?.value ? primary.value.toLowerCase() : null;
}

function displayNameOf(body: ScimUser): string {
  if (body.displayName) return body.displayName;
  const n = body.name;
  if (n?.formatted) return n.formatted;
  if (n?.givenName || n?.familyName) {
    return [n.givenName, n.familyName].filter(Boolean).join(" ");
  }
  return "";
}

function rawOf(body: ScimUser): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  if (body.name) raw.name = body.name;
  const dn = displayNameOf(body);
  if (dn) raw.displayName = dn;
  return raw;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

export function parseEqFilter(
  filter?: string,
): { attr: string; value: string } | null {
  if (!filter) return null;
  const m = /^\s*(\w+)\s+eq\s+"([^"]*)"\s*$/i.exec(filter);
  if (!m) return null;
  return { attr: m[1]!, value: m[2]! };
}

export function memberValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === "object" && v !== null
          ? String((v as { value?: unknown }).value ?? "")
          : String(v),
      )
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const v = (value as { value?: unknown }).value;
    return v ? [String(v)] : [];
  }
  return [];
}

// Extract the member id from a filtered path like: members[value eq "abc"]
export function memberFromPath(path?: string): string[] | null {
  if (!path) return null;
  const m = /members\[\s*value\s+eq\s+"([^"]+)"\s*\]/i.exec(path);
  return m ? [m[1]!] : null;
}

function valueDisplayName(op: PatchOp): string | undefined {
  if (op.path && op.path.toLowerCase() === "displayname") {
    return typeof op.value === "string" ? op.value : undefined;
  }
  if (!op.path && op.value && typeof op.value === "object") {
    const dn = (op.value as { displayName?: unknown }).displayName;
    return typeof dn === "string" ? dn : undefined;
  }
  return undefined;
}
