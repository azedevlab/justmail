import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { DkimService } from "./dkim.service";
import { DnsService } from "./dns.service";

const GenerateBody = z.object({
  algorithm: z.enum(["rsa2048", "ed25519"]).default("rsa2048"),
});

@Controller("orgs/:orgId/domains/:domainId")
@UseGuards(SessionGuard)
export class DkimController {
  constructor(
    private readonly dkim: DkimService,
    private readonly dns: DnsService,
  ) {}

  @Get("dkim")
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
  ) {
    return this.dkim.listForDomain(orgId, domainId, principal.userId);
  }

  @Post("dkim")
  generate(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Body(new ZodPipe(GenerateBody)) body: z.infer<typeof GenerateBody>,
    @Req() req: Request,
  ) {
    return this.dkim.generate(principal, orgId, domainId, body.algorithm, req.ip);
  }

  @Post("dkim/:keyId/activate")
  @HttpCode(204)
  activate(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Param("keyId", ParseUUIDPipe) keyId: string,
    @Req() req: Request,
  ) {
    return this.dkim.activate(principal, orgId, domainId, keyId, req.ip);
  }

  @Post("dkim/:keyId/retire")
  @HttpCode(204)
  retire(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Param("keyId", ParseUUIDPipe) keyId: string,
    @Req() req: Request,
  ) {
    return this.dkim.retire(principal, orgId, domainId, keyId, req.ip);
  }

  @Post("dns/sync")
  syncDns(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    return this.dns.syncToProvider(principal, orgId, domainId, req.ip);
  }

  @Post("dns/check")
  checkDns(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
  ) {
    return this.dns.check(orgId, domainId, principal.userId);
  }
}
