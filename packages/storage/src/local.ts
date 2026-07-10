import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink, copyFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { createHash } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import type {
  Etag,
  HeadResult,
  ListEntry,
  PutMeta,
  Range,
  StorageAdapter,
} from "./types.js";
import { ObjectNotFound } from "./types.js";

/**
 * LocalAdapter — filesystem-backed storage. Suitable for single-node
 * deployments and dev. Signs URLs by embedding a HMAC token; the API server
 * verifies the token when it fronts downloads.
 */
export class LocalAdapter implements StorageAdapter {
  readonly kind = "local";

  constructor(
    private readonly root: string,
    private readonly signingSecret: string,
  ) {}

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
    await mkdir(dirname(target), { recursive: true });
    const tmp = join(tmpdir(), `jm-${Date.now()}-${Math.random()}`);
    const hash = createHash("sha256");
    let size = 0;

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
