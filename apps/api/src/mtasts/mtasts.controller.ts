import { Controller, Get, Header, NotFoundException, Req } from "@nestjs/common";
import { Request } from "express";
import { Db } from "../db/db.service";
import { config } from "../config";

/**
 * MTA-STS is served over HTTPS at mta-sts.<domain>/.well-known/mta-sts.txt.
 * Traefik routes all mta-sts.* hosts here (see infra/services/traefik).
 *
 * The `mx:` lines list the domain's own published MX hosts (from dns_records),
 * falling back to config.MAIL_HOSTNAME. Mode defaults to `testing` so a wrong
 * host or cert reports failures via TLS-RPT instead of black-holing inbound
 * mail for the policy's whole max_age. Set MTASTS_MODE=enforce once clean.
 */
@Controller()
export class MtaStsController {
  constructor(private readonly db: Db) {}

  @Get(".well-known/mta-sts.txt")
  @Header("content-type", "text/plain; charset=utf-8")
  @Header("cache-control", "public, max-age=3600")
  async policy(@Req() req: Request): Promise<string> {
    if (config.MTASTS_MODE === "none") {
      throw new NotFoundException({ title: "MTA-STS disabled" });
    }
    const host = (req.hostname ?? "").toLowerCase();
    const stripped = host.replace(/^mta-sts\./, "");
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM domains WHERE name = $1 AND status = 'active'",
      [stripped],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Unknown MTA-STS host" });

    const { rows: mxRows } = await this.db.query<{ content: string }>(
      `SELECT content FROM dns_records
       WHERE domain_id = $1 AND type = 'MX' ORDER BY priority NULLS LAST, content`,
      [rows[0].id],
    );
    const hosts = mxRows
      .map((r) => r.content.trim().replace(/\.$/, ""))
      .filter((h) => h.length > 0);
    if (hosts.length === 0) hosts.push(config.MAIL_HOSTNAME);

    return [
      "version: STSv1",
      `mode: ${config.MTASTS_MODE}`,
      ...hosts.map((h) => `mx: ${h}`),
      `max_age: ${config.MTASTS_MAX_AGE}`,
      "",
    ].join("\n");
  }
}
