import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  CreateDomainRequest,
  UpdateDomainRequest,
} from "@justmail/types";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { DomainsService } from "./domains.service";

@Controller("orgs/:orgId/domains")
@UseGuards(SessionGuard)
export class DomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.list(orgId, principal.userId);
  }

  @Post()
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateDomainRequest)) body: CreateDomainRequest,
    @Req() req: Request,
  ) {
    return this.svc.create(principal, orgId, body, req.ip);
  }

  @Get(":id")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.get(orgId, id, principal.userId);
  }

  @Patch(":id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateDomainRequest)) body: UpdateDomainRequest,
    @Req() req: Request,
  ) {
    return this.svc.update(principal, orgId, id, body, req.ip);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.remove(principal, orgId, id, req.ip);
  }

  @Get(":id/dns")
  dns(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.getDns(orgId, id, principal.userId);
  }

  @Post(":id/verify")
  verify(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.verify(principal, orgId, id, req.ip);
  }
}
