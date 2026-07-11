import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorageAdapter } from "./factory.js";
import { LocalAdapter } from "./local.js";

const s3Env = {
  STORAGE_BUCKET: "bucket",
  STORAGE_ACCESS_KEY: "key",
  STORAGE_SECRET_KEY: "secret",
} as const;

describe("createStorageAdapter", () => {
  it("builds every S3-compatible provider with the right kind", () => {
    expect(
      createStorageAdapter({ ...s3Env, STORAGE_KIND: "s3" }).kind,
    ).toBe("s3");
    expect(
      createStorageAdapter({
        ...s3Env,
        STORAGE_KIND: "r2",
        STORAGE_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
      }).kind,
    ).toBe("r2");
    expect(
      createStorageAdapter({ ...s3Env, STORAGE_KIND: "minio" }).kind,
    ).toBe("minio");
    expect(createStorageAdapter({ ...s3Env, STORAGE_KIND: "b2" }).kind).toBe(
      "b2",
    );
    expect(
      createStorageAdapter({ ...s3Env, STORAGE_KIND: "wasabi" }).kind,
    ).toBe("wasabi");
    expect(createStorageAdapter({ ...s3Env, STORAGE_KIND: "do" }).kind).toBe(
      "do",
    );
    expect(
      createStorageAdapter({ ...s3Env, STORAGE_KIND: "scaleway" }).kind,
    ).toBe("scaleway");
    expect(
      createStorageAdapter({
        ...s3Env,
        STORAGE_KIND: "ceph",
        STORAGE_ENDPOINT: "https://ceph.internal:7480",
      }).kind,
    ).toBe("ceph");
  });

  it("maps every filesystem mount type onto the local adapter, tagged by kind", () => {
    for (const kind of ["local", "nfs", "smb", "cephfs", "zfs"] as const) {
      const adapter = createStorageAdapter({
        STORAGE_KIND: kind,
        STORAGE_LOCAL_PATH: "/tmp/does-not-need-to-exist-yet",
      });
      expect(adapter.kind).toBe(kind);
      // Filesystem mounts can't hand the client a direct backend URL.
      expect(adapter.capabilities().presignedUrls).toBe(false);
    }
  });

  it("requires a bucket for object stores", () => {
    expect(() => createStorageAdapter({ STORAGE_KIND: "s3" })).toThrow(
      /bucket/i,
    );
  });

  it("requires an explicit endpoint for ceph (no canonical host)", () => {
    expect(() =>
      createStorageAdapter({ ...s3Env, STORAGE_KIND: "ceph" }),
    ).toThrow(/endpoint/i);
  });

  it("advertises presigned URLs, ranges and server-side copy for S3", () => {
    const caps = createStorageAdapter({
      ...s3Env,
      STORAGE_KIND: "s3",
    }).capabilities();
    expect(caps.presignedUrls).toBe(true);
    expect(caps.ranges).toBe(true);
    expect(caps.serverSideCopy).toBe(true);
  });
});

describe("LocalAdapter", () => {
  it("reports API-fronted URLs (no direct offload) and passes a real health check", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jm-storage-"));
    try {
      const adapter = new LocalAdapter(dir, "signing-secret");
      expect(adapter.capabilities().presignedUrls).toBe(false);
      expect(adapter.capabilities().ranges).toBe(true);

      const health = await adapter.healthCheck();
      expect(health.ok).toBe(true);
      expect(health.kind).toBe("local");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails the health check when the root cannot be created", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jm-storage-"));
    try {
      // A file can't be a parent directory — mkdir under it fails ENOTDIR.
      const filePath = join(dir, "not-a-dir");
      await writeFile(filePath, "x");
      const adapter = new LocalAdapter(join(filePath, "under"), "s");
      const health = await adapter.healthCheck();
      expect(health.ok).toBe(false);
      expect(health.detail).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
