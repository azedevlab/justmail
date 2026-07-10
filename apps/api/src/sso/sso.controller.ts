import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Request, Response } from "express";
import { config } from "../config";
import { Throttle } from "../common/throttle.decorator";
import { SESSION_COOKIE } from "../auth/session.guard";
import { SsoService } from "./sso.service";

const SSO_THROTTLE = {
  limit: config.RATE_LIMIT_AUTH_MAX,
  ttl: config.RATE_LIMIT_AUTH_TTL,
};

@Controller("auth/sso")
export class SsoController {
  constructor(private readonly sso: SsoService) {}

  private setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      domain: config.NODE_ENV === "production" ? config.JM_WEB_HOST : undefined,
      path: "/",
      expires: expiresAt,
    });
  }

  private errorRedirect(res: Response): void {
    res.redirect(this.sso.loginErrorRedirect());
  }

  @Get("discover")
  @Throttle(SSO_THROTTLE)
  discover(@Query("email") email?: string) {
    if (!email) return { provider: null };
    return this.sso.discoverForEmail(email);
  }

  @Get(":id/start")
  @Throttle(SSO_THROTTLE)
  async start(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("relay") relay: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const url = await this.sso.beginLogin(id, relay);
      res.redirect(url);
    } catch {
      this.errorRedirect(res);
    }
  }

  @Get(":id/callback")
  @Throttle(SSO_THROTTLE)
  async callback(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) return this.errorRedirect(res);
    try {
      const out = await this.sso.completeOidc(
        id,
        code,
        state,
        req.ip,
        req.get("user-agent") ?? undefined,
      );
      this.setCookie(res, out.token, out.expiresAt);
      res.redirect(out.relay);
    } catch {
      this.errorRedirect(res);
    }
  }

  @Post(":id/acs")
  @Throttle(SSO_THROTTLE)
  async acs(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const samlResponse = body?.SAMLResponse;
    if (!samlResponse) return this.errorRedirect(res);
    try {
      const out = await this.sso.completeSaml(
        id,
        samlResponse,
        body?.RelayState,
        req.ip,
        req.get("user-agent") ?? undefined,
      );
      this.setCookie(res, out.token, out.expiresAt);
      res.redirect(out.relay);
    } catch {
      this.errorRedirect(res);
    }
  }

  @Get(":id/metadata")
  @Header("content-type", "application/samlmetadata+xml")
  async metadata(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      res.send(await this.sso.metadataXml(id));
    } catch {
      res.status(404).end();
    }
  }
}
