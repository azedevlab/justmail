import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { UpdateBackupScheduleRequest } from "@justmail/types";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { BackupsService } from "./backups.service";

@Controller("orgs/:orgId/backups")
@UseGuards(SessionGuard)
export class BackupsController {
  constructor(private readonly svc: BackupsService) {}

  @Get("schedule")
  schedule(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.getSchedule(orgId, principal.userId);
  }

  @Put("schedule")
  updateSchedule(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(UpdateBackupScheduleRequest)) body: UpdateBackupScheduleRequest,
    @Req() req: Request,
  ) {
    return this.svc.updateSchedule(principal, orgId, body, req.ip);
  }

  @Get()
  runs(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.listRuns(orgId, principal.userId);
  }
}
