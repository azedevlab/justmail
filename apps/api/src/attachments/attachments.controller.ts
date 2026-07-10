import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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

@Controller("orgs/:orgId")
@UseGuards(SessionGuard)
export class AttachmentsController {
  constructor(private readonly svc: AttachmentsService) {}

  @Post("uploads")
  createUpload(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateUploadRequest)) body: CreateUploadRequest,
    @Req() req: Request,
  ) {
    return this.svc.createUpload(principal, orgId, body, req.ip);
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
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return this.svc.appendChunk(
      principal,
      orgId,
      id,
      offset,
      Buffer.concat(chunks),
    );
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
    return this.svc.get(orgId, id, principal.userId);
  }

  @Get("attachments/:id/download")
  async download(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const url = await this.svc.signedDownload(orgId, id, principal.userId);
    res.redirect(302, url);
  }
}
