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
import { CreateBlockedIpRequest } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { SecurityService } from "./security.service";
import {
  CountryBlockSetting,
  GeoblockService,
  IpWarmupSetting,
} from "./geoblock.service";

@Controller("orgs/:orgId/security")
@UseGuards(SessionGuard)
export class SecurityController {
  constructor(
    private readonly svc: SecurityService,
    private readonly geo: GeoblockService,
  ) {}

  @Get("score")
  score(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.score(orgId, principal.userId);
  }

  @Get("blocked-ips")
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.listBlockedIps(orgId, principal.userId);
  }

  @Post("blocked-ips")
  block(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateBlockedIpRequest)) body: CreateBlockedIpRequest,
    @Req() req: Request,
  ) {
    return this.svc.blockIp(principal, orgId, body, req.ip);
  }

  @Delete("blocked-ips/:id")
  @HttpCode(204)
  unblock(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.unblockIp(principal, orgId, id, req.ip);
  }

  @Get("country-block")
  getCountryBlock(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.geo.readCountryBlock(orgId, principal.userId);
  }

  @Put("country-block")
  setCountryBlock(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CountryBlockSetting)) body: CountryBlockSetting,
    @Req() req: Request,
  ) {
    return this.geo.writeCountryBlock(principal, orgId, body, req.ip);
  }

  @Get("ip-warmup")
  getWarmup(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.geo.readWarmup(orgId, principal.userId);
  }

  @Put("ip-warmup")
  setWarmup(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(IpWarmupSetting)) body: IpWarmupSetting,
    @Req() req: Request,
  ) {
    return this.geo.writeWarmup(principal, orgId, body, req.ip);
  }
}
