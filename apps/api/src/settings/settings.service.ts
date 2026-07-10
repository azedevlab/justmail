import { Injectable } from "@nestjs/common";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { config } from "../config";
import type { SessionPrincipal } from "../auth/auth.service";

export interface AttachmentLimits {
  maxTotalBytes: number;
  maxCount: number;
}

// Key under which per-org attachment limits are stored in the settings table.
export const ATTACHMENT_LIMITS_KEY = (orgId: string) =>
  `org:${orgId}.attachments`;

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

  /**
   * Effective attachment limits for an org: stored overrides fall back to the
   * global config defaults. Read-path only — no role check (called internally
   * from the send path). Values are clamped positive and never exceed the
   * global ceiling so an org cannot raise limits above what the deploy allows.
   */
  async attachmentLimits(orgId: string): Promise<AttachmentLimits> {
    const { rows } = await this.db.query<{ value: unknown }>(
      "SELECT value FROM settings WHERE key = $1",
      [ATTACHMENT_LIMITS_KEY(orgId)],
    );
    const v = rows[0]?.value as
      | { max_total_bytes?: number; max_count?: number }
      | undefined;
    const clamp = (n: number | undefined, ceiling: number) =>
      n && Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), ceiling) : ceiling;
    return {
      maxTotalBytes: clamp(
        v?.max_total_bytes,
        config.WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
      ),
      maxCount: clamp(v?.max_count, config.WEBMAIL_ATTACHMENT_MAX_COUNT),
    };
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
