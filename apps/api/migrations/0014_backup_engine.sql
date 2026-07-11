-- 0014_backup_engine: give backup runs an owning org + integrity checksum, and
-- teach schedules a cadence so the worker can decide when a backup is due.

ALTER TABLE backups ADD COLUMN org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE backups ADD COLUMN checksum text;
CREATE INDEX backups_org_time_idx ON backups (org_id, started_at DESC);

ALTER TABLE backup_schedules
  ADD COLUMN frequency text NOT NULL DEFAULT 'daily'
    CHECK (frequency IN ('daily', 'weekly', 'monthly'));
ALTER TABLE backup_schedules ADD COLUMN last_run_at timestamptz;
ALTER TABLE backup_schedules ADD COLUMN next_run_at timestamptz;
