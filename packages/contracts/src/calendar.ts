import { z } from "zod";
import { IsoDate } from "./primitives.js";

// A calendar event stored as a VEVENT in the mailbox's CalDAV calendar. `id`
// is the iCalendar UID; `href` is its DAV path, used for update/delete.
// Timestamps are ISO-8601 UTC instants; for `all_day` events the time-of-day
// component is ignored by clients and only the date is significant.
export const CalendarEvent = z.object({
  id: z.string(),
  href: z.string(),
  summary: z.string(),
  starts_at: IsoDate,
  ends_at: IsoDate,
  all_day: z.boolean(),
  location: z.string().nullable(),
  description: z.string().nullable(),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

export const CalendarEventRequest = z
  .object({
    summary: z.string().min(1).max(320),
    starts_at: IsoDate,
    ends_at: IsoDate,
    all_day: z.boolean().default(false),
    location: z.string().max(320).optional(),
    description: z.string().max(4000).optional(),
  })
  .refine((v) => new Date(v.ends_at) >= new Date(v.starts_at), {
    message: "ends_at must be at or after starts_at",
    path: ["ends_at"],
  });
export type CalendarEventRequest = z.infer<typeof CalendarEventRequest>;
