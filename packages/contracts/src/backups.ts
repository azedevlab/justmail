import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const BackupKind = z.enum(["full", "mail", "db", "attachments"]);
export type BackupKind = z.infer<typeof BackupKind>;

export const BackupStatus = z.enum(["running", "completed", "failed"]);
export type BackupStatus = z.infer<typeof BackupStatus>;

export const BackupSchedule = z.object({
  org_id: Uuid,
  destination: z.string(),
  kinds: z.array(BackupKind),
  retention_days: z.number().int(),
  enabled: z.boolean(),
  updated_at: IsoDate,
});
export type BackupSchedule = z.infer<typeof BackupSchedule>;

export const UpdateBackupScheduleRequest = z.object({
  destination: z.string().max(500).optional(),
  kinds: z.array(BackupKind).min(1).optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateBackupScheduleRequest = z.infer<
  typeof UpdateBackupScheduleRequest
>;

export const BackupRun = z.object({
  id: Uuid,
  kind: BackupKind,
  destination: z.string(),
  status: BackupStatus,
  size_bytes: z.number().int().nullable(),
  snapshot_ref: z.string().nullable(),
  checksum: z.string().nullable(),
  error: z.string().nullable(),
  started_at: IsoDate,
  finished_at: IsoDate.nullable(),
});
export type BackupRun = z.infer<typeof BackupRun>;
