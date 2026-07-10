import { z } from "zod";

export const DashboardOverview = z.object({
  domains: z.object({ total: z.number(), active: z.number() }),
  mailboxes: z.object({
    total: z.number(),
    active: z.number(),
    suspended: z.number(),
  }),
  quota: z.object({
    used_bytes: z.number(),
    allocated_mb: z.number(),
  }),
  events_24h: z.object({
    inbound: z.number(),
    outbound: z.number(),
    rejected: z.number(),
    deferred: z.number(),
  }),
  queue: z.object({
    active: z.number(),
    deferred: z.number(),
    hold: z.number(),
    oldest_age_s: z.number(),
  }),
});
export type DashboardOverview = z.infer<typeof DashboardOverview>;
