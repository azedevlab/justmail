import { z } from "zod";
import { Email, IsoDate, Uuid } from "./primitives.js";

export const Folder = z.object({
  path: z.string(),
  name: z.string(),
  special_use: z.string().nullable(),
  unread: z.number().int(),
  total: z.number().int(),
});
export type Folder = z.infer<typeof Folder>;

export const Envelope = z.object({
  from: z
    .array(z.object({ address: z.string(), name: z.string().optional() }))
    .optional(),
  to: z
    .array(z.object({ address: z.string(), name: z.string().optional() }))
    .optional(),
  cc: z
    .array(z.object({ address: z.string(), name: z.string().optional() }))
    .optional(),
  subject: z.string().optional(),
  date: IsoDate.optional(),
  message_id: z.string().optional(),
  in_reply_to: z.string().optional(),
});
export type Envelope = z.infer<typeof Envelope>;

export const MessageSummary = z.object({
  uid: z.number().int(),
  seq: z.number().int(),
  flags: z.array(z.string()),
  envelope: Envelope,
  size: z.number().int(),
  date: IsoDate.nullable(),
  preview: z.string().optional(),
  has_attachments: z.boolean(),
  thread_id: z.string().nullable(),
});
export type MessageSummary = z.infer<typeof MessageSummary>;

// modseq/uidvalidity are IMAP 64-bit counters; carried as decimal strings
// because JSON has no bigint. Null when the server lacks CONDSTORE.
export const MessageList = z.object({
  messages: z.array(MessageSummary),
  total: z.number().int(),
  uid_validity: z.string().nullable(),
  mod_seq: z.string().nullable(),
});
export type MessageList = z.infer<typeof MessageList>;

export const MessageSync = z.object({
  uid_validity: z.string().nullable(),
  mod_seq: z.string().nullable(),
  // uid_validity changed under the client: its cache is void, reload in full.
  stale: z.boolean(),
  changed: z.array(
    z.object({ uid: z.number().int(), flags: z.array(z.string()) }),
  ),
});
export type MessageSync = z.infer<typeof MessageSync>;

export const Message = z.object({
  uid: z.number().int(),
  message_id: z.string().nullable(),
  subject: z.string(),
  from: z.string(),
  to: z.string(),
  cc: z.string(),
  date: IsoDate.nullable(),
  text: z.string(),
  html: z.string().nullable(),
  attachments: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      size: z.number().int(),
      mime: z.string(),
      inline: z.boolean(),
    }),
  ),
  headers: z.record(z.string()),
});
export type Message = z.infer<typeof Message>;

export const ComposeRequest = z.object({
  to: z.array(Email).min(1),
  cc: z.array(Email).optional(),
  bcc: z.array(Email).optional(),
  subject: z.string().max(998).default(""),
  text: z.string().max(1_000_000).default(""),
  html: z.string().max(1_000_000).optional(),
  attachment_ids: z.array(Uuid).max(64).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mime: z.string().max(255).default("application/octet-stream"),
        content_base64: z.string().max(20_000_000),
      }),
    )
    .max(16)
    .optional(),
  in_reply_to: z.string().optional(),
  references: z.array(z.string()).optional(),
  send_at: IsoDate.optional(),
});
export type ComposeRequest = z.infer<typeof ComposeRequest>;

export const Draft = z.object({
  id: Uuid,
  subject: z.string(),
  to: z.array(Email),
  cc: z.array(Email),
  bcc: z.array(Email),
  text: z.string(),
  html: z.string().nullable(),
  updated_at: IsoDate,
});
export type Draft = z.infer<typeof Draft>;

export const FlagAction = z.enum([
  "read",
  "unread",
  "star",
  "unstar",
  "spam",
  "not_spam",
  "important",
  "not_important",
]);
export type FlagAction = z.infer<typeof FlagAction>;

export const SnoozeRequest = z.object({
  until: IsoDate,
});
export type SnoozeRequest = z.infer<typeof SnoozeRequest>;

export const SearchQuery = z.object({
  q: z.string().min(1).max(500),
  folder: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  has_attachment: z.boolean().optional(),
  after: IsoDate.optional(),
  before: IsoDate.optional(),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const Signature = z.object({
  id: Uuid,
  name: z.string(),
  html: z.string(),
  text: z.string(),
  is_default: z.boolean(),
});
export type Signature = z.infer<typeof Signature>;

export const Template = z.object({
  id: Uuid,
  name: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});
export type Template = z.infer<typeof Template>;

export const SieveRule = z.object({
  id: Uuid,
  name: z.string(),
  priority: z.number().int(),
  script_source: z.string(),
  enabled: z.boolean(),
});
export type SieveRule = z.infer<typeof SieveRule>;
