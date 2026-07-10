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
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { SsoProviderRequest } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { SsoService } from "./sso.service";

@Controller("orgs/:orgId/sso/providers")
@UseGuards(SessionGuard)
export class SsoAdminController {
  constructor(private readonly sso: SsoService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.sso.list(orgId, principal.userId);
  }

  @Get(":id")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.sso.get(orgId, principal.userId, id);
  }

  @Post()
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(SsoProviderRequest)) body: SsoProviderRequest,
    @Req() req: Request,
  ) {
    return this.sso.create(principal, orgId, body, req.ip);
  }

  @Put(":id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SsoProviderRequest)) body: SsoProviderRequest,
    @Req() req: Request,
  ) {
    return this.sso.update(principal, orgId, id, body, req.ip);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.sso.remove(principal, orgId, id, req.ip);
  }
}
