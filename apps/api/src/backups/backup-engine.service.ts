import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Injectable, Logger } from "@nestjs/common";
import type { BackupKind } from "@justmail/contracts";
import { Db } from "../db/db.service";
import { StorageService } from "../storage/storage.service";
import { config } from "../config";
import {
  isDue,
  nextRun,
  pgEnvFromUrl,
  retentionCutoff,
  sha256,
} from "./backup-plan";

interface ScheduleRow {
  org_id: string;
  destination: string;
  frequency: "daily" | "weekly" | "monthly";
  retention_days: number;
  enabled: boolean;
  next_run_at: Date | null;
}

/**
 * Runs and restores database backups. A backup is a `pg_dump` of the platform
 * cluster (custom, compressed format) stored through the tenant-scoped storage
 * adapter with a SHA-256 integrity checksum. The worker calls {@link runDue}
 * on a timer; admins can also trigger {@link run} on demand.
 */
@Injectable()
export class BackupEngine {
  private readonly logger = new Logger(BackupEngine.name);

  constructor(
    private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  /** Execute every schedule whose next run is due, then prune old artifacts. */
  async runDue(): Promise<void> {
    const { rows } = await this.db.query<ScheduleRow>(
      `SELECT org_id, destination, frequency, retention_days, enabled, next_run_at
       FROM backup_schedules WHERE enabled = true`,
    );
    const now = new Date();
    for (const s of rows) {
      if (!isDue(s, now)) continue;
      try {
        for (const kind of ["full"] as const) {
          await this.run(s.org_id, kind);
        }
      } catch (err) {
        this.logger.warn(
          `scheduled backup for org ${s.org_id} failed: ${(err as Error).message}`,
        );
      } finally {
        const next = nextRun(now, s.frequency);
        await this.db.query(
          "UPDATE backup_schedules SET last_run_at = $2, next_run_at = $3 WHERE org_id = $1",
          [s.org_id, now, next],
        );
        await this.prune(s.org_id, s.retention_days).catch((err) =>
          this.logger.warn(`prune failed for org ${s.org_id}: ${err.message}`),
        );
      }
    }
  }

  /** Run one backup now. Returns the backup run id. */
  async run(orgId: string, kind: BackupKind = "full"): Promise<string> {
    const destination = await this.destinationLabel(orgId);
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO backups (org_id, kind, destination, status)
       VALUES ($1, $2, $3, 'running') RETURNING id`,
      [orgId, kind, destination],
    );
    const id = rows[0]!.id;
    try {
      const dump = await this.dumpDatabase();
      const relKey = `backups/${id}.dump`;
      await this.storage.put(orgId, relKey, dump, "application/octet-stream");
      await this.db.query(
        `UPDATE backups
         SET status = 'completed', size_bytes = $2, checksum = $3,
             snapshot_ref = $4, finished_at = now()
         WHERE id = $1`,
        [id, dump.length, sha256(dump), relKey],
      );
      this.logger.log(`backup ${id} completed (${dump.length} bytes)`);
    } catch (err) {
      this.logger.warn(`backup ${id} failed: ${(err as Error).message}`);
      await this.db.query(
        `UPDATE backups SET status = 'failed', error = $2, finished_at = now()
         WHERE id = $1`,
        [id, (err as Error).message.slice(0, 500)],
      );
      throw err;
    }
    return id;
  }

  /**
   * Restore the platform database from a completed backup. This is destructive:
   * it drops and recreates objects in the live cluster. Verifies the stored
   * checksum before touching the database.
   */
  async restore(orgId: string, id: string): Promise<void> {
    const { rows } = await this.db.query<{
      status: string;
      snapshot_ref: string | null;
      checksum: string | null;
    }>(
      "SELECT status, snapshot_ref, checksum FROM backups WHERE id = $1 AND org_id = $2",
      [id, orgId],
    );
    const row = rows[0];
    if (!row) throw new Error("Backup not found");
    if (row.status !== "completed" || !row.snapshot_ref) {
      throw new Error("Backup is not restorable");
    }
    const dir = await mkdtemp(join(tmpdir(), "jm-restore-"));
    const file = join(dir, "backup.dump");
    try {
      const src = await this.storage.stream(orgId, row.snapshot_ref);
      await pipeline(src, createWriteStream(file));
      if (row.checksum) {
        const { readFile } = await import("node:fs/promises");
        const actual = sha256(await readFile(file));
        if (actual !== row.checksum) {
          throw new Error("Backup checksum mismatch — refusing to restore");
        }
      }
      const { env, database } = pgEnvFromUrl(config.DATABASE_URL);
      await this.exec(
        config.PG_RESTORE_BIN,
        ["--clean", "--if-exists", "--no-owner", "--no-privileges", "-d", database, file],
        env,
      );
      this.logger.log(`restored database from backup ${id}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async dumpDatabase(): Promise<Buffer> {
    const { env } = pgEnvFromUrl(config.DATABASE_URL);
    return this.exec(config.PG_DUMP_BIN, ["-Fc", "--no-owner", "--no-privileges"], env);
  }

  private async prune(orgId: string, retentionDays: number): Promise<void> {
    const cutoff = retentionCutoff(new Date(), retentionDays);
    const { rows } = await this.db.query<{ id: string; snapshot_ref: string | null }>(
      `SELECT id, snapshot_ref FROM backups
       WHERE org_id = $1 AND started_at < $2 AND status <> 'running'`,
      [orgId, cutoff],
    );
    for (const r of rows) {
      if (r.snapshot_ref) {
        await this.storage
          .remove(orgId, r.snapshot_ref)
          .catch(() => undefined);
      }
      await this.db.query("DELETE FROM backups WHERE id = $1", [r.id]);
    }
  }

  private async destinationLabel(orgId: string): Promise<string> {
    const { rows } = await this.db.query<{ destination: string }>(
      "SELECT destination FROM backup_schedules WHERE org_id = $1",
      [orgId],
    );
    return rows[0]?.destination || `storage:${this.storage.kind}`;
  }

  /** Spawn a pg client binary, capturing stdout as a Buffer. */
  private exec(
    bin: string,
    args: string[],
    extraEnv: Record<string, string>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, {
        env: { ...process.env, ...extraEnv },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const out: Buffer[] = [];
      const errChunks: Buffer[] = [];
      child.stdout.on("data", (c: Buffer) => out.push(c));
      child.stderr.on("data", (c: Buffer) => errChunks.push(c));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(out));
          return;
        }
        const detail =
          Buffer.concat(errChunks).toString("utf8").trim().slice(0, 500) ||
          `exited with code ${code}`;
        reject(new Error(`${bin} failed: ${detail}`));
      });
    });
  }
}
