import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const ApiKey = z.object({
  id: Uuid,
  name: z.string(),
  key_prefix: z.string(),
  scopes: z.array(z.string()),
  last_used_at: IsoDate.nullable(),
  expires_at: IsoDate.nullable(),
  created_at: IsoDate,
  revoked_at: IsoDate.nullable(),
});
export type ApiKey = z.infer<typeof ApiKey>;

export const CreateApiKeyRequest = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.string().min(1).max(100)).max(64).default([]),
  expires_at: IsoDate.nullable().optional(),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequest>;

export const CreatedApiKey = ApiKey.extend({
  token: z.string(),
});
export type CreatedApiKey = z.infer<typeof CreatedApiKey>;
