import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  LdapDirectory,
  LdapDirectoryRequest,
  LdapGroupRoleMap,
  LdapSyncRun,
  LdapTestResult,
  OrgRole,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";
import { open, seal } from "../common/secretbox";
import { fetchDirectory, type LdapConnConfig } from "./ldap-client";
import {
  expandGroups,
  resolveRole,
  type MappedUser,
} from "./mapping";

interface DirectoryRow {
  id: string;
  org_id: string;
  name: string;
  enabled: boolean;
  host: string;
  port: number;
  encryption: "none" | "starttls" | "ldaps";
  verify_tls: boolean;
  bind_dn: string;
  bind_password_enc: string | null;
  base_dn: string;
  user_filter: string;
  group_filter: string | null;
  email_attribute: string;
  name_attribute: string;
  uid_attribute: string;
  member_attribute: string;
  group_role_map: LdapGroupRoleMap;
  default_role: OrgRole;
  deactivate_missing: boolean;
  sync_interval_minutes: number;
  last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RunRow {
  id: string;
  directory_id: string;
  status: "running" | "ok" | "error";
  created_count: number;
  updated_count: number;
  deactivated_count: number;
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
}

interface SyncCounts {
  created: number;
  updated: number;
  deactivated: number;
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger("ldap");

  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly orgs: OrgsService,
  ) {}

  // ── Admin: directory CRUD ─────────────────────────────────────────────────
  async list(orgId: string, userId: string): Promise<LdapDirectory[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<DirectoryRow>(
      "SELECT * FROM ldap_directories WHERE org_id = $1 ORDER BY created_at",
      [orgId],
    );
    return rows.map((r) => this.toDirectory(r));
  }

