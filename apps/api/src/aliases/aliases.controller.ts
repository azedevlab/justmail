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
import { CreateAliasRequest, UpdateAliasRequest } from "@justmail/types";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { AliasesService } from "./aliases.service";

@Controller("orgs/:orgId")
@UseGuards(SessionGuard)
export class AliasesController {
  constructor(private readonly svc: AliasesService) {}

  @Get("aliases")
  listAll(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.listOrg(orgId, principal.userId);
  }

  @Get("domains/:domainId/aliases")
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
  ) {
    return this.svc.list(orgId, domainId, principal.userId);
  }

  @Post("domains/:domainId/aliases")
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Body(new ZodPipe(CreateAliasRequest)) body: CreateAliasRequest,
    @Req() req: Request,
  ) {
    return this.svc.create(principal, orgId, domainId, body, req.ip);
  }

  @Patch("aliases/:id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateAliasRequest)) body: UpdateAliasRequest,
    @Req() req: Request,
  ) {
    return this.svc.update(principal, orgId, id, body, req.ip);
  }

  @Delete("aliases/:id")
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
