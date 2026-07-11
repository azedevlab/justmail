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
    // Hard-scope to this org's own namespace. Without it, an absent prefix would
    // select the entire table — leaking other tenants' rows and, critically, the
    // `webmail.session:*` sealed-credential blobs the fallback cred store writes
    // here. A caller-supplied prefix may only narrow within the org scope.
    const orgScope = `org:${orgId}.`;
    const like =
      prefix && prefix.startsWith(orgScope) ? prefix : orgScope;
    const { rows } = await this.db.query(
      `SELECT key, value, updated_at FROM settings WHERE key LIKE $1 ORDER BY key`,
      [`${like}%`],
    );
    return rows.map((r) => ({
      key: r.key as string,
      value: r.value,
      updated_at: (r.updated_at as Date).toISOString(),
    }));
  }

  /**
   * Effective attachment limits for an org. An admin-set override is
   * authoritative; the global config values are only the default used when no
   * override is stored. Read-path only — no role check (called internally from
   * the send path). Non-positive/invalid overrides fall back to the default.
   */
  async attachmentLimits(orgId: string): Promise<AttachmentLimits> {
    const { rows } = await this.db.query<{ value: unknown }>(
      "SELECT value FROM settings WHERE key = $1",
      [ATTACHMENT_LIMITS_KEY(orgId)],
    );
    const v = rows[0]?.value as
      | { max_total_bytes?: number; max_count?: number }
      | undefined;
    const override = (n: number | undefined, fallback: number) =>
      n && Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    return {
      maxTotalBytes: override(
        v?.max_total_bytes,
        config.WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
      ),
      maxCount: override(v?.max_count, config.WEBMAIL_ATTACHMENT_MAX_COUNT),
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
