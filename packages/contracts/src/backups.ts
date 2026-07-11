import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const BackupKind = z.enum(["full", "mail", "db", "attachments"]);
export type BackupKind = z.infer<typeof BackupKind>;

export const BackupStatus = z.enum(["running", "completed", "failed"]);
export type BackupStatus = z.infer<typeof BackupStatus>;

export const BackupFrequency = z.enum(["daily", "weekly", "monthly"]);
export type BackupFrequency = z.infer<typeof BackupFrequency>;

export const BackupSchedule = z.object({
  org_id: Uuid,
  destination: z.string(),
  kinds: z.array(BackupKind),
  frequency: BackupFrequency,
  retention_days: z.number().int(),
  enabled: z.boolean(),
  last_run_at: IsoDate.nullable(),
  next_run_at: IsoDate.nullable(),
  updated_at: IsoDate,
});
export type BackupSchedule = z.infer<typeof BackupSchedule>;

export const UpdateBackupScheduleRequest = z.object({
  destination: z.string().max(500).optional(),
  kinds: z.array(BackupKind).min(1).optional(),
  frequency: BackupFrequency.optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateBackupScheduleRequest = z.infer<
  typeof UpdateBackupScheduleRequest
>;

export const RunBackupRequest = z.object({
  kind: BackupKind.optional(),
});
export type RunBackupRequest = z.infer<typeof RunBackupRequest>;

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
