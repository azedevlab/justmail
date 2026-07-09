import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  CreateMailboxRequest,
  SetMailboxPasswordRequest,
  UpdateMailboxRequest,
} from "@justmail/types";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { MailboxesService } from "./mailboxes.service";

@Controller("orgs/:orgId")
@UseGuards(SessionGuard)
export class MailboxesController {
  constructor(private readonly svc: MailboxesService) {}

  @Get("mailboxes")
  listAll(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.listOrg(orgId, principal.userId);
  }

  @Get("mailboxes.csv")
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", "attachment; filename=mailboxes.csv")
  exportCsv(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.exportCsv(orgId, principal.userId);
  }

  @Get("domains/:domainId/mailboxes")
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
  ) {
    return this.svc.list(orgId, domainId, principal.userId);
  }

  @Post("domains/:domainId/mailboxes")
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Body(new ZodPipe(CreateMailboxRequest)) body: CreateMailboxRequest,
    @Req() req: Request,
  ) {
    return this.svc.create(principal, orgId, domainId, body, req.ip);
  }

  @Get("mailboxes/:id")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.get(orgId, id, principal.userId);
  }

  @Patch("mailboxes/:id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateMailboxRequest)) body: UpdateMailboxRequest,
    @Req() req: Request,
  ) {
    return this.svc.update(principal, orgId, id, body, req.ip);
  }

  @Put("mailboxes/:id/password")
  @HttpCode(204)
  async setPassword(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SetMailboxPasswordRequest)) body: SetMailboxPasswordRequest,
    @Req() req: Request,
  ) {
    await this.svc.setPassword(principal, orgId, id, body.password, req.ip);
  }

  @Delete("mailboxes/:id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.remove(principal, orgId, id, req.ip);
  }
}