  async get(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<LdapDirectory> {
    await this.orgs.requireRole(orgId, userId, "admin");
    return this.toDirectory(await this.loadOwned(orgId, id));
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    req: LdapDirectoryRequest,
    ip?: string,
  ): Promise<LdapDirectory> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rows } = await this.db.query<DirectoryRow>(
      `INSERT INTO ldap_directories
         (org_id, name, enabled, host, port, encryption, verify_tls, bind_dn,
          bind_password_enc, base_dn, user_filter, group_filter,
          email_attribute, name_attribute, uid_attribute, member_attribute,
          group_role_map, default_role, deactivate_missing,
          sync_interval_minutes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
               $17,$18,$19,$20,$21)
       RETURNING *`,
      [
        orgId,
        req.name,
        req.enabled,
        req.host,
        req.port,
        req.encryption,
        req.verify_tls,
        req.bind_dn,
        req.bind_password ? seal(req.bind_password) : null,
        req.base_dn,
        req.user_filter,
        req.group_filter ?? null,
        req.email_attribute,
        req.name_attribute,
        req.uid_attribute,
        req.member_attribute,
        JSON.stringify(req.group_role_map),
        req.default_role,
        req.deactivate_missing,
        req.sync_interval_minutes,
        principal.userId,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "ldap.directory.create",
      targetType: "ldap_directory",
      targetId: rows[0]!.id,
      meta: { host: req.host },
      ip,
    });
    return this.toDirectory(rows[0]!);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    req: LdapDirectoryRequest,
    ip?: string,
  ): Promise<LdapDirectory> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const existing = await this.loadOwned(orgId, id);
    // Omitting bind_password keeps the stored secret; a value replaces it.
    const secretSql =
      req.bind_password === undefined
        ? existing.bind_password_enc
        : seal(req.bind_password);
    const { rows } = await this.db.query<DirectoryRow>(
      `UPDATE ldap_directories SET
         name = $3, enabled = $4, host = $5, port = $6, encryption = $7,
         verify_tls = $8, bind_dn = $9, bind_password_enc = $10, base_dn = $11,
         user_filter = $12, group_filter = $13, email_attribute = $14,
         name_attribute = $15, uid_attribute = $16, member_attribute = $17,
         group_role_map = $18, default_role = $19, deactivate_missing = $20,
         sync_interval_minutes = $21, updated_at = now()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [
        id,
        orgId,
        req.name,
        req.enabled,
        req.host,
        req.port,
        req.encryption,
        req.verify_tls,
        req.bind_dn,
        secretSql,
        req.base_dn,
        req.user_filter,
        req.group_filter ?? null,
        req.email_attribute,
        req.name_attribute,
        req.uid_attribute,
        req.member_attribute,
        JSON.stringify(req.group_role_map),
        req.default_role,
        req.deactivate_missing,
        req.sync_interval_minutes,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "ldap.directory.update",
      targetType: "ldap_directory",
      targetId: id,
      ip,
    });
    return this.toDirectory(rows[0]!);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rowCount } = await this.db.query(
      "DELETE FROM ldap_directories WHERE id = $1 AND org_id = $2",
      [id, orgId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Directory not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "ldap.directory.delete",
      targetType: "ldap_directory",
      targetId: id,
      ip,
    });
  }

  async listRuns(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<LdapSyncRun[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    await this.loadOwned(orgId, id);
    const { rows } = await this.db.query<RunRow>(
      `SELECT * FROM ldap_sync_runs WHERE directory_id = $1
       ORDER BY started_at DESC LIMIT 20`,
      [id],
    );
    return rows.map((r) => this.toRun(r));
  }

  // ── Test connection ───────────────────────────────────────────────────────
  async testConnection(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<LdapTestResult> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const row = await this.loadOwned(orgId, id);
    try {
      const snapshot = await fetchDirectory(this.connConfig(row));
      return {
        ok: true,
        message: `Bound successfully and read ${snapshot.users.length} user(s).`,
        user_count: snapshot.users.length,
        sample_users: snapshot.users.slice(0, 5).map((u) => ({
          email: u.email,
          name: u.name,
          uid: u.uid,
          groups: u.groups,
        })),
      };
    } catch (err) {
      return {
        ok: false,
        message: (err as Error).message,
        user_count: 0,
        sample_users: [],
      };
    }
  }

  // ── Sync ──────────────────────────────────────────────────────────────────
  async syncNow(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ): Promise<LdapSyncRun> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const row = await this.loadOwned(orgId, id);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "ldap.directory.sync",
      targetType: "ldap_directory",
      targetId: id,
      ip,
    });
    return this.runSync(row);
  }

  // Worker entry point: sync every enabled directory whose interval has elapsed.
  async runDueSyncs(): Promise<void> {
    const { rows } = await this.db.query<DirectoryRow>(
      `SELECT * FROM ldap_directories
       WHERE enabled = true
         AND (last_synced_at IS NULL
              OR last_synced_at + (sync_interval_minutes * interval '1 minute') <= now())`,
    );
    for (const row of rows) {
      try {
        await this.runSync(row);
      } catch (err) {
        this.logger.warn(
          `directory ${row.id} sync failed: ${(err as Error).message}`,
        );
      }
    }
  }

  private async runSync(row: DirectoryRow): Promise<LdapSyncRun> {
    const { rows: runRows } = await this.db.query<RunRow>(
      "INSERT INTO ldap_sync_runs (directory_id) VALUES ($1) RETURNING *",
      [row.id],
    );
    const run = runRows[0]!;
    try {
      const snapshot = await fetchDirectory(this.connConfig(row));
      const counts = await this.applySnapshot(row, snapshot.users, (groups) =>
        expandGroups(groups, snapshot.groupParents),
      );
      const { rows: done } = await this.db.query<RunRow>(
        `UPDATE ldap_sync_runs SET
           status = 'ok', created_count = $2, updated_count = $3,
           deactivated_count = $4, finished_at = now()
         WHERE id = $1 RETURNING *`,
        [run.id, counts.created, counts.updated, counts.deactivated],
      );
      await this.db.query(
        "UPDATE ldap_directories SET last_synced_at = now() WHERE id = $1",
        [row.id],
      );
      return this.toRun(done[0]!);
    } catch (err) {
      const { rows: failed } = await this.db.query<RunRow>(
        `UPDATE ldap_sync_runs SET status = 'error', error = $2,
           finished_at = now() WHERE id = $1 RETURNING *`,
        [run.id, (err as Error).message.slice(0, 2000)],
      );
      return this.toRun(failed[0]!);
    }
  }

  // Provision/update local users from the directory snapshot, then optionally
  // suspend accounts whose identity was not seen in this run.
  private async applySnapshot(
    row: DirectoryRow,
    users: MappedUser[],
    expand: (groups: string[]) => string[],
  ): Promise<SyncCounts> {
    const counts: SyncCounts = { created: 0, updated: 0, deactivated: 0 };
    const seen = new Set<string>();

    for (const user of users) {
      if (!user.email) continue;
      seen.add(user.externalId);
      const role = resolveRole(
        expand(user.groups),
        row.group_role_map,
        row.default_role,
      );
      const created = await this.db.tx(async (tx) => {
        const linked = await tx.query<{ user_id: string }>(
          "SELECT user_id FROM ldap_identities WHERE directory_id = $1 AND external_id = $2",
          [row.id, user.externalId],
        );
        let userId = linked.rows[0]?.user_id ?? null;
        let isNew = false;

        if (!userId) {
          const existing = await tx.query<{ id: string }>(
            "SELECT id FROM users WHERE email = $1",
            [user.email],
          );
          if (existing.rows[0]) {
            userId = existing.rows[0].id;
          } else {
            const inserted = await tx.query<{ id: string }>(
              "INSERT INTO users (email, name, status) VALUES ($1, $2, 'active') RETURNING id",
              [user.email, user.name ?? ""],
            );
            userId = inserted.rows[0]!.id;
            isNew = true;
          }
        }

        await tx.query(
          `UPDATE users SET name = COALESCE(NULLIF($2, ''), name),
             status = 'active', updated_at = now()
           WHERE id = $1`,
          [userId, user.name ?? ""],
        );
        await tx.query(
          `INSERT INTO org_members (org_id, user_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
          [row.org_id, userId, role],
        );
        await tx.query(
          `INSERT INTO ldap_identities (directory_id, external_id, user_id, last_seen_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (directory_id, external_id)
           DO UPDATE SET user_id = EXCLUDED.user_id, last_seen_at = now()`,
          [row.id, user.externalId, userId],
        );
        return isNew;
      });
      if (created) counts.created += 1;
      else counts.updated += 1;
    }

    if (row.deactivate_missing) {
      const { rows: stale } = await this.db.query<{
        external_id: string;
        user_id: string;
      }>("SELECT external_id, user_id FROM ldap_identities WHERE directory_id = $1", [
        row.id,
      ]);
      for (const identity of stale) {
        if (seen.has(identity.external_id)) continue;
        const { rowCount } = await this.db.query(
          "UPDATE users SET status = 'suspended', updated_at = now() WHERE id = $1 AND status <> 'suspended'",
          [identity.user_id],
        );
        if (rowCount) counts.deactivated += 1;
      }
    }

    return counts;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async loadOwned(orgId: string, id: string): Promise<DirectoryRow> {
    const { rows } = await this.db.query<DirectoryRow>(
      "SELECT * FROM ldap_directories WHERE id = $1 AND org_id = $2",
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Directory not found" });
    return rows[0];
  }

  private connConfig(row: DirectoryRow): LdapConnConfig {
    return {
      host: row.host,
      port: row.port,
      encryption: row.encryption,
      verifyTls: row.verify_tls,
      bindDn: row.bind_dn,
      bindPassword: row.bind_password_enc ? open(row.bind_password_enc) : "",
      baseDn: row.base_dn,
      userFilter: row.user_filter,
      groupFilter: row.group_filter,
      emailAttribute: row.email_attribute,
      nameAttribute: row.name_attribute,
      uidAttribute: row.uid_attribute,
      memberAttribute: row.member_attribute,
    };
  }

  private toDirectory(row: DirectoryRow): LdapDirectory {
    return {
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      enabled: row.enabled,
      host: row.host,
      port: row.port,
      encryption: row.encryption,
      verify_tls: row.verify_tls,
      bind_dn: row.bind_dn,
      has_bind_password: row.bind_password_enc !== null,
      base_dn: row.base_dn,
      user_filter: row.user_filter,
      group_filter: row.group_filter,
      email_attribute: row.email_attribute,
      name_attribute: row.name_attribute,
      uid_attribute: row.uid_attribute,
      member_attribute: row.member_attribute,
      group_role_map: row.group_role_map,
      default_role: row.default_role,
      deactivate_missing: row.deactivate_missing,
      sync_interval_minutes: row.sync_interval_minutes,
      last_synced_at: row.last_synced_at
        ? row.last_synced_at.toISOString()
        : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private toRun(row: RunRow): LdapSyncRun {
    return {
      id: row.id,
      directory_id: row.directory_id,
      status: row.status,
      created_count: row.created_count,
      updated_count: row.updated_count,
      deactivated_count: row.deactivated_count,
      error: row.error,
      started_at: row.started_at.toISOString(),
      finished_at: row.finished_at ? row.finished_at.toISOString() : null,
    };
  }
}
