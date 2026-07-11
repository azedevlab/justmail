# Backup & restore

JustMail backs up the **platform database** (Postgres) on a schedule. Each run
is a compressed `pg_dump` archive written to your configured object storage
with a SHA-256 integrity checksum, so backups live off-box when you point
storage at S3/R2/etc.

> Mail bodies live in the Dovecot maildir volume and attachments live in object
> storage. Snapshot those volumes/buckets with your infrastructure's own
> snapshot tooling; the database backup covers all accounts, domains, aliases,
> settings, audit history, and metadata needed to rebuild the control plane.

## Configure a schedule

Admin console → **Backups**.

| Field | Notes |
|-------|-------|
| Destination | Free-text label for where archives land (informational; the actual location is your `STORAGE_KIND`). |
| Frequency | `daily`, `weekly`, or `monthly`. |
| Retention days | Runs (and their stored archives) older than this are pruned automatically. |
| Enabled | Pauses the schedule when off. |

The worker checks for due schedules every few minutes (`BACKUP_POLL_SECONDS`).
When a schedule is due it runs a backup, records the run, then prunes past the
retention window. The **Last run / Next run** line shows the current state.

## Run one on demand

Click **Back up now**. The run appears under *Recent runs* with its status,
size, and finish time.

## Restore

Restoring is destructive: it overwrites the live database with the selected
archive. Only an **org owner** can do it.

1. Admin console → **Backups** → *Recent runs*.
2. Click **Restore** on a completed run.
3. Type `RESTORE` to confirm.

Under the hood the engine streams the archive from storage, **verifies the
stored checksum before touching the database**, then runs
`pg_restore --clean --if-exists`. If the checksum does not match, the restore
aborts and the database is left untouched.

### Restore to a fresh host

1. Stand up a new host through the [quickstart](quickstart.md) with the same
   `ENCRYPTION_KEY` and storage credentials as the original.
2. Let it boot once so the schema migrations create an empty database.
3. Point it at the same storage bucket, open **Backups**, and restore the most
   recent completed run.

## Requirements

- The API/worker image ships `postgresql-client-17` (`pg_dump`/`pg_restore`).
  If you run a custom image, install a matching major version and set
  `PG_DUMP_BIN` / `PG_RESTORE_BIN` if they are not on `$PATH`.
- Object storage must be reachable from the worker for both backup and restore.
