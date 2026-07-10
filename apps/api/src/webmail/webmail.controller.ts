import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { ZodPipe } from "../common/zod.pipe";
import { Throttle } from "../common/throttle.decorator";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import {
  FlagAction,
  MoveRequest,
  SendRequest,
  UnlockRequest,
  WebmailService,
} from "./webmail.service";

const FlagBody = z.object({ action: FlagAction });

const AUTH_THROTTLE = {
  limit: config.RATE_LIMIT_AUTH_MAX,
  ttl: config.RATE_LIMIT_AUTH_TTL,
};

@Controller("orgs/:orgId/webmail/mailboxes/:mailboxId")
@UseGuards(SessionGuard)
export class WebmailController {
  constructor(private readonly svc: WebmailService) {}

  @Post("unlock")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(204)
  unlock(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(UnlockRequest)) body: z.infer<typeof UnlockRequest>,
  ) {
    return this.svc.unlock(principal, orgId, mailboxId, body.password);
  }

  @Post("lock")
  @HttpCode(204)
  lock(
    @Principal() principal: SessionPrincipal,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ) {
    return this.svc.lock(principal, mailboxId);
  }

  @Get("folders")
  folders(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ) {
    return this.svc.listFolders(principal, orgId, mailboxId);
  }

  @Get("folders/:folder/messages")
  listMessages(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Query("limit") limit?: string,
  ) {
    return this.svc.listMessages(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      Math.min(Number(limit) || 50, config.WEBMAIL_MESSAGE_LIST_MAX),
    );
  }

  @Get("folders/:folder/messages/:uid")
  getMessage(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Param("uid", ParseIntPipe) uid: number,
  ) {
    return this.svc.getMessage(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      uid,
    );
  }

  @Get("folders/:folder/messages/:uid/attachments/:idx")
  async attachment(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Param("uid", ParseIntPipe) uid: number,
    @Param("idx", ParseIntPipe) idx: number,
    @Res() res: Response,
  ) {
    const a = await this.svc.getAttachment(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      uid,
      idx,
    );
    // Sender-controlled MIME can be active content (text/html, svg with script).
    // nosniff is already set globally; additionally collapse anything outside a
    // known-inert allowlist to octet-stream, and always serve as attachment so
    // a direct URL open downloads rather than renders.
    res.setHeader("Content-Type", safeAttachmentMime(a.mime));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
    );
    res.setHeader("Content-Length", String(a.content.length));
    res.send(a.content);
  }

  @Post("folders/:folder/messages/:uid/flags")
  @HttpCode(204)
  setFlag(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Param("uid", ParseIntPipe) uid: number,
    @Body(new ZodPipe(FlagBody)) body: z.infer<typeof FlagBody>,
  ) {
    return this.svc.setFlag(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      uid,
      body.action,
    );
  }

  @Post("folders/:folder/messages/:uid/move")
  @HttpCode(204)
  move(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Param("uid", ParseIntPipe) uid: number,
    @Body(new ZodPipe(MoveRequest)) body: z.infer<typeof MoveRequest>,
  ) {
    return this.svc.move(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      uid,
      body.destination,
    );
  }

  @Post("folders/:folder/messages/:uid/delete")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Param("uid", ParseIntPipe) uid: number,
  ) {
    return this.svc.remove(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      uid,
    );
  }

  @Post("send")
  @Throttle(AUTH_THROTTLE)
  send(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(SendRequest)) body: SendRequest,
  ) {
    return this.svc.send(principal, orgId, mailboxId, body);
  }
}

// MIME types safe to hand to a browser with a Content-Type. Anything else
// (text/html, image/svg+xml, application/xhtml+xml, …) is collapsed to a
// generic binary type so it can never be interpreted as active content.
const INERT_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/octet-stream",
]);

function safeAttachmentMime(mime: string): string {
  const base = (mime || "").split(";")[0]!.trim().toLowerCase();
  return INERT_MIME.has(base) ? base : "application/octet-stream";
}
