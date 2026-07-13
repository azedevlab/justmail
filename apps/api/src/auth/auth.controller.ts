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
  BootstrapRequest,
  LoginRequest,
  PasskeyAuthOptionsRequest,
  PasskeyAuthVerifyRequest,
  PasskeyRegisterVerifyRequest,
  TwoFaDisableRequest,
  TwoFaVerifyRequest,
} from "@justmail/contracts";
import { config } from "../config";
import { ZodPipe } from "../common/zod.pipe";
import { Throttle } from "../common/throttle.decorator";
import { AuthService, SessionPrincipal } from "./auth.service";

const AUTH_THROTTLE = {
  limit: config.RATE_LIMIT_AUTH_MAX,
  ttl: config.RATE_LIMIT_AUTH_TTL,
};
import { Principal, SESSION_COOKIE, SessionGuard } from "./session.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setCookie(res: Response, token: string, expiresAt: Date): void {
    const domain =
      config.NODE_ENV === "production" ? config.JM_WEB_HOST : undefined;
    // A leftover host-only cookie (set before this cookie was scoped to the
    // parent domain) would shadow the domain-scoped one — cookie-parser keeps
    // the first duplicate — making authenticated requests 401 after a valid
    // login. Clear the host-only variant so only the domain cookie survives.
    if (domain) res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      domain,
      path: "/",
      expires: expiresAt,
    });
  }

  @Get("status")
  status() {
    return this.auth.status();
  }

  @Post("bootstrap")
  @Throttle(AUTH_THROTTLE)
  async bootstrap(
    @Body(new ZodPipe(BootstrapRequest)) body: BootstrapRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, expiresAt } = await this.auth.bootstrap(
      body,
      req.ip,
      req.get("user-agent") ?? undefined,
      req.get("x-bootstrap-token") ?? undefined,
    );
    this.setCookie(res, token, expiresAt);
    return { ok: true };
  }

  @Post("login")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(LoginRequest)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, expiresAt } = await this.auth.login(
      body,
      req.ip,
      req.get("user-agent") ?? undefined,
    );
    this.setCookie(res, token, expiresAt);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(
    @Principal() principal: SessionPrincipal,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(principal, req.ip);
    res.clearCookie(SESSION_COOKIE, {
      path: "/",
      domain:
        config.NODE_ENV === "production" ? config.JM_WEB_HOST : undefined,
    });
    // Also drop any legacy host-only cookie so logout clears both scopes.
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  @Get("me")
  @UseGuards(SessionGuard)
  me(@Principal() principal: SessionPrincipal) {
    return this.auth.me(principal);
  }

  @Post("ws-ticket")
  @Throttle(AUTH_THROTTLE)
  @UseGuards(SessionGuard)
  wsTicket(@Principal() principal: SessionPrincipal) {
    return this.auth.wsTicket(principal);
  }

  @Get("sessions")
  @UseGuards(SessionGuard)
  sessions(@Principal() principal: SessionPrincipal) {
    return this.auth.listSessions(principal);
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async revokeSession(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.auth.revokeSession(principal, id, req.ip);
  }

  @Post("2fa/setup")
  @UseGuards(SessionGuard)
  setup2fa(@Principal() principal: SessionPrincipal) {
    return this.auth.setupTwoFa(principal);
  }

  @Post("2fa/verify")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async verify2fa(
    @Principal() principal: SessionPrincipal,
    @Body(new ZodPipe(TwoFaVerifyRequest)) body: TwoFaVerifyRequest,
    @Req() req: Request,
  ) {
    await this.auth.verifyTwoFa(principal, body.totp_code, req.ip);
  }

  @Post("2fa/disable")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async disable2fa(
    @Principal() principal: SessionPrincipal,
    @Body(new ZodPipe(TwoFaDisableRequest)) body: TwoFaDisableRequest,
    @Req() req: Request,
  ) {
    await this.auth.disableTwoFa(principal, body.password, req.ip);
  }

  @Get("passkeys")
  @UseGuards(SessionGuard)
  listPasskeys(@Principal() principal: SessionPrincipal) {
    return this.auth.listPasskeys(principal);
  }

  @Post("passkeys/register/options")
  @UseGuards(SessionGuard)
  passkeyRegisterOptions(@Principal() principal: SessionPrincipal) {
    return this.auth.passkeyRegisterOptions(principal);
  }

  @Post("passkeys/register/verify")
  @HttpCode(201)
  @UseGuards(SessionGuard)
  passkeyRegisterVerify(
    @Principal() principal: SessionPrincipal,
    @Body(new ZodPipe(PasskeyRegisterVerifyRequest))
    body: PasskeyRegisterVerifyRequest,
    @Req() req: Request,
  ) {
    return this.auth.passkeyRegisterVerify(
      principal,
      body.name,
      body.response,
      req.ip,
    );
  }

  @Delete("passkeys/:id")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async removePasskey(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.auth.removePasskey(principal, id, req.ip);
  }

  @Post("passkeys/login/options")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  passkeyLoginOptions(
    @Body(new ZodPipe(PasskeyAuthOptionsRequest))
    body: PasskeyAuthOptionsRequest,
  ) {
    return this.auth.passkeyAuthOptions(body.email);
  }

  @Post("passkeys/login/verify")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  async passkeyLoginVerify(
    @Body(new ZodPipe(PasskeyAuthVerifyRequest))
    body: PasskeyAuthVerifyRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, expiresAt } = await this.auth.passkeyAuthVerify(
      body.challenge_id,
      body.response,
      req.ip,
      req.get("user-agent") ?? undefined,
    );
    this.setCookie(res, token, expiresAt);
    return { ok: true };
  }
}
