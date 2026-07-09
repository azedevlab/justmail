import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { UpsertSettingRequest } from "@justmail/types";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { SettingsService } from "./settings.service";

@Controller("orgs/:orgId/settings")
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Query("prefix") prefix?: string,
  ) {
    return this.svc.list(orgId, principal.userId, prefix);
  }

  @Put(":key")
  @HttpCode(204)
  upsert(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("key") key: string,
    @Body(new ZodPipe(UpsertSettingRequest)) body: UpsertSettingRequest,
    @Req() req: Request,
  ) {
    return this.svc.upsert(principal, orgId, key, body.value, req.ip);
  }
}
