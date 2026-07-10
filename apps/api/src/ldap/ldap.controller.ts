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
import { LdapDirectoryRequest } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { LdapService } from "./ldap.service";

@Controller("orgs/:orgId/ldap/directories")
@UseGuards(SessionGuard)
export class LdapController {
  constructor(private readonly ldap: LdapService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.ldap.list(orgId, principal.userId);
  }

  @Get(":id")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.ldap.get(orgId, principal.userId, id);
  }

  @Post()
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(LdapDirectoryRequest)) body: LdapDirectoryRequest,
    @Req() req: Request,
  ) {
    return this.ldap.create(principal, orgId, body, req.ip);
  }

  @Put(":id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(LdapDirectoryRequest)) body: LdapDirectoryRequest,
    @Req() req: Request,
  ) {
    return this.ldap.update(principal, orgId, id, body, req.ip);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.ldap.remove(principal, orgId, id, req.ip);
  }

  @Post(":id/test")
  @HttpCode(200)
  test(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.ldap.testConnection(orgId, principal.userId, id);
  }

  @Post(":id/sync")
  @HttpCode(200)
  sync(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.ldap.syncNow(principal, orgId, id, req.ip);
  }

  @Get(":id/runs")
  runs(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.ldap.listRuns(orgId, principal.userId, id);
  }
}
