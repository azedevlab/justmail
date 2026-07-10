import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const WebhookEndpoint = z.object({
  id: Uuid,
  url: z.string().url(),
  events: z.array(z.string()),
  active: z.boolean(),
  last_delivered_at: IsoDate.nullable(),
  last_status: z.number().int().nullable(),
  failure_count: z.number().int(),
  created_at: IsoDate,
});
export type WebhookEndpoint = z.infer<typeof WebhookEndpoint>;

export const CreateWebhookRequest = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1).max(100)).min(1).max(64),
});
export type CreateWebhookRequest = z.infer<typeof CreateWebhookRequest>;

export const CreatedWebhook = WebhookEndpoint.extend({
  secret: z.string(),
});
export type CreatedWebhook = z.infer<typeof CreatedWebhook>;

export const WebhookDelivery = z.object({
  id: Uuid,
  event: z.string(),
  status: z.number().int().nullable(),
  attempts: z.number().int(),
  next_attempt_at: IsoDate.nullable(),
  delivered_at: IsoDate.nullable(),
  last_error: z.string().nullable(),
  created_at: IsoDate,
});
export type WebhookDelivery = z.infer<typeof WebhookDelivery>;
