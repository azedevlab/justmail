import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { AuditService } from "./audit.service";

@Controller()
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get("orgs/:orgId/audit")
  @UseGuards(SessionGuard)
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.svc.list(
      orgId,
      principal.userId,
      Math.min(Math.max(limit, 1), 200),
    );
  }
}
