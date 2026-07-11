import { Storage } from "@google-cloud/storage";
import type { Readable } from "node:stream";
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

export interface GcsAdapterOptions {
  bucket: string;
  projectId?: string;
  keyFilename?: string;
  credentials?: Record<string, unknown>;
}

/** Google Cloud Storage adapter. */
export class GcsAdapter implements StorageAdapter {
  readonly kind = "gcs";
  private readonly bucket: ReturnType<Storage["bucket"]>;

  constructor(options: GcsAdapterOptions) {
    const storage = new Storage({
      projectId: options.projectId,
      keyFilename: options.keyFilename,
      credentials: options.credentials as never,
    });
    this.bucket = storage.bucket(options.bucket);
  }

  capabilities(): Capabilities {
    return { presignedUrls: true, ranges: true, serverSideCopy: true };
  }

  async healthCheck(): Promise<HealthResult> {
    const started = Date.now();
    try {
      const [exists] = await this.bucket.exists();
      return exists
        ? { ok: true, kind: this.kind, latencyMs: Date.now() - started }
        : {
            ok: false,
            kind: this.kind,
            latencyMs: Date.now() - started,
            detail: "bucket not found",
          };
    } catch (err) {
      return {
        ok: false,
        kind: this.kind,
        latencyMs: Date.now() - started,
        detail: (err as Error).message,
      };
    }
  }

  async putObject(
    key: string,
    body: Readable | Buffer,
    meta?: PutMeta,
  ): Promise<Etag> {
    const file = this.bucket.file(key);
    const write = file.createWriteStream({
      resumable: false,
      metadata: {
        contentType: meta?.contentType,
        cacheControl: meta?.cacheControl,
        metadata: meta?.metadata,
      },
    });
    let size = 0;
    if (Buffer.isBuffer(body)) {
      write.end(body);
      size = body.length;
    } else {
      body.on("data", (c: Buffer) => (size += c.length));
      body.pipe(write);
    }
    await new Promise<void>((resolve, reject) => {
      write.on("finish", () => resolve());
      write.on("error", reject);
    });
    const [meta2] = await file.getMetadata();
    return { etag: (meta2.etag ?? "").replace(/"/g, ""), key, size };
  }

  async getStream(key: string, range?: Range): Promise<Readable> {
    const file = this.bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFound(key);
    return file.createReadStream({
      start: range?.start,
      end: range?.end,
    });
  }

  async headObject(key: string): Promise<HeadResult> {
    const file = this.bucket.file(key);
    try {
      const [meta] = await file.getMetadata();
      return {
        size: Number(meta.size ?? 0),
        etag: (meta.etag ?? "").replace(/"/g, ""),
        contentType: meta.contentType,
        lastModified: meta.updated ? new Date(meta.updated) : undefined,
        metadata: meta.metadata as Record<string, string> | undefined,
      };
    } catch (err) {
      if ((err as { code?: number }).code === 404)
        throw new ObjectNotFound(key);
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  async signUrl(
    key: string,
    method: "GET" | "PUT",
    ttlSec: number,
  ): Promise<string> {
    const [url] = await this.bucket.file(key).getSignedUrl({
      action: method === "PUT" ? "write" : "read",
      version: "v4",
      expires: Date.now() + ttlSec * 1000,
    });
    return url;
  }

  async copyObject(from: string, to: string): Promise<void> {
    await this.bucket.file(from).copy(this.bucket.file(to));
  }

  async *listPrefix(prefix: string): AsyncIterable<ListEntry> {
    const [files] = await this.bucket.getFiles({ prefix });
    for (const f of files) {
      const meta = f.metadata;
      yield {
        key: f.name,
        size: Number(meta.size ?? 0),
        lastModified: meta.updated ? new Date(meta.updated) : new Date(0),
        etag: (meta.etag ?? "").replace(/"/g, ""),
      };
    }
  }
}
