import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
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
 * S3-compatible adapter — works against AWS S3, Cloudflare R2, MinIO,
 * Backblaze B2. Provider-specific quirks (path-style vs virtual-hosted,
 * checksum options) are handled by the caller via the S3ClientConfig.
 */
export interface S3AdapterOptions extends S3ClientConfig {
  bucket: string;
  publicUrlPrefix?: string;
}

export class S3Adapter implements StorageAdapter {
  readonly kind: string;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3AdapterOptions, kind = "s3") {
    const { bucket, publicUrlPrefix, ...clientOpts } = options;
    void publicUrlPrefix;
    this.bucket = bucket;
    this.client = new S3Client(clientOpts);
    this.kind = kind;
  }

  async putObject(
    key: string,
    body: Readable | Buffer,
    meta?: PutMeta,
  ): Promise<Etag> {
    const res = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: meta?.contentType,
        ContentLength: meta?.contentLength,
        CacheControl: meta?.cacheControl,
        Metadata: meta?.metadata,
      }),
    );
    return {
      etag: (res.ETag ?? "").replace(/"/g, ""),
      key,
      size: meta?.contentLength ?? 0,
    };
  }

  async getStream(key: string, range?: Range): Promise<Readable> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: range
            ? `bytes=${range.start}-${range.end ?? ""}`
            : undefined,
        }),
      );
      return res.Body as Readable;
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey")
        throw new ObjectNotFound(key);
      throw err;
    }
  }

  async headObject(key: string): Promise<HeadResult> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: res.ContentLength ?? 0,
        etag: (res.ETag ?? "").replace(/"/g, ""),
        contentType: res.ContentType,
        lastModified: res.LastModified,
        metadata: res.Metadata,
      };
    } catch (err) {
      if ((err as { name?: string }).name === "NotFound")
        throw new ObjectNotFound(key);
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signUrl(
    key: string,
    method: "GET" | "PUT",
    ttlSec: number,
    meta?: PutMeta,
  ): Promise<string> {
    const cmd =
      method === "PUT"
        ? new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: meta?.contentType,
          })
        : new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: ttlSec });
  }

  async copyObject(from: string, to: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(from)}`,
        Key: to,
      }),
    );
  }

  async *listPrefix(
    prefix: string,
    cursor?: string,
  ): AsyncIterable<ListEntry> {
    let token = cursor;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const o of res.Contents ?? []) {
        yield {
          key: o.Key ?? "",
          size: o.Size ?? 0,
          lastModified: o.LastModified ?? new Date(0),
          etag: (o.ETag ?? "").replace(/"/g, ""),
        };
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  }
}
