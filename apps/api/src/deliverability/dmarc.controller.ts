import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "../config";
import { ZodPipe } from "../common/zod.pipe";
import { SkipThrottle } from "../common/throttle.decorator";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { DmarcService } from "./dmarc.service";

const IngestBody = z.object({
  org_id: z.string().uuid(),
  domain: z.string(),
  reporter: z.string(),
  begin_ts: z.string(),
  end_ts: z.string(),
  pass: z.number().int().min(0),
  fail: z.number().int().min(0),
  raw: z.unknown(),
});
type IngestBody = z.infer<typeof IngestBody>;

const IngestXmlBody = z.object({
  org_id: z.string().uuid(),
  // base64-encoded aggregate archive bytes (gzip, zip, or plain XML).
  content_base64: z.string().min(1),
});
type IngestXmlBody = z.infer<typeof IngestXmlBody>;

const digest = (s: string) => createHash("sha256").update(s).digest();

@Controller()
export class DmarcController {
  constructor(private readonly svc: DmarcService) {}

  @Get("orgs/:orgId/deliverability/dmarc")
  @UseGuards(SessionGuard)
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.list(orgId, principal.userId);
  }

  @Get("orgs/:orgId/deliverability/dmarc/:id")
  @UseGuards(SessionGuard)
  getReport(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.getReport(orgId, id, principal.userId);
  }

  @Get("orgs/:orgId/deliverability/reputation")
  @UseGuards(SessionGuard)
  reputation(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.svc.reputation(
      orgId,
      principal.userId,
      Math.min(Math.max(days, 1), 90),
    );
  }

  @Post("internal/dmarc/ingest")
  @SkipThrottle()
  @HttpCode(204)
  async ingest(
    @Headers("x-ingest-token") token: string | undefined,
    @Body(new ZodPipe(IngestBody)) body: IngestBody,
  ) {
    this.assertToken(token);
    await this.svc.ingest({ ...body, raw: body.raw ?? null });
  }

  @Post("internal/dmarc/ingest-xml")
  @SkipThrottle()
  @HttpCode(204)
  async ingestXml(
    @Headers("x-ingest-token") token: string | undefined,
    @Body(new ZodPipe(IngestXmlBody)) body: IngestXmlBody,
  ) {
    this.assertToken(token);
    await this.svc.ingestArchive(
      body.org_id,
      Buffer.from(body.content_base64, "base64"),
    );
  }

  private assertToken(token: string | undefined): void {
    if (
      !token ||
      !timingSafeEqual(digest(token), digest(config.EVENTS_INGEST_TOKEN))
    ) {
      throw new UnauthorizedException({ title: "Invalid ingest token" });
    }
  }
}
