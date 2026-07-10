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
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  AcceptInviteRequest,
  CreateInviteRequest,
} from "@justmail/contracts";
import { config } from "../config";
import { ZodPipe } from "../common/zod.pipe";
import { Throttle } from "../common/throttle.decorator";
import { Principal, SESSION_COOKIE, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { InvitesService } from "./invites.service";

@Controller()
export class InvitesController {
  constructor(private readonly svc: InvitesService) {}

  @Get("orgs/:orgId/invites")
  @UseGuards(SessionGuard)
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.list(orgId, principal.userId);
  }

  @Post("orgs/:orgId/invites")
  @UseGuards(SessionGuard)
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodPipe(CreateInviteRequest)) body: CreateInviteRequest,
    @Req() req: Request,
  ) {
    return this.svc.create(principal, orgId, body, req.ip);
  }

  @Delete("orgs/:orgId/invites/:id")
  @UseGuards(SessionGuard)
  @HttpCode(204)
  revoke(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.revoke(principal, orgId, id, req.ip);
  }

  // Public: token holder can preview + accept without a session.
  @Get("invites/:token")
  preview(@Param("token") token: string) {
    return this.svc.preview(token);
  }

  @Post("invites/:token/accept")
  @Throttle({ limit: config.RATE_LIMIT_AUTH_MAX, ttl: config.RATE_LIMIT_AUTH_TTL })
  async accept(
    @Param("token") token: string,
    @Body(new ZodPipe(AcceptInviteRequest)) body: AcceptInviteRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token: sessionToken, expiresAt } = await this.svc.accept(
      token,
      body,
      req.ip,
      req.get("user-agent") ?? undefined,
    );
    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      domain: config.NODE_ENV === "production" ? config.JM_WEB_HOST : undefined,
      path: "/",
      expires: expiresAt,
    });
    return { ok: true };
  }
}
