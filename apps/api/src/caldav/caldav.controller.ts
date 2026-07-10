import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Header,
  HttpCode,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { ImapFlow } from "imapflow";
import { config } from "../config";
import { SkipThrottle } from "../common/throttle.decorator";

/**
 * Radicale http_x_remote_user backend calls GET /internal/caldav/auth on every
 * request with the incoming user/pass. We proxy to Dovecot IMAP for a lightweight
 * "does this password work" check — same auth surface as webmail.
 */
@Controller("internal/caldav")
@SkipThrottle()
export class CaldavController {
  @Get("auth")
  @HttpCode(200)
  @Header("content-type", "text/plain")
  async auth(
    @Headers("x-remote-user") remoteUser: string | undefined,
    @Headers("x-remote-pass") remotePass: string | undefined,
    @Headers("x-ingest-token") gatewayToken: string | undefined,
  ): Promise<string> {
    if (
      !gatewayToken ||
      !timingSafeEqual(
        createHash("sha256").update(gatewayToken).digest(),
        createHash("sha256").update(config.EVENTS_INGEST_TOKEN).digest(),
      )
    ) {
      throw new UnauthorizedException({ title: "Gateway not authorized" });
    }
    if (!remoteUser || !remotePass) {
      throw new UnauthorizedException({ title: "Missing credentials" });
    }
    const client = new ImapFlow({
      host: "dovecot",
      port: 993,
      secure: true,
      auth: { user: remoteUser, pass: remotePass },
      tls: { rejectUnauthorized: false },
      logger: false,
    });
    try {
      await client.connect();
      await client.logout();
    } catch {
      throw new ForbiddenException({ title: "Invalid credentials" });
    }
    return remoteUser;
  }
}
