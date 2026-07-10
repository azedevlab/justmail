import type { Readable } from "node:stream";

/**
 * Object storage adapter — the interface every provider must satisfy.
 *
 * Design notes:
 * - Keys are org-prefixed by the API layer (e.g. `org/<uuid>/attachments/…`).
 *   Adapters do not prescribe layout beyond escaping/normalisation.
 * - `putObject` and `getStream` accept and return Node streams so the API can
 *   pipe multi-hundred-MB uploads without buffering.
 * - `signUrl` returns a provider-signed URL; the API decides TTL and method.
 * - `copyObject` supports content-addressed deduplication.
 */

export interface PutMeta {
  contentType?: string;
  contentLength?: number;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface Etag {
  etag: string;
  key: string;
  size: number;
}

export interface HeadResult {
  size: number;
  etag: string;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface Range {
  start: number;
  end?: number;
}

export interface ListEntry {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}

export interface StorageAdapter {
  readonly kind: string;
  putObject(
    key: string,
    body: Readable | Buffer,
    meta?: PutMeta,
  ): Promise<Etag>;
  getStream(key: string, range?: Range): Promise<Readable>;
  headObject(key: string): Promise<HeadResult>;
  deleteObject(key: string): Promise<void>;
  signUrl(
    key: string,
    method: "GET" | "PUT",
    ttlSec: number,
    meta?: PutMeta,
  ): Promise<string>;
  copyObject(from: string, to: string): Promise<void>;
  listPrefix(prefix: string, cursor?: string): AsyncIterable<ListEntry>;
}

export class ObjectNotFound extends Error {
  constructor(public readonly key: string) {
    super(`object not found: ${key}`);
    this.name = "ObjectNotFound";
  }
}
