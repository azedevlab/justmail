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
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
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

@Controller("orgs/:orgId/webmail/mailboxes/:mailboxId")
@UseGuards(SessionGuard)
export class WebmailController {
  constructor(private readonly svc: WebmailService) {}

  @Post("unlock")
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
      Math.min(Number(limit) || 50, 200),
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
  send(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(SendRequest)) body: SendRequest,
  ) {
    return this.svc.send(principal, orgId, mailboxId, body);
  }
}
