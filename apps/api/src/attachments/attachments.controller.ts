import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CreateUploadRequest } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { AttachmentsService } from "./attachments.service";
import { ThumbnailService } from "./thumbnail.service";

@Controller("orgs/:orgId")
@UseGuards(SessionGuard)
export class AttachmentsController {
  constructor(
    private readonly svc: AttachmentsService,
    private readonly thumbnails: ThumbnailService,
  ) {}

  @Post("uploads")
  createUpload(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateUploadRequest)) body: CreateUploadRequest,
    @Req() req: Request,
  ) {
    return this.svc.createUpload(principal, orgId, body, req.ip);
  }

  @Get("uploads/:id")
  uploadStatus(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.getUpload(principal, orgId, id);
  }

  @Post("uploads/:id/chunks")
  async appendChunk(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("upload-offset") offsetHeader: string | undefined,
    @Req() req: Request,
  ) {
    const offset = Number(offsetHeader);
    if (!offsetHeader || !Number.isFinite(offset) || offset < 0) {
      throw new BadRequestException({
        title: "Missing or invalid Upload-Offset header",
      });
    }
    // The global raw body-parser (application/offset+octet-stream) drains the
    // request stream into req.body, so prefer that buffer; fall back to reading
    // the stream directly if the parser did not run for this request.
    const parsed: unknown = (req as { body?: unknown }).body;
    let buffer: Buffer;
    if (Buffer.isBuffer(parsed)) {
      buffer = parsed;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      buffer = Buffer.concat(chunks);
    }
    return this.svc.appendChunk(principal, orgId, id, offset, buffer);
  }

  @Post("uploads/:id/finalise")
  finalise(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.finaliseUpload(principal, orgId, id, req.ip);
  }

  @Get("attachments/:id")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.get(orgId, id, principal);
  }

  @Get("attachments/:id/download")
  async download(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("range") rangeHeader: string | undefined,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    const att = await this.svc.forDownload(orgId, id, principal);
    const etag = `"${att.content_hash}"`;
    const size = att.size_bytes;

    // Content-addressed bodies never change, so a matching ETag is always fresh.
    if (ifNoneMatch && ifNoneMatch.split(",").some((t) => t.trim() === etag)) {
      res.status(304).setHeader("etag", etag);
      return res.end();
    }

    // Force a safe download: never let the browser sniff or inline-render.
    res.setHeader("content-type", att.mime || "application/octet-stream");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
    );
    res.setHeader("etag", etag);
    res.setHeader("accept-ranges", "bytes");
    res.setHeader("cache-control", "private, max-age=0, must-revalidate");

    const range = parseRange(rangeHeader, size);
    if (range === "invalid") {
      res.status(416).setHeader("content-range", `bytes */${size}`);
      return res.end();
    }

    if (range) {
      res.status(206);
      res.setHeader("content-range", `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader("content-length", String(range.end - range.start + 1));
      const stream = await this.svc.openStream(orgId, att.content_hash, range);
      stream.pipe(res);
      return;
    }

    res.status(200).setHeader("content-length", String(size));
    const stream = await this.svc.openStream(orgId, att.content_hash);
    stream.pipe(res);
  }

  @Get("attachments/:id/thumbnail")
  async thumbnail(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    // Validates access and rejects quarantined attachments before serving.
    await this.svc.forDownload(orgId, id, principal);
    const thumb = await this.thumbnails.open(orgId, id);
    if (!thumb) throw new NotFoundException({ title: "Thumbnail not ready" });

    const etag = `"${thumb.contentHash}"`;
    if (ifNoneMatch && ifNoneMatch.split(",").some((t) => t.trim() === etag)) {
      res.status(304).setHeader("etag", etag);
      return res.end();
    }

    res.setHeader("content-type", "image/webp");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("etag", etag);
    res.setHeader("cache-control", "private, max-age=300");
    const stream = await this.thumbnails.stream(orgId, thumb.contentHash);
    stream.pipe(res);
  }
}

// Parse a single-range `bytes=start-end` request against the object size.
// Returns undefined for no range, "invalid" for an unsatisfiable one.
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | "invalid" | undefined {
  if (!header) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalid";
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return "invalid";
  let start: number;
  let end: number;
  if (rawStart === "") {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}
