import { Controller, Get, Header, NotFoundException, Req } from "@nestjs/common";
import { Request } from "express";
import { Db } from "../db/db.service";
import { config } from "../config";

/**
 * MTA-STS is served over HTTPS at mta-sts.<domain>/.well-known/mta-sts.txt.
 * Traefik routes all mta-sts.* hosts here (see infra/services/traefik).
 * The policy pins traffic to config.MAIL_HOSTNAME (mail.devlab.az by default).
 */
@Controller()
export class MtaStsController {
  constructor(private readonly db: Db) {}

  @Get(".well-known/mta-sts.txt")
  @Header("content-type", "text/plain; charset=utf-8")
  @Header("cache-control", "public, max-age=3600")
  async policy(@Req() req: Request): Promise<string> {
    const host = (req.hostname ?? "").toLowerCase();
    const stripped = host.replace(/^mta-sts\./, "");
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM domains WHERE name = $1 AND status = 'active'",
      [stripped],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Unknown MTA-STS host" });
    return [
      "version: STSv1",
      "mode: enforce",
      `mx: ${config.MAIL_HOSTNAME}`,
      "max_age: 604800",
      "",
    ].join("\n");
  }
}
