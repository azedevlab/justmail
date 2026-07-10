import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const Notification = z.object({
  id: Uuid,
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  read_at: IsoDate.nullable(),
  created_at: IsoDate,
});
export type Notification = z.infer<typeof Notification>;

export const WebPushSubscription = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  user_agent: z.string().optional(),
});
export type WebPushSubscription = z.infer<typeof WebPushSubscription>;
