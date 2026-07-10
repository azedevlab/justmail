import { randomUUID } from "node:crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Contact, ContactRequest } from "@justmail/contracts";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuditService } from "../audit/audit.service";
import type { SessionPrincipal } from "../auth/auth.service";
import {
  deleteCard,
  listCards,
  putCard,
  type CardResource,
} from "./carddav.client";
import { parseVCard, serializeVCard, type VCard } from "./vcard";

function toContact(res: CardResource, card: VCard): Contact {
  return {
    id: card.uid,
    href: res.href,
    full_name: card.full_name,
    emails: card.emails,
    phones: card.phones,
    organization: card.organization,
    note: card.note,
  };
}

function toVCard(uid: string, input: ContactRequest): VCard {
  return {
    uid,
    full_name: input.full_name,
    emails: input.emails,
    phones: input.phones,
    organization: input.organization ?? null,
    note: input.note ?? null,
  };
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<Contact[]> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    const cards = await listCards(address);
    const contacts: Contact[] = [];
    for (const res of cards) {
      const card = parseVCard(res.body);
      if (card) contacts.push(toContact(res, card));
    }
    contacts.sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" }),
    );
    return contacts;
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: ContactRequest,
  ): Promise<Contact> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    const uid = randomUUID();
    const card = toVCard(uid, input);
    const href = await putCard(address, uid, serializeVCard(card));
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.contact.create",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { uid, name: input.full_name },
    });
    return toContact({ href, body: "" }, card);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
    input: ContactRequest,
  ): Promise<Contact> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    const existing = await this.findCard(address, id);
    const card = toVCard(id, input);
    const href = await putCard(address, id, serializeVCard(card));
    void existing;
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.contact.update",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { uid: id, name: input.full_name },
    });
    return toContact({ href, body: "" }, card);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
  ): Promise<void> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
    const existing = await this.findCard(address, id);
    await deleteCard(address, existing.href);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.contact.delete",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { uid: id },
    });
  }

  // Locate a stored card by UID so update/delete operate on the exact href
  // Radicale assigned (which may differ from our <uid>.vcf convention).
  private async findCard(
    address: string,
    id: string,
  ): Promise<{ href: string }> {
    const cards = await listCards(address);
    for (const res of cards) {
      const card = parseVCard(res.body);
      if (card && card.uid === id) return { href: res.href };
    }
    throw new NotFoundException({ title: "Contact not found" });
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
