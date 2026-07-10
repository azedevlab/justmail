import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
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
  ComposeRequest,
  FlagAction,
  SaveDraftRequest,
  SieveRuleRequest,
  SignatureRequest,
  TemplateRequest,
} from "@justmail/contracts";
import {
  MoveRequest,
  SearchRequest,
  UnlockRequest,
  WebmailService,
} from "./webmail.service";
import { PersonalizationService } from "./personalization.service";
import { SieveService } from "./sieve.service";

const FlagBody = z.object({ action: FlagAction });

const AUTH_THROTTLE = {
  limit: config.RATE_LIMIT_AUTH_MAX,
  ttl: config.RATE_LIMIT_AUTH_TTL,
};

@Controller("orgs/:orgId/webmail/mailboxes/:mailboxId")
@UseGuards(SessionGuard)
export class WebmailController {
  constructor(
    private readonly svc: WebmailService,
    private readonly personalization: PersonalizationService,
    private readonly sieve: SieveService,
  ) {}

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

  @Get("folders/:folder/search")
  search(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Query(new ZodPipe(SearchRequest)) query: z.infer<typeof SearchRequest>,
  ) {
    return this.svc.search(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      query,
    );
  }

  @Get("folders/:folder/sync")
  sync(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Query("since") since?: string,
    @Query("uid_validity") uidValidity?: string,
  ) {
    return this.svc.syncMessages(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      since && /^\d+$/.test(since) ? BigInt(since) : null,
      uidValidity && /^\d+$/.test(uidValidity) ? uidValidity : null,
    );
  }

  @Get("folders/:folder/messages/:uid")
  async getMessage(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Param("uid", ParseIntPipe) uid: number,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.svc.getMessage(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      uid,
      ifNoneMatch,
    );
    res.setHeader("ETag", result.etag);
    res.setHeader("Cache-Control", "private, no-cache");
    if ("notModified" in result) {
      res.status(304);
      return;
    }
    return result.message;
  }

  @Get("folders/:folder/messages/:uid/attachments/:idx")
  async attachment(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
    @Param("uid", ParseIntPipe) uid: number,
    @Param("idx", ParseIntPipe) idx: number,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    const a = await this.svc.getAttachment(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
      uid,
      idx,
      ifNoneMatch,
    );
    res.setHeader("ETag", a.etag);
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    if (a.notModified) {
      res.status(304).end();
      return;
    }
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

  @Post("folders/:folder/watch")
  @HttpCode(204)
  watch(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("folder") folder: string,
  ) {
    return this.svc.startWatch(
      principal,
      orgId,
      mailboxId,
      decodeURIComponent(folder),
    );
  }

  @Post("unwatch")
  @HttpCode(204)
  unwatch(
    @Principal() principal: SessionPrincipal,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ) {
    return this.svc.stopWatch(principal, mailboxId);
  }

  @Post("send")
  @Throttle(AUTH_THROTTLE)
  send(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(ComposeRequest)) body: ComposeRequest,
  ) {
    return this.svc.send(principal, orgId, mailboxId, body);
  }

  @Get("scheduled")
  listScheduled(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ) {
    return this.svc.listScheduledSends(principal, orgId, mailboxId);
  }

  @Post("scheduled/:id/cancel")
  @HttpCode(204)
  cancelScheduled(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancelScheduledSend(principal, orgId, mailboxId, id);
  }

  @Post("drafts")
  saveDraft(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(SaveDraftRequest)) body: SaveDraftRequest,
  ) {
    return this.svc.saveDraft(principal, orgId, mailboxId, body);
  }

  @Post("drafts/:uid/discard")
  @HttpCode(204)
  discardDraft(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("uid", ParseIntPipe) uid: number,
  ) {
    return this.svc.discardDraft(principal, orgId, mailboxId, uid);
  }

  @Get("signatures")
  listSignatures(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ) {
    return this.personalization.listSignatures(principal, orgId, mailboxId);
  }

  @Post("signatures")
  createSignature(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(SignatureRequest)) body: SignatureRequest,
  ) {
    return this.personalization.createSignature(principal, orgId, mailboxId, body);
  }

  @Put("signatures/:id")
  updateSignature(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SignatureRequest)) body: SignatureRequest,
  ) {
    return this.personalization.updateSignature(principal, orgId, mailboxId, id, body);
  }

  @Delete("signatures/:id")
  @HttpCode(204)
  deleteSignature(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.personalization.deleteSignature(principal, orgId, mailboxId, id);
  }

  @Get("templates")
  listTemplates(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ) {
    return this.personalization.listTemplates(principal, orgId, mailboxId);
  }

  @Post("templates")
  createTemplate(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(TemplateRequest)) body: TemplateRequest,
  ) {
    return this.personalization.createTemplate(principal, orgId, mailboxId, body);
  }

  @Put("templates/:id")
  updateTemplate(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(TemplateRequest)) body: TemplateRequest,
  ) {
    return this.personalization.updateTemplate(principal, orgId, mailboxId, id, body);
  }

  @Delete("templates/:id")
  @HttpCode(204)
  deleteTemplate(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.personalization.deleteTemplate(principal, orgId, mailboxId, id);
  }

  @Get("filters")
  listFilters(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ) {
    return this.sieve.listRules(principal, orgId, mailboxId);
  }

  @Post("filters")
  createFilter(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(SieveRuleRequest)) body: SieveRuleRequest,
  ) {
    return this.sieve.createRule(principal, orgId, mailboxId, body);
  }

  @Put("filters/:id")
  updateFilter(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SieveRuleRequest)) body: SieveRuleRequest,
  ) {
    return this.sieve.updateRule(principal, orgId, mailboxId, id, body);
  }

  @Delete("filters/:id")
  @HttpCode(204)
  deleteFilter(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.sieve.deleteRule(principal, orgId, mailboxId, id);
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
