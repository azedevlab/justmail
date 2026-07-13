import { Controller, Get, NotFoundException, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { DomainsService } from "./domains.service";

/**
 * BIMI logos are served publicly over HTTPS at <domain>/.well-known/bimi-logo.svg
 * — the URL the default._bimi TXT record's l= tag points at. Traefik routes the
 * domain host here (like the mta-sts.* route for MtaStsController). The domain
 * is resolved from the request hostname; no auth. Excluded from the v1 prefix in
 * main.ts. Streams the org-prefixed object stored by DomainsService.uploadBimi.
 */
@Controller()
export class BimiController {
  constructor(private readonly domains: DomainsService) {}

  @Get(".well-known/bimi-logo.svg")
  async logo(@Req() req: Request, @Res() res: Response): Promise<void> {
    const host = (req.hostname ?? "").toLowerCase();
    const found = await this.domains.bimiLogoForHost(host);
    if (!found) throw new NotFoundException({ title: "No BIMI logo for this host" });

    res.setHeader("content-type", "image/svg+xml");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("cache-control", "public, max-age=3600");
    const stream = await this.domains.bimiStream(found.orgId, found.key);
    stream.pipe(res);
  }
}
