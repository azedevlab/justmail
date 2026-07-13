import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalAdapter } from "./local.js";
import { migrateStorage } from "./migrate.js";

const dirs: string[] = [];
async function adapter(): Promise<LocalAdapter> {
  const root = await mkdtemp(join(tmpdir(), "jm-store-"));
  dirs.push(root);
  return new LocalAdapter(root, "test-secret");
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("migrateStorage", () => {
  it("copies every object and verifies sizes", async () => {
    const src = await adapter();
    const dst = await adapter();
    await src.putObject("org/a/1.txt", Buffer.from("hello"));
    await src.putObject("org/a/2.txt", Buffer.from("world!!"));

    const summary = await migrateStorage(src, dst, { verify: true });

    expect(summary).toMatchObject({ copied: 2, skipped: 0, failed: 0 });
    expect(summary.bytesCopied).toBe(5 + 7);
    expect((await dst.headObject("org/a/1.txt")).size).toBe(5);
  });

  it("skips objects already present with the same size (resumable)", async () => {
    const src = await adapter();
    const dst = await adapter();
    await src.putObject("k.txt", Buffer.from("abc"));
    await dst.putObject("k.txt", Buffer.from("abc"));

    const summary = await migrateStorage(src, dst);
    expect(summary).toMatchObject({ copied: 0, skipped: 1 });
  });

  it("counts without writing on a dry run", async () => {
    const src = await adapter();
    const dst = await adapter();
    await src.putObject("k.txt", Buffer.from("abcd"));

    const summary = await migrateStorage(src, dst, { dryRun: true });
    expect(summary).toMatchObject({ copied: 1, bytesCopied: 4 });
    await expect(dst.headObject("k.txt")).rejects.toThrow();
  });
});
