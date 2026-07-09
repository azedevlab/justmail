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
import { QueueService } from "./queue.service";

@Controller("orgs/:orgId/queue")
@UseGuards(SessionGuard)
export class QueueController {
  constructor(private readonly svc: QueueService) {}

  @Get()
  latest(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.latest(orgId, principal.userId);
  }

  @Get("deferred")
  deferred(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Query("limit") limit?: string,
  ) {
    return this.svc.deferred(orgId, principal.userId, limit ? Number(limit) : 100);
  }

  @Get("trace/:queueId")
  trace(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("queueId") queueId: string,
  ) {
    return this.svc.trace(orgId, principal.userId, queueId);
  }
}
