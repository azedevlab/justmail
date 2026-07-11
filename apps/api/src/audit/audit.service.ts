import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import type { AuditLog } from "@justmail/contracts";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";

export interface AuditEntry {
  orgId?: string | null;
  actorType: "user" | "api_key" | "system";
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}

interface AuditRow {
  id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  meta: Record<string, unknown> | null;
  created_at: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly db: Db,
    @Inject(forwardRef(() => OrgsService))
    private readonly orgs: OrgsService,
  ) {}

  async list(orgId: string, userId: string, limit: number): Promise<AuditLog[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<AuditRow>(
      `SELECT id, actor_type, actor_id, action, target_type, target_id, ip, meta, created_at
       FROM audit_logs WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      actor_type: r.actor_type,
      actor_id: r.actor_id,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      ip: r.ip,
      meta: r.meta ?? {},
      created_at: r.created_at.toISOString(),
    }));
  }

  // Fire-and-forget: an audit failure must never fail the mutation itself.
  log(entry: AuditEntry): void {
    void this.db
      .query(
        `INSERT INTO audit_logs (org_id, actor_type, actor_id, action, target_type, target_id, ip, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.orgId ?? null,
          entry.actorType,
          entry.actorId ?? null,
          entry.action,
          entry.targetType ?? null,
          entry.targetId ?? null,
          entry.ip ?? null,
          JSON.stringify(entry.meta ?? {}),
        ],
      )
      .catch((err: Error) =>
        this.logger.error(`audit write failed (${entry.action}): ${err.message}`),
      );
  }
}
