import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Pool } from "pg";

const DEFAULT_DIR = path.resolve(__dirname, "..", "..", "migrations");

export async function runMigrations(
  pool: Pool,
  dir: string = process.env.MIGRATIONS_DIR ?? DEFAULT_DIR,
): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations",
  );
  const applied = new Set(rows.map((r) => r.filename));

  // Baseline: 0001 was applied by hand on the first server before this runner
  // existed. If the ledger is empty but the schema is present, record it.
  if (applied.size === 0 && files[0]) {
    const probe = await pool.query<{ present: boolean }>(
      "SELECT to_regclass('public.organizations') IS NOT NULL AS present",
    );
    if (probe.rows[0]?.present) {
      await pool.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
        [files[0]],
      );
      applied.add(files[0]);
    }
  }

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");
      ran.push(file);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return ran;
}
