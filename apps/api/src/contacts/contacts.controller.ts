import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ContactRequest, type Contact } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { ContactsService } from "./contacts.service";

@Controller("orgs/:orgId/webmail/mailboxes/:mailboxId/contacts")
@UseGuards(SessionGuard)
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ): Promise<Contact[]> {
    return this.svc.list(principal, orgId, mailboxId);
  }

  @Post()
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(ContactRequest)) body: ContactRequest,
  ): Promise<Contact> {
    return this.svc.create(principal, orgId, mailboxId, body);
  }

  @Put(":id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(ContactRequest)) body: ContactRequest,
  ): Promise<Contact> {
    return this.svc.update(principal, orgId, mailboxId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.svc.remove(principal, orgId, mailboxId, id);
  }
}
