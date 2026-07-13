import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { UpsertThemeRequest } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { ThemesService } from "./themes.service";

@Controller("orgs/:orgId")
@UseGuards(SessionGuard)
export class ThemesController {
  constructor(private readonly svc: ThemesService) {}

  @Get("themes")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.get(orgId, principal.userId);
  }

  @Put("themes")
  upsert(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(UpsertThemeRequest)) body: UpsertThemeRequest,
    @Req() req: Request,
  ) {
    return this.svc.upsert(principal, orgId, body, req.ip);
  }
}
