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
import { ScimConfigRequest } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { ScimService } from "./scim.service";

@Controller("orgs/:orgId/scim")
@UseGuards(SessionGuard)
export class ScimAdminController {
  constructor(private readonly scim: ScimService) {}

  @Get()
  async config(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    const cfg = await this.scim.getConfig(orgId, principal.userId);
    return { ...cfg, user_count: await this.scim.userCount(orgId) };
  }

  @Put()
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(ScimConfigRequest)) body: ScimConfigRequest,
    @Req() req: Request,
  ) {
    return this.scim.updateConfig(principal, orgId, body, req.ip);
  }

  @Post("token")
  @HttpCode(200)
  rotateToken(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Req() req: Request,
  ) {
    return this.scim.generateToken(principal, orgId, req.ip);
  }

  @Delete("token")
  @HttpCode(204)
  revokeToken(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Req() req: Request,
  ) {
    return this.scim.revokeToken(principal, orgId, req.ip);
  }
}
