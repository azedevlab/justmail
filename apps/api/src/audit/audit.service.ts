import { Injectable, Logger } from "@nestjs/common";
import { Db } from "../db/db.service";

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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: Db) {}

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
