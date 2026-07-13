import type { ListEntry, StorageAdapter } from "./types.js";
import { ObjectNotFound } from "./types.js";

/**
 * Copy every object under a prefix from one backend to another, streaming so no
 * object is buffered whole. Migration is online: the live system keeps reading
 * from `source` while bytes are copied to `target`; once the summary reports no
 * failures, the operator flips STORAGE_KIND to the target and the keys are
 * already present. Re-runnable — objects already at the target with a matching
 * size are skipped, so an interrupted run resumes cheaply.
 */
export interface MigrateOptions {
  prefix?: string;
  /** Re-copy even when the target already has an object of the same size. */
  force?: boolean;
  /** Walk and count without writing, to size a run up front. */
  dryRun?: boolean;
  /** Verify each copy by comparing the target's head size to the source. */
  verify?: boolean;
  onProgress?: (p: MigrateProgress) => void;
}

export interface MigrateProgress {
  key: string;
  action: "copied" | "skipped" | "failed";
  bytes: number;
  detail?: string;
}

export interface MigrateSummary {
  copied: number;
  skipped: number;
  failed: number;
  bytesCopied: number;
  failures: Array<{ key: string; detail: string }>;
}

async function targetHasSameSize(
  target: StorageAdapter,
  key: string,
  size: number,
): Promise<boolean> {
  try {
    const head = await target.headObject(key);
    return head.size === size;
  } catch (err) {
    if (err instanceof ObjectNotFound) return false;
    throw err;
  }
}

async function copyOne(
  source: StorageAdapter,
  target: StorageAdapter,
  entry: ListEntry,
  opts: MigrateOptions,
): Promise<number> {
  const stream = await source.getStream(entry.key);
  const head = await source.headObject(entry.key).catch(() => null);
  await target.putObject(entry.key, stream, {
    contentType: head?.contentType,
    contentLength: head?.size ?? entry.size,
    metadata: head?.metadata,
  });
  if (opts.verify) {
    const written = await target.headObject(entry.key);
    if (written.size !== entry.size) {
      throw new Error(`size mismatch: source ${entry.size}, target ${written.size}`);
    }
  }
  return entry.size;
}

export async function migrateStorage(
  source: StorageAdapter,
  target: StorageAdapter,
  opts: MigrateOptions = {},
): Promise<MigrateSummary> {
  const summary: MigrateSummary = {
    copied: 0,
    skipped: 0,
    failed: 0,
    bytesCopied: 0,
    failures: [],
  };
  const report = (p: MigrateProgress) => opts.onProgress?.(p);

  for await (const entry of source.listPrefix(opts.prefix ?? "")) {
    if (!opts.force && (await targetHasSameSize(target, entry.key, entry.size))) {
      summary.skipped += 1;
      report({ key: entry.key, action: "skipped", bytes: entry.size });
      continue;
    }
    if (opts.dryRun) {
      summary.copied += 1;
      summary.bytesCopied += entry.size;
      report({ key: entry.key, action: "copied", bytes: entry.size, detail: "dry-run" });
      continue;
    }
    try {
      const bytes = await copyOne(source, target, entry, opts);
      summary.copied += 1;
      summary.bytesCopied += bytes;
      report({ key: entry.key, action: "copied", bytes });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      summary.failed += 1;
      summary.failures.push({ key: entry.key, detail });
      report({ key: entry.key, action: "failed", bytes: entry.size, detail });
    }
  }
  return summary;
}
