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

// Result of a send: the message is not dispatched immediately but held as a
// scheduled_send row. `id` lets the client cancel it during the undo window;
// `scheduled` is true when the user picked a future send_at (vs. the undo delay).
export const SendResult = z.object({
  id: Uuid,
  send_at: IsoDate,
  scheduled: z.boolean(),
});
export type SendResult = z.infer<typeof SendResult>;

// An outstanding deferred send (undo window or future schedule) awaiting dispatch.
export const ScheduledSend = z.object({
  id: Uuid,
  to: z.array(z.string()),
  subject: z.string(),
  send_at: IsoDate,
  created_at: IsoDate,
});
export type ScheduledSend = z.infer<typeof ScheduledSend>;

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

// A draft is saved to the IMAP \Drafts folder, so recipients may be partial or
// empty while composing — unlike ComposeRequest, addresses are not validated.
export const SaveDraftRequest = z.object({
  to: z.array(z.string().max(320)).max(64).default([]),
  cc: z.array(z.string().max(320)).max(64).default([]),
  bcc: z.array(z.string().max(320)).max(64).default([]),
  subject: z.string().max(998).default(""),
  text: z.string().max(1_000_000).default(""),
  html: z.string().max(1_000_000).optional(),
  in_reply_to: z.string().optional(),
  references: z.array(z.string()).optional(),
  // UID of the previous autosave to replace (delete after the new append).
  replace_uid: z.number().int().positive().optional(),
});
export type SaveDraftRequest = z.infer<typeof SaveDraftRequest>;

export const SavedDraft = z.object({
  uid: z.number().int().nullable(),
  folder: z.string(),
});
export type SavedDraft = z.infer<typeof SavedDraft>;

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

// html is sanitized server-side on save; the client sends author HTML as-is.
export const SignatureRequest = z.object({
  name: z.string().min(1).max(120),
  html: z.string().max(100_000).default(""),
  text: z.string().max(50_000).default(""),
  is_default: z.boolean().default(false),
});
export type SignatureRequest = z.infer<typeof SignatureRequest>;

export const Template = z.object({
  id: Uuid,
  name: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});
export type Template = z.infer<typeof Template>;

export const TemplateRequest = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().max(998).default(""),
  html: z.string().max(100_000).default(""),
  text: z.string().max(50_000).default(""),
});
export type TemplateRequest = z.infer<typeof TemplateRequest>;

export const SieveRule = z.object({
  id: Uuid,
  name: z.string(),
  priority: z.number().int(),
  script_source: z.string(),
  enabled: z.boolean(),
});
export type SieveRule = z.infer<typeof SieveRule>;
