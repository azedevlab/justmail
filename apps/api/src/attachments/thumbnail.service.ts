import { Injectable, Logger } from "@nestjs/common";
import sharp from "sharp";
import { Db } from "../db/db.service";
import { StorageService } from "../storage/storage.service";
import { config } from "../config";

// Raster image types sharp can decode safely. SVG is excluded on purpose —
// rasterising untrusted SVG is an XXE/SSRF risk.
const THUMBNAILABLE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
]);

const THUMBNAIL_KIND = "card";

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(
    private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  canThumbnail(mime: string, sizeBytes: number): boolean {
    return (
      config.THUMBNAIL_ENABLED &&
      THUMBNAILABLE.has(mime) &&
      sizeBytes <= config.THUMBNAIL_SOURCE_MAX_BYTES
    );
  }

  /**
   * Generate a webp thumbnail for a stored image and record it. Best-effort:
   * marks preview_state ready/failed and never throws, so a bad image cannot
   * break the finalise path.
   */
  async generate(
    orgId: string,
    attachmentId: string,
    contentHash: string,
    mime: string,
    sizeBytes: number,
  ): Promise<void> {
    if (!this.canThumbnail(mime, sizeBytes)) return;
    await this.setState(orgId, attachmentId, "pending");
    try {
      const source = await this.readSource(orgId, contentHash);
      const pipeline = sharp(source, { failOn: "error" })
        .rotate()
        .resize(config.THUMBNAIL_MAX_DIM, config.THUMBNAIL_MAX_DIM, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: config.THUMBNAIL_QUALITY });
      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      const key = `thumbnails/${contentHash}`;
      await this.storage.put(orgId, key, data, "image/webp");
      await this.db.query(
        `INSERT INTO thumbnails (attachment_id, kind, storage_key, width, height, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (attachment_id, kind) DO UPDATE
           SET storage_key = EXCLUDED.storage_key, width = EXCLUDED.width,
               height = EXCLUDED.height, size_bytes = EXCLUDED.size_bytes`,
        [
          attachmentId,
          THUMBNAIL_KIND,
          this.storage.key(orgId, key),
          info.width,
          info.height,
          data.length,
        ],
      );
      await this.setState(orgId, attachmentId, "ready");
    } catch (err) {
      this.logger.warn(
        `thumbnail generation failed for ${attachmentId}: ${(err as Error).message}`,
      );
      await this.setState(orgId, attachmentId, "failed");
    }
  }

  /** Open the stored thumbnail stream, or null if none is ready. */
  async open(
    orgId: string,
    attachmentId: string,
  ): Promise<{ contentHash: string } | null> {
    const { rows } = await this.db.query<{ storage_key: string }>(
      "SELECT storage_key FROM thumbnails WHERE attachment_id = $1 AND kind = $2",
      [attachmentId, THUMBNAIL_KIND],
    );
    if (!rows[0]) return null;
    // storage_key is the fully-prefixed key; derive the content hash tail.
    const hash = rows[0].storage_key.split("/").pop() ?? "";
    return { contentHash: hash };
  }

  /** Open a read stream for a stored thumbnail body. */
  stream(orgId: string, contentHash: string) {
    return this.storage.stream(orgId, `thumbnails/${contentHash}`);
  }

  private async readSource(orgId: string, contentHash: string): Promise<Buffer> {
    const stream = await this.storage.stream(orgId, `attachments/${contentHash}`);
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      total += (chunk as Buffer).length;
      if (total > config.THUMBNAIL_SOURCE_MAX_BYTES) {
        throw new Error("source exceeds thumbnail size cap");
      }
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  private async setState(
    orgId: string,
    attachmentId: string,
    state: "pending" | "ready" | "failed",
  ): Promise<void> {
    await this.db.query(
      "UPDATE attachments SET preview_state = $3 WHERE id = $1 AND org_id = $2",
      [attachmentId, orgId, state],
    );
  }
}
