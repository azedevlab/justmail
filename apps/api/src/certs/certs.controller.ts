import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { CertsService } from "./certs.service";

@Controller("orgs/:orgId/certs")
@UseGuards(SessionGuard)
export class CertsController {
  constructor(private readonly svc: CertsService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.list(orgId, principal.userId);
  }
}
