import { BlobServiceClient } from "@azure/storage-blob";
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

export interface AzureAdapterOptions {
  connectionString: string;
  container: string;
}

/** Azure Blob Storage adapter. */
export class AzureAdapter implements StorageAdapter {
  readonly kind = "azure";
  private readonly container: ReturnType<
    BlobServiceClient["getContainerClient"]
  >;

  constructor(options: AzureAdapterOptions) {
    const service = BlobServiceClient.fromConnectionString(
      options.connectionString,
    );
    this.container = service.getContainerClient(options.container);
  }

  async putObject(
    key: string,
    body: Readable | Buffer,
    meta?: PutMeta,
  ): Promise<Etag> {
    const blob = this.container.getBlockBlobClient(key);
    let size = 0;
    if (Buffer.isBuffer(body)) {
      await blob.uploadData(body, {
        blobHTTPHeaders: {
          blobContentType: meta?.contentType,
          blobCacheControl: meta?.cacheControl,
        },
        metadata: meta?.metadata,
      });
      size = body.length;
    } else {
      await blob.uploadStream(body);
      size = meta?.contentLength ?? 0;
    }
    const props = await blob.getProperties();
    return { etag: (props.etag ?? "").replace(/"/g, ""), key, size };
  }

  async getStream(key: string, range?: Range): Promise<Readable> {
    const blob = this.container.getBlockBlobClient(key);
    try {
      const download = await blob.download(
        range?.start ?? 0,
        range ? (range.end ?? 0) - (range.start ?? 0) + 1 : undefined,
      );
      if (!download.readableStreamBody) throw new ObjectNotFound(key);
      return download.readableStreamBody as unknown as Readable;
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404)
        throw new ObjectNotFound(key);
      throw err;
    }
  }

  async headObject(key: string): Promise<HeadResult> {
    const blob = this.container.getBlockBlobClient(key);
    try {
      const props = await blob.getProperties();
      return {
        size: props.contentLength ?? 0,
        etag: (props.etag ?? "").replace(/"/g, ""),
        contentType: props.contentType,
        lastModified: props.lastModified,
        metadata: props.metadata,
      };
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404)
        throw new ObjectNotFound(key);
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.container.deleteBlob(key).catch(() => undefined);
  }

  async signUrl(
    key: string,
    method: "GET" | "PUT",
    ttlSec: number,
  ): Promise<string> {
    const blob = this.container.getBlockBlobClient(key);
    const sas = await blob.generateSasUrl({
      permissions:
        method === "PUT"
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ({ write: true, create: true } as any)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ({ read: true } as any),
      expiresOn: new Date(Date.now() + ttlSec * 1000),
    });
    return sas;
  }

  async copyObject(from: string, to: string): Promise<void> {
    const src = this.container.getBlockBlobClient(from);
    const dst = this.container.getBlockBlobClient(to);
    await dst.syncCopyFromURL(src.url);
  }

  async *listPrefix(prefix: string): AsyncIterable<ListEntry> {
    for await (const b of this.container.listBlobsFlat({ prefix })) {
      yield {
        key: b.name,
        size: b.properties.contentLength ?? 0,
        lastModified: b.properties.lastModified ?? new Date(0),
        etag: (b.properties.etag ?? "").replace(/"/g, ""),
      };
    }
  }
}
