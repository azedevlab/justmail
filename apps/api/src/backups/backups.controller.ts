import {
  Body,
  Controller,
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
import {
  RunBackupRequest,
  UpdateBackupScheduleRequest,
} from "@justmail/contracts";
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

  @Post("run")
  run(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(RunBackupRequest)) body: RunBackupRequest,
    @Req() req: Request,
  ) {
    return this.svc.runNow(principal, orgId, body.kind, req.ip);
  }

  @Post(":id/restore")
  @HttpCode(204)
  async restore(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.svc.restore(principal, orgId, id, req.ip);
  }
}
