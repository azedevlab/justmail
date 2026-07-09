import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CreateWebhookRequest } from "@justmail/types";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { WebhooksService } from "./webhooks.service";

@Controller("orgs/:orgId/webhooks")
@UseGuards(SessionGuard)
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

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
    @Body(new ZodPipe(CreateWebhookRequest)) body: CreateWebhookRequest,
    @Req() req: Request,
  ) {
    return this.svc.create(principal, orgId, body, req.ip);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.remove(principal, orgId, id, req.ip);
  }

  @Get(":id/deliveries")
  deliveries(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("limit") limit?: string,
  ) {
    return this.svc.recentDeliveries(
      orgId,
      principal.userId,
      id,
      limit ? Number(limit) : 50,
    );
  }
}
