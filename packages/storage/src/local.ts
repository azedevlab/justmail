import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  copyFile,
  writeFile,
} from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { createHash } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import type {
  Capabilities,
  Etag,
  HeadResult,
  HealthResult,
  ListEntry,
  PutMeta,
  Range,
  StorageAdapter,
} from "./types.js";
import { ObjectNotFound } from "./types.js";

/**
 * LocalAdapter — filesystem-backed storage. Backs single-node deployments and
 * dev, and equally any POSIX-mounted network/distributed filesystem (NFS, SMB,
 * CephFS, ZFS) — the operator just points the root at the mount. The staged
 * write + same-directory rename in `putObject` keeps writes atomic on those
 * mounts too, since the temp file never crosses a filesystem boundary. Signs
 * URLs by embedding a HMAC token; the API server verifies it when it fronts
 * downloads. `kind` records the underlying mount type for health/telemetry.
 */
export class LocalAdapter implements StorageAdapter {
  readonly kind: string;

  constructor(
    private readonly root: string,
    private readonly signingSecret: string,
    kind = "local",
  ) {
    this.kind = kind;
  }

  capabilities(): Capabilities {
    // signUrl() returns an API-fronted `/_storage` path, not a URL the client
    // can hit directly against a backend — so no true offload.
    return { presignedUrls: false, ranges: true, serverSideCopy: true };
  }

  async healthCheck(): Promise<HealthResult> {
    const started = Date.now();
    const probe = join(this.root, `.jm-health-${process.pid}-${Date.now()}`);
    try {
      await mkdir(this.root, { recursive: true });
      await writeFile(probe, "ok");
      await readFile(probe);
      await unlink(probe);
      return { ok: true, kind: this.kind, latencyMs: Date.now() - started };
    } catch (err) {
      await unlink(probe).catch(() => undefined);
      return {
        ok: false,
        kind: this.kind,
        latencyMs: Date.now() - started,
        detail: (err as Error).message,
      };
    }
  }

  private path(key: string): string {
    const normalised = key
      .replace(/^\/+/, "")
      .split("/")
      .filter((p) => p && p !== "..");
    return resolve(this.root, ...normalised);
  }

  async putObject(
    key: string,
    body: Readable | Buffer,
    _meta?: PutMeta,
  ): Promise<Etag> {
    const target = this.path(key);
    const dir = dirname(target);
    await mkdir(dir, { recursive: true });
    // Stage the write in the SAME directory as the target so the finishing
    // rename() is atomic and never crosses a filesystem boundary. os.tmpdir()
    // is frequently on a different mount from the data root (e.g. the container
    // overlay vs. a bind-mounted volume), which makes rename() fail with EXDEV.
    const tmp = join(dir, `.jm-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const hash = createHash("sha256");
    let size = 0;

    try {
      if (Buffer.isBuffer(body)) {
        hash.update(body);
        size = body.length;
        const write = createWriteStream(tmp);
        await pipeline(Readable.from(body), write);
      } else {
        const write = createWriteStream(tmp);
        const measured = new Transform({
          transform(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error | null, data?: Buffer) => void) {
            hash.update(chunk);
            size += chunk.length;
            cb(null, chunk);
          },
        });
        await pipeline(body, measured, write);
      }
      await rename(tmp, target);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw err;
    }
    return { etag: hash.digest("hex"), key, size };
  }

  async getStream(key: string, range?: Range): Promise<Readable> {
    const target = this.path(key);
    try {
      await stat(target);
    } catch {
      throw new ObjectNotFound(key);
    }
    return createReadStream(target, range ? { start: range.start, end: range.end } : {});
  }

  async headObject(key: string): Promise<HeadResult> {
    const target = this.path(key);
    try {
      const s = await stat(target);
      return {
        size: s.size,
        etag: `${s.size}-${Math.floor(s.mtimeMs)}`,
        lastModified: s.mtime,
      };
    } catch {
      throw new ObjectNotFound(key);
    }
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.path(key);
    await unlink(target).catch((err) => {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    });
  }

  async signUrl(
    key: string,
    method: "GET" | "PUT",
    ttlSec: number,
    _meta?: PutMeta,
  ): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = createHash("sha256")
      .update(`${method}\n${key}\n${exp}\n${this.signingSecret}`)
      .digest("hex")
      .slice(0, 40);
    const path = key.startsWith("/") ? key : `/${key}`;
    return `/_storage${path}?exp=${exp}&sig=${sig}&m=${method}`;
  }

  verifySignedUrl(
    key: string,
    method: "GET" | "PUT",
    exp: number,
    sig: string,
  ): boolean {
    if (Math.floor(Date.now() / 1000) > exp) return false;
    const expected = createHash("sha256")
      .update(`${method}\n${key}\n${exp}\n${this.signingSecret}`)
      .digest("hex")
      .slice(0, 40);
    return expected === sig;
  }

  async copyObject(from: string, to: string): Promise<void> {
    const src = this.path(from);
    const dst = this.path(to);
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }

  async *listPrefix(prefix: string): AsyncIterable<ListEntry> {
    const start = this.path(prefix);
    async function* walk(dir: string): AsyncIterable<string> {
      let entries: Array<{ name: string; isDirectory: () => boolean }>;
      try {
        entries = (await readdir(dir, { withFileTypes: true })) as Array<{
          name: string;
          isDirectory: () => boolean;
        }>;
      } catch {
        return;
      }
      for (const e of entries) {
        const full = join(dir, String(e.name));
        if (e.isDirectory()) yield* walk(full);
        else yield full;
      }
    }
    for await (const p of walk(start)) {
      const s = await stat(p);
      yield {
        key: p.slice(this.root.length + 1).split(sep).join("/"),
        size: s.size,
        lastModified: s.mtime,
        etag: `${s.size}-${Math.floor(s.mtimeMs)}`,
      };
    }
  }
}
