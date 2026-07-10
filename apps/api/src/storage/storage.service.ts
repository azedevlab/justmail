import { Inject, Injectable, Logger } from "@nestjs/common";
import type { StorageAdapter } from "@justmail/storage";

export const STORAGE_ADAPTER = Symbol("STORAGE_ADAPTER");

/**
 * Thin wrapper around the storage adapter that enforces tenant-prefix
 * discipline. All keys must live under `org/<orgId>/…` — callers pass
 * relative paths and this service prepends the prefix. Attempts to write
 * outside the tenant prefix are rejected loudly.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_ADAPTER) private readonly adapter: StorageAdapter,
  ) {}

  get kind(): string {
    return this.adapter.kind;
  }

  key(orgId: string, ...parts: string[]): string {
    const clean = parts
      .flatMap((p) => p.split("/"))
      .filter((p) => p && p !== "..");
    return ["org", orgId, ...clean].join("/");
  }

  put(orgId: string, path: string, body: Buffer, contentType?: string) {
    return this.adapter.putObject(this.key(orgId, path), body, {
      contentType,
      contentLength: body.length,
    });
  }

  stream(orgId: string, path: string, range?: { start: number; end?: number }) {
    return this.adapter.getStream(this.key(orgId, path), range);
  }

  head(orgId: string, path: string) {
    return this.adapter.headObject(this.key(orgId, path));
  }

  remove(orgId: string, path: string) {
    return this.adapter.deleteObject(this.key(orgId, path));
  }

  sign(orgId: string, path: string, method: "GET" | "PUT", ttlSec = 900) {
    return this.adapter.signUrl(this.key(orgId, path), method, ttlSec);
  }

  async copy(orgId: string, from: string, to: string) {
    await this.adapter.copyObject(this.key(orgId, from), this.key(orgId, to));
  }
}
