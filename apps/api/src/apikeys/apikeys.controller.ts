import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CreateApiKeyRequest } from "@justmail/types";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { ApiKeysService } from "./apikeys.service";

@Controller("orgs/:orgId/api-keys")
@UseGuards(SessionGuard)
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.list(orgId, principal.userId);
  }

  @Post()
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateApiKeyRequest)) body: CreateApiKeyRequest,
    @Req() req: Request,
  ) {
    return this.svc.create(principal, orgId, body, req.ip);
  }

  @Delete(":id")
  @HttpCode(204)
  revoke(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.revoke(principal, orgId, id, req.ip);
  }
}
