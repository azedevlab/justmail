import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

/**
 * Event catalog. Every event JustMail publishes on WebSocket or delivers
 * via webhooks has a stable schema here. Types are discriminated on
 * `type` so consumers can exhaustively match.
 */

const base = <T extends z.ZodTypeAny>(name: string, data: T) =>
  z.object({
    id: Uuid,
    type: z.literal(name),
    org_id: Uuid.nullable(),
    at: IsoDate,
    data,
  });

export const AuthLoginEvent = base(
  "auth.login",
  z.object({ user_id: Uuid, ip: z.string().nullable() }),
);
export const AuthLogoutEvent = base("auth.logout", z.object({ user_id: Uuid }));
export const OrgMemberAddedEvent = base(
  "org.member.added",
  z.object({ user_id: Uuid, role: z.string() }),
);
export const DomainCreatedEvent = base(
  "domain.created",
  z.object({ id: Uuid, name: z.string() }),
);
export const DomainVerifiedEvent = base(
  "domain.verified",
  z.object({ id: Uuid, name: z.string() }),
);
export const DomainDnsSyncedEvent = base(
  "domain.dns_synced",
  z.object({ id: Uuid, applied: z.array(z.string()) }),
);
export const DkimGeneratedEvent = base(
  "dkim.generated",
  z.object({ domain_id: Uuid, selector: z.string() }),
);
export const DkimActivatedEvent = base(
  "dkim.activated",
  z.object({ domain_id: Uuid, key_id: Uuid }),
);
export const MailboxCreatedEvent = base(
  "mailbox.created",
  z.object({ id: Uuid, address: z.string(), quota_mb: z.number().int() }),
);
export const MailboxUpdatedEvent = base(
  "mailbox.updated",
  z.object({ id: Uuid, address: z.string() }),
);
export const MailboxDeletedEvent = base(
  "mailbox.deleted",
  z.object({ id: Uuid, address: z.string() }),
);
export const AliasCreatedEvent = base(
  "alias.created",
  z.object({ id: Uuid, source: z.string(), destinations: z.array(z.string()) }),
);
export const MailReceivedEvent = base(
  "mail.received",
  z.object({ queue_id: z.string(), from: z.string(), to: z.string() }),
);
export const MailSentEvent = base(
  "mail.sent",
  z.object({ queue_id: z.string(), from: z.string(), to: z.string() }),
);
export const MailDeferredEvent = base(
  "mail.deferred",
  z.object({ queue_id: z.string(), reason: z.string() }),
);
export const MailBouncedEvent = base(
  "mail.bounced",
  z.object({ queue_id: z.string(), dsn: z.string(), reason: z.string() }),
);
export const SecurityIpBlockedEvent = base(
  "security.ip.blocked",
  z.object({ ip: z.string(), reason: z.string(), source: z.string() }),
);
export const QueueSnapshotEvent = base(
  "queue.snapshot",
  z.object({
    active: z.number().int(),
    deferred: z.number().int(),
    hold: z.number().int(),
    oldest_age_s: z.number().int(),
  }),
);
export const BackupStartedEvent = base(
  "backup.started",
  z.object({ id: Uuid, kind: z.string(), destination: z.string() }),
);
export const BackupCompletedEvent = base(
  "backup.completed",
  z.object({
    id: Uuid,
    kind: z.string(),
    size_bytes: z.number().int(),
    duration_s: z.number(),
  }),
);
export const NotificationCreatedEvent = base(
  "notification.created",
  z.object({ user_id: Uuid, kind: z.string(), title: z.string() }),
);

export const Event = z.discriminatedUnion("type", [
  AuthLoginEvent,
  AuthLogoutEvent,
  OrgMemberAddedEvent,
  DomainCreatedEvent,
  DomainVerifiedEvent,
  DomainDnsSyncedEvent,
  DkimGeneratedEvent,
  DkimActivatedEvent,
  MailboxCreatedEvent,
  MailboxUpdatedEvent,
  MailboxDeletedEvent,
  AliasCreatedEvent,
  MailReceivedEvent,
  MailSentEvent,
  MailDeferredEvent,
  MailBouncedEvent,
  SecurityIpBlockedEvent,
  QueueSnapshotEvent,
  BackupStartedEvent,
  BackupCompletedEvent,
  NotificationCreatedEvent,
]);
export type Event = z.infer<typeof Event>;

export const WsMessage = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("hello"),
    session_id: z.string(),
    server_time: IsoDate,
  }),
  z.object({ op: z.literal("subscribe"), topic: z.string() }),
  z.object({ op: z.literal("unsubscribe"), topic: z.string() }),
  z.object({ op: z.literal("ping"), at: z.number().int() }),
  z.object({ op: z.literal("pong"), at: z.number().int() }),
  z.object({
    op: z.literal("event"),
    topic: z.string(),
    event: Event,
  }),
  z.object({ op: z.literal("backoff"), seconds: z.number().int() }),
  z.object({
    op: z.literal("error"),
    problem: z.object({
      title: z.string(),
      status: z.number().int(),
      detail: z.string().optional(),
    }),
  }),
]);
export type WsMessage = z.infer<typeof WsMessage>;
