import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type {
  Attachment,
  CreateUploadRequest,
  Upload,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuditService } from "../audit/audit.service";
import { StorageService } from "../storage/storage.service";
import { ThumbnailService } from "./thumbnail.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface UploadRow {
  id: string;
  org_id: string;
  filename: string;
  mime: string;
  size_bytes: string | number;
  uploaded_bytes: string | number;
  offset_bytes: string | number;
  storage_kind: string;
  storage_key: string;
  expires_at: Date;
  created_at: Date;
}

interface AttachmentRow {
  id: string;
  filename: string;
  mime: string;
  size_bytes: string | number;
  content_hash: string;
  virus_status: Attachment["virus_status"];
  preview_state: Attachment["preview_state"];
  storage_kind: string;
  storage_key: string;
  created_at: Date;
}

const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly thumbnails: ThumbnailService,
  ) {}

  async createUpload(
    principal: SessionPrincipal,
    orgId: string,
    req: CreateUploadRequest,
    ip?: string,
  ): Promise<Upload> {
    await this.orgs.requireRole(orgId, principal.userId, "member");
    const id = randomUUID();
    const key = `uploads/${id}`;
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
    const { rows } = await this.db.query<UploadRow>(
      `INSERT INTO uploads (id, org_id, uploader_id, filename, mime, size_bytes,
                            storage_kind, storage_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, org_id, filename, mime, size_bytes, uploaded_bytes,
                 offset_bytes, storage_kind, storage_key, expires_at, created_at`,
      [
        id,
        orgId,
        principal.userId,
        req.filename,
        req.mime,
        req.size_bytes,
        this.storage.kind,
        key,
        expiresAt,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "upload.create",
      targetType: "upload",
      targetId: id,
      ip,
      meta: { filename: req.filename, size_bytes: req.size_bytes },
    });
    return toUpload(rows[0]!);
  }

  // tus-style status probe: lets a client resync to the authoritative offset
  // after a dropped connection so it can resume rather than restart.
  async getUpload(
    principal: SessionPrincipal,
    orgId: string,
    uploadId: string,
  ): Promise<Upload> {
    await this.orgs.requireRole(orgId, principal.userId, "member");
    const { rows } = await this.db.query<UploadRow>(
      `SELECT id, org_id, filename, mime, size_bytes, uploaded_bytes,
              offset_bytes, storage_kind, storage_key, expires_at, created_at
       FROM uploads WHERE id = $1 AND org_id = $2`,
      [uploadId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Upload not found" });
    return toUpload(rows[0]);
  }

  async appendChunk(
    principal: SessionPrincipal,
    orgId: string,
    uploadId: string,
    offset: number,
    chunk: Buffer,
  ): Promise<Upload> {
    await this.orgs.requireRole(orgId, principal.userId, "member");
    const { rows } = await this.db.query<UploadRow>(
      `SELECT id, org_id, filename, mime, size_bytes, uploaded_bytes,
              offset_bytes, storage_kind, storage_key, expires_at, created_at
       FROM uploads WHERE id = $1 AND org_id = $2`,
      [uploadId, orgId],
    );
    const upload = rows[0];
    if (!upload) throw new NotFoundException({ title: "Upload not found" });
    if (Number(upload.offset_bytes) !== offset) {
      throw new ConflictException({
        title: "Offset mismatch",
        detail: `expected offset ${upload.offset_bytes}, got ${offset}`,
      });
    }
    if (Number(upload.uploaded_bytes) + chunk.length > Number(upload.size_bytes)) {
      throw new BadRequestException({ title: "Chunk exceeds declared size" });
    }
    // Append: for local FS this is fine as a single PUT of the whole file so
    // far. Real chunked-append implementations would stream to the adapter.
    // We keep a per-upload staging key in the storage adapter.
    const staged = await this.storage
      .stream(orgId, upload.storage_key)
      .then(async (s) => {
        const buffers: Buffer[] = [];
        for await (const buf of s) buffers.push(buf as Buffer);
        return Buffer.concat(buffers);
      })
      .catch(() => Buffer.alloc(0));
    const merged = Buffer.concat([staged, chunk]);
    await this.storage.put(orgId, upload.storage_key, merged, upload.mime);
    const { rows: updated } = await this.db.query<UploadRow>(
      `UPDATE uploads
       SET uploaded_bytes = uploaded_bytes + $2,
           offset_bytes = offset_bytes + $2
       WHERE id = $1
       RETURNING id, org_id, filename, mime, size_bytes, uploaded_bytes,
                 offset_bytes, storage_kind, storage_key, expires_at, created_at`,
      [uploadId, chunk.length],
    );
    return toUpload(updated[0]!);
  }

  async finaliseUpload(
    principal: SessionPrincipal,
    orgId: string,
    uploadId: string,
    ip?: string,
  ): Promise<Attachment> {
    await this.orgs.requireRole(orgId, principal.userId, "member");
    const { rows: uploads } = await this.db.query<UploadRow>(
      "SELECT * FROM uploads WHERE id = $1 AND org_id = $2",
      [uploadId, orgId],
    );
    const upload = uploads[0];
    if (!upload) throw new NotFoundException({ title: "Upload not found" });
    if (Number(upload.uploaded_bytes) !== Number(upload.size_bytes)) {
      throw new BadRequestException({
        title: "Upload incomplete",
        detail: `uploaded ${upload.uploaded_bytes} of ${upload.size_bytes}`,
      });
    }

    // Hash the finished body to enable content-addressed dedup.
    const stream = await this.storage.stream(orgId, upload.storage_key);
    const hash = createHash("sha256");
    const bufs: Buffer[] = [];
    for await (const buf of stream) {
      hash.update(buf as Buffer);
      bufs.push(buf as Buffer);
    }
    const contentHash = hash.digest("hex");
    const finalKey = `attachments/${contentHash}`;

    // Dedup: if we already have this hash in the org, reuse it.
    const existing = await this.db.query<AttachmentRow>(
      "SELECT * FROM attachments WHERE org_id = $1 AND content_hash = $2",
      [orgId, contentHash],
    );
    if (existing.rows[0]) {
      await this.db.query("DELETE FROM uploads WHERE id = $1", [uploadId]);
      await this.storage.remove(orgId, upload.storage_key).catch(() => undefined);
      return toAttachment(existing.rows[0]);
    }

    await this.storage.copy(orgId, upload.storage_key, finalKey);
    await this.storage.remove(orgId, upload.storage_key).catch(() => undefined);

    const { rows: inserted } = await this.db.query<AttachmentRow>(
      `INSERT INTO attachments (org_id, content_hash, filename, mime, size_bytes,
                                storage_kind, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, filename, mime, size_bytes, content_hash, virus_status,
                 preview_state, storage_kind, storage_key, created_at`,
      [
        orgId,
        contentHash,
        upload.filename,
        upload.mime,
        Buffer.concat(bufs).length,
        this.storage.kind,
        finalKey,
      ],
    );
    await this.db.query("DELETE FROM uploads WHERE id = $1", [uploadId]);

    const attachment = inserted[0]!;
    // Best-effort thumbnail generation; never blocks or fails finalise.
    if (this.thumbnails.canThumbnail(attachment.mime, Number(attachment.size_bytes))) {
      void this.thumbnails
        .generate(
          orgId,
          attachment.id,
          contentHash,
          attachment.mime,
          Number(attachment.size_bytes),
        )
        .catch(() => undefined);
    }

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "attachment.finalise",
      targetType: "attachment",
      targetId: inserted[0]!.id,
      ip,
      meta: { filename: upload.filename, size_bytes: upload.size_bytes },
    });

    return toAttachment(attachment);
  }

  async get(orgId: string, id: string, userId: string): Promise<Attachment> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<AttachmentRow>(
      `SELECT id, filename, mime, size_bytes, content_hash, virus_status,
              preview_state, storage_kind, storage_key, created_at
       FROM attachments WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Attachment not found" });
    return toAttachment(rows[0]);
  }

  async markVirusStatus(
    orgId: string,
    id: string,
    status: Attachment["virus_status"],
  ): Promise<void> {
    await this.db.query(
      "UPDATE attachments SET virus_status = $3 WHERE id = $1 AND org_id = $2",
      [id, orgId, status],
    );
  }

  /** Resolve an attachment for streaming download; opens no stream itself. */
  async forDownload(
    orgId: string,
    id: string,
    userId: string,
  ): Promise<Attachment> {
    const att = await this.get(orgId, id, userId);
    if (att.virus_status === "infected")
      throw new BadRequestException({ title: "Attachment quarantined" });
    return att;
  }

  /** Open a (optionally ranged) read stream for a stored attachment body. */
  openStream(
    orgId: string,
    contentHash: string,
    range?: { start: number; end?: number },
  ) {
    return this.storage.stream(orgId, `attachments/${contentHash}`, range);
  }
}

function toUpload(r: UploadRow): Upload {
  return {
    id: r.id,
    filename: r.filename,
    mime: r.mime,
    size_bytes: Number(r.size_bytes),
    uploaded_bytes: Number(r.uploaded_bytes),
    offset_bytes: Number(r.offset_bytes),
    expires_at: r.expires_at.toISOString(),
    created_at: r.created_at.toISOString(),
  };
}

function toAttachment(r: AttachmentRow): Attachment {
  return {
    id: r.id,
    filename: r.filename,
    mime: r.mime,
    size_bytes: Number(r.size_bytes),
    content_hash: r.content_hash,
    virus_status: r.virus_status,
    preview_state: r.preview_state,
    created_at: r.created_at.toISOString(),
  };
}
