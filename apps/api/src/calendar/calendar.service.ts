import { randomUUID } from "node:crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { CalendarEvent, CalendarEventRequest } from "@justmail/contracts";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuditService } from "../audit/audit.service";
import type { SessionPrincipal } from "../auth/auth.service";
import {
  deleteEvent,
  listEvents,
  putEvent,
  type EventResource,
} from "./caldav.client";
import { parseICal, serializeICal, type ICalEvent } from "./ical";

function toEvent(res: EventResource, ical: ICalEvent): CalendarEvent {
  return {
    id: ical.uid,
    href: res.href,
    summary: ical.summary,
    starts_at: ical.starts_at,
    ends_at: ical.ends_at,
    all_day: ical.all_day,
    location: ical.location,
    description: ical.description,
  };
}

function toICal(uid: string, input: CalendarEventRequest): ICalEvent {
  return {
    uid,
    summary: input.summary,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    all_day: input.all_day,
    location: input.location ?? null,
    description: input.description ?? null,
  };
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<CalendarEvent[]> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    const resources = await listEvents(address);
    const events: CalendarEvent[] = [];
    for (const res of resources) {
      const ical = parseICal(res.body);
      if (ical) events.push(toEvent(res, ical));
    }
    events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return events;
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: CalendarEventRequest,
  ): Promise<CalendarEvent> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    const uid = randomUUID();
    const ical = toICal(uid, input);
    const href = await putEvent(address, uid, serializeICal(ical));
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.calendar.create",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { uid, summary: input.summary },
    });
    return toEvent({ href, body: "" }, ical);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
    input: CalendarEventRequest,
  ): Promise<CalendarEvent> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    await this.findEvent(address, id);
    const ical = toICal(id, input);
    const href = await putEvent(address, id, serializeICal(ical));
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.calendar.update",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { uid: id, summary: input.summary },
    });
    return toEvent({ href, body: "" }, ical);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
  ): Promise<void> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    const existing = await this.findEvent(address, id);
    await deleteEvent(address, existing.href);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.calendar.delete",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { uid: id },
    });
  }

  private async findEvent(
    address: string,
    id: string,
  ): Promise<{ href: string }> {
    const resources = await listEvents(address);
    for (const res of resources) {
      const ical = parseICal(res.body);
      if (ical && ical.uid === id) return { href: res.href };
    }
    throw new NotFoundException({ title: "Event not found" });
  }

  private async resolveMailbox(
    orgId: string,
    mailboxId: string,
    userId: string,
  ): Promise<string> {
    await this.orgs.requireRole(orgId, userId, "member");
    const { rows } = await this.db.query<{ address: string }>(
      `SELECT (m.local_part || '@' || d.name) AS address
         FROM mailboxes m JOIN domains d ON d.id = m.domain_id
        WHERE m.id = $1 AND d.org_id = $2`,
      [mailboxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Mailbox not found" });
    return rows[0].address;
  }
}
