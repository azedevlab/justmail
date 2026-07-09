import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "../config";
import { ZodPipe } from "../common/zod.pipe";
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

  @Post("internal/dmarc/ingest")
  @HttpCode(204)
  async ingest(
    @Headers("x-ingest-token") token: string | undefined,
    @Body(new ZodPipe(IngestBody)) body: IngestBody,
  ) {
    if (
      !token ||
      !timingSafeEqual(digest(token), digest(config.EVENTS_INGEST_TOKEN))
    ) {
      throw new UnauthorizedException({ title: "Invalid ingest token" });
    }
    await this.svc.ingest({ ...body, raw: body.raw ?? null });
  }
}
