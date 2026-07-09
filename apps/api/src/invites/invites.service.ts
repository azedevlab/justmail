import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type {
  AcceptInviteRequest,
  CreateInviteRequest,
  Invite,
  InvitePreview,
  OrgRole,
} from "@justmail/types";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuthService } from "../auth/auth.service";
import type { SessionPrincipal } from "../auth/auth.service";

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};
const INVITE_TTL_DAYS = 14;

interface InviteRow {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  invited_by: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async list(orgId: string, userId: string): Promise<Invite[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<InviteRow>(
      `SELECT id, org_id, email, role, invited_by, expires_at, accepted_at, created_at
       FROM invites WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return rows.map(toInvite);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    req: CreateInviteRequest,
    ip?: string,
  ): Promise<{ invite: Invite; token: string }> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    if (req.role === "owner") {
      await this.orgs.requireRole(orgId, principal.userId, "owner");
    }

    // Refuse invites for anyone already in the org.
    const { rows: existing } = await this.db.query<{ id: string }>(
      `SELECT u.id FROM users u JOIN org_members m ON m.user_id = u.id
       WHERE u.email = $1 AND m.org_id = $2`,
      [req.email, orgId],
    );
    if (existing[0]) {
      throw new ConflictException({ title: "User is already a member" });
    }

    const token = `jmi_${randomBytes(24).toString("base64url")}`;
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    const { rows } = await this.db.query<InviteRow>(
      `INSERT INTO invites (org_id, email, role, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, org_id, email, role, invited_by, expires_at, accepted_at, created_at`,
      [orgId, req.email, req.role, tokenHash, principal.userId, expiresAt],
    );

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "invite.create",
      targetType: "invite",
      targetId: rows[0]!.id,
      ip,
      meta: { email: req.email, role: req.role },
    });

    return { invite: toInvite(rows[0]!), token };
  }

  async preview(token: string): Promise<InvitePreview> {
    const invite = await this.loadPending(token);
    const { rows } = await this.db.query<{ name: string }>(
      "SELECT name FROM organizations WHERE id = $1",
      [invite.org_id],
    );
    const { rows: user } = await this.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [invite.email],
    );
    return {
      org_name: rows[0]?.name ?? "",
      email: invite.email,
      role: invite.role,
      needs_signup: !user[0],
    };
  }

  async accept(token: string, req: AcceptInviteRequest, ip?: string, ua?: string) {
    const invite = await this.loadPending(token);
    const { rows: existing } = await this.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [invite.email],
    );
    const userId = await this.db.tx(async (tx) => {
      let uid = existing[0]?.id;
      if (!uid) {
        const passwordHash = await argon2.hash(req.password, ARGON2_OPTS);
        const inserted = await tx.query<{ id: string }>(
          "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
          [invite.email, req.name, passwordHash],
        );
        uid = inserted.rows[0]!.id;
      }
      await tx.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [invite.org_id, uid, invite.role],
      );
      await tx.query(
        "UPDATE invites SET accepted_at = now() WHERE id = $1",
        [invite.id],
      );
      return uid;
    });

    this.audit.log({
      orgId: invite.org_id,
      actorType: "user",
      actorId: userId,
      action: "invite.accept",
      targetType: "invite",
      targetId: invite.id,
      ip,
      meta: { email: invite.email },
    });

    return this.auth.createSession(userId, ip, ua);
  }

  async revoke(principal: SessionPrincipal, orgId: string, inviteId: string, ip?: string) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rowCount } = await this.db.query(
      "DELETE FROM invites WHERE id = $1 AND org_id = $2 AND accepted_at IS NULL",
      [inviteId, orgId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Invite not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "invite.revoke",
      targetType: "invite",
      targetId: inviteId,
      ip,
    });
  }

  private async loadPending(token: string): Promise<InviteRow> {
    const hash = sha256(token);
    const { rows } = await this.db.query<InviteRow>(
      `SELECT id, org_id, email, role, invited_by, expires_at, accepted_at, created_at
       FROM invites WHERE token_hash = $1`,
      [hash],
    );
    const inv = rows[0];
    if (!inv) throw new NotFoundException({ title: "Invite not found" });
    if (inv.accepted_at) {
      throw new BadRequestException({ title: "Invite already used" });
    }
    if (inv.expires_at.getTime() < Date.now()) {
      throw new BadRequestException({ title: "Invite expired" });
    }
    return inv;
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function toInvite(r: InviteRow): Invite {
  return {
    id: r.id,
    org_id: r.org_id,
    email: r.email,
    role: r.role,
    invited_by: r.invited_by,
    expires_at: r.expires_at.toISOString(),
    accepted_at: r.accepted_at ? r.accepted_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
  };
}
