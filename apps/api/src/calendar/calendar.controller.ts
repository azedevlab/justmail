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
import { CalendarEventRequest, type CalendarEvent } from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { CalendarService } from "./calendar.service";

@Controller("orgs/:orgId/webmail/mailboxes/:mailboxId/calendar/events")
@UseGuards(SessionGuard)
export class CalendarController {
  constructor(private readonly svc: CalendarService) {}

  @Get()
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
  ): Promise<CalendarEvent[]> {
    return this.svc.list(principal, orgId, mailboxId);
  }

  @Post()
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Body(new ZodPipe(CalendarEventRequest)) body: CalendarEventRequest,
  ): Promise<CalendarEvent> {
    return this.svc.create(principal, orgId, mailboxId, body);
  }

  @Put(":id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("mailboxId", ParseUUIDPipe) mailboxId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(CalendarEventRequest)) body: CalendarEventRequest,
  ): Promise<CalendarEvent> {
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
