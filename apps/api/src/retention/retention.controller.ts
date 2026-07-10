import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  CreateExportRequest,
  CreateLegalHoldRequest,
  UpdateRetentionRequest,
} from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { RetentionService } from "./retention.service";
import { LegalHoldService } from "./legal-hold.service";
import { ExportService } from "./export.service";

@Controller("orgs/:orgId/retention")
@UseGuards(SessionGuard)
export class RetentionController {
  constructor(
    private readonly retention: RetentionService,
    private readonly holds: LegalHoldService,
    private readonly exports: ExportService,
  ) {}

  @Get()
  policy(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.retention.getPolicy(orgId, principal.userId);
  }

  @Put()
  updatePolicy(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(UpdateRetentionRequest)) body: UpdateRetentionRequest,
    @Req() req: Request,
  ) {
    return this.retention.updatePolicy(principal, orgId, body, req.ip);
  }

  @Get("holds")
  listHolds(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.holds.list(orgId, principal.userId);
  }

  @Post("holds")
  createHold(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateLegalHoldRequest)) body: CreateLegalHoldRequest,
    @Req() req: Request,
  ) {
    return this.holds.create(principal, orgId, body, req.ip);
  }

  @Delete("holds/:id")
  @HttpCode(204)
  releaseHold(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.holds.release(principal, orgId, id, req.ip);
  }

  @Get("exports")
  listExports(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.exports.list(orgId, principal.userId);
  }

  @Post("exports")
  createExport(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateExportRequest)) body: CreateExportRequest,
    @Req() req: Request,
  ) {
    return this.exports.request(principal, orgId, body.mailbox_id, req.ip);
  }

  @Get("exports/:id")
  getExport(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.exports.get(orgId, id, principal.userId);
  }

  @Get("exports/:id/download")
  async download(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { stream, size, filename } = await this.exports.openArchive(
      orgId,
      id,
      principal.userId,
    );
    res.setHeader("content-type", "application/mbox");
    res.setHeader("content-length", String(size));
    res.setHeader(
      "content-disposition",
      `attachment; filename="${filename}"`,
    );
    stream.pipe(res);
  }
}
