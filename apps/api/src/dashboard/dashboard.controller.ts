import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { DashboardService } from "./dashboard.service";

@Controller("orgs/:orgId")
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get("dashboard")
  overview(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.overview(orgId, principal.userId);
  }

  @Get("events")
  events(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Query("limit") limit?: string,
  ) {
    return this.svc.recentEvents(orgId, principal.userId, limit ? Number(limit) : 100);
  }
}
