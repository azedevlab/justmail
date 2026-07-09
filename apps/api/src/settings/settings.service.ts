import { Injectable } from "@nestjs/common";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

/**
 * Platform-wide settings. Namespace with `org:{orgId}.<key>` for org-scoped
 * values; anything else lives under `platform.<key>` and requires platform-admin
 * (deferred — for now owners of any org may read/write both surfaces).
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, userId: string, prefix?: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const args: unknown[] = [];
    let where = "";
    if (prefix) {
      args.push(`${prefix}%`);
      where = "WHERE key LIKE $1";
    }
    const { rows } = await this.db.query(
      `SELECT key, value, updated_at FROM settings ${where} ORDER BY key`,
      args,
    );
    return rows.map((r) => ({
      key: r.key as string,
      value: r.value,
      updated_at: (r.updated_at as Date).toISOString(),
    }));
  }

  async upsert(
    principal: SessionPrincipal,
    orgId: string,
    key: string,
    value: unknown,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.db.query(
      `INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), principal.userId],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "settings.upsert",
      targetType: "setting",
      ip,
      meta: { key },
    });
  }
}
