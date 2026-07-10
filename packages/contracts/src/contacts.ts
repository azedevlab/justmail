import { z } from "zod";
import { Email } from "./primitives.js";

// A single labelled address/number on a contact. `label` mirrors the vCard TYPE
// parameter (home/work/…) and is free-form since clients emit arbitrary values.
export const ContactEmail = z.object({
  address: Email,
  label: z.string().max(40).optional(),
});
export type ContactEmail = z.infer<typeof ContactEmail>;

export const ContactPhone = z.object({
  number: z.string().min(1).max(64),
  label: z.string().max(40).optional(),
});
export type ContactPhone = z.infer<typeof ContactPhone>;

// A contact stored as a vCard in the mailbox's CardDAV address book. `id` is the
// vCard UID; `href` is its DAV path, used for update/delete.
export const Contact = z.object({
  id: z.string(),
  href: z.string(),
  full_name: z.string(),
  emails: z.array(ContactEmail),
  phones: z.array(ContactPhone),
  organization: z.string().nullable(),
  note: z.string().nullable(),
});
export type Contact = z.infer<typeof Contact>;

export const ContactRequest = z.object({
  full_name: z.string().min(1).max(320),
  emails: z.array(ContactEmail).max(32).default([]),
  phones: z.array(ContactPhone).max(32).default([]),
  organization: z.string().max(320).optional(),
  note: z.string().max(4000).optional(),
});
export type ContactRequest = z.infer<typeof ContactRequest>;
