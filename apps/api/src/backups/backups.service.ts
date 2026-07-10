import { Injectable } from "@nestjs/common";
import type {
  BackupRun,
  BackupSchedule,
  UpdateBackupScheduleRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

@Injectable()
export class BackupsService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async getSchedule(orgId: string, userId: string): Promise<BackupSchedule> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query(
      `INSERT INTO backup_schedules (org_id) VALUES ($1)
       ON CONFLICT (org_id) DO UPDATE SET updated_at = backup_schedules.updated_at
       RETURNING org_id, destination, kinds, retention_days, enabled, updated_at`,
      [orgId],
    );
    return toSchedule(rows[0]!);
  }

  async updateSchedule(
    principal: SessionPrincipal,
    orgId: string,
    req: UpdateBackupScheduleRequest,
    ip?: string,
  ): Promise<BackupSchedule> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const sets: string[] = ["updated_at = now()", "updated_by = $2"];
    const values: unknown[] = [orgId, principal.userId];
    const push = (col: string, val: unknown) => {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    };
    if (req.destination !== undefined) push("destination", req.destination);
    if (req.kinds !== undefined) push("kinds", req.kinds);
    if (req.retention_days !== undefined) push("retention_days", req.retention_days);
    if (req.enabled !== undefined) push("enabled", req.enabled);
    const { rows } = await this.db.query(
      `INSERT INTO backup_schedules (org_id, destination, kinds, retention_days, enabled, updated_by)
       VALUES ($1, COALESCE($3, ''), COALESCE($4, '{full}'), COALESCE($5, 7), COALESCE($6, true), $2)
       ON CONFLICT (org_id) DO UPDATE SET ${sets.join(", ")}
       RETURNING org_id, destination, kinds, retention_days, enabled, updated_at`,
      [
        orgId,
        principal.userId,
        req.destination ?? null,
        req.kinds ?? null,
        req.retention_days ?? null,
        req.enabled ?? null,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "backup.schedule.update",
      targetType: "backup_schedule",
      ip,
      meta: req,
    });
    return toSchedule(rows[0]!);
  }

  async listRuns(orgId: string, userId: string): Promise<BackupRun[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query(
      `SELECT id, kind, destination, status, size_bytes, snapshot_ref, error,
              started_at, finished_at
       FROM backups ORDER BY started_at DESC LIMIT 100`,
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      destination: r.destination,
      status: r.status,
      size_bytes: r.size_bytes ? Number(r.size_bytes) : null,
      snapshot_ref: r.snapshot_ref,
      checksum: (r as { checksum?: string | null }).checksum ?? null,
      error: r.error,
      started_at: (r.started_at as Date).toISOString(),
      finished_at: r.finished_at ? (r.finished_at as Date).toISOString() : null,
    }));
  }
}

function toSchedule(r: Record<string, unknown>): BackupSchedule {
  return {
    org_id: r.org_id as string,
    destination: (r.destination as string) ?? "",
    kinds: (r.kinds as BackupSchedule["kinds"]) ?? ["full"],
    retention_days: Number(r.retention_days ?? 7),
    enabled: Boolean(r.enabled ?? true),
    updated_at: (r.updated_at as Date).toISOString(),
  };
}
