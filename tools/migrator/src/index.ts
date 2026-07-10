#!/usr/bin/env node
/**
 * Standalone migration runner. Applies numbered SQL files under
 * `apps/api/migrations/` in a single transaction each, records checksums in
 * `schema_migrations`, and refuses to apply a file whose checksum diverges
 * from the ledger — an audit trail against post-hoc edits.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { Pool } from "pg";

const dir =
  process.argv[2] ??
  resolve(process.cwd(), "apps/api/migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(2);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: url });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum text NOT NULL
    )
  `);

  const files = readdirSync(dir)
    .filter((f) => extname(f) === ".sql")
    .sort();
  for (const file of files) {
    const version = file;
    const contents = readFileSync(join(dir, file), "utf8");
    const checksum = createHash("sha256").update(contents).digest("hex");
    const existing = await pool.query<{ checksum: string }>(
      "SELECT checksum FROM schema_migrations WHERE version = $1",
      [version],
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.checksum !== checksum) {
        console.error(
          `checksum mismatch for ${version}: refusing to run (was ${existing.rows[0]!.checksum}, now ${checksum})`,
        );
        process.exit(3);
      }
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(contents);
      await client.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
        [version, checksum],
      );
      await client.query("COMMIT");
      console.log(`applied ${version}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
