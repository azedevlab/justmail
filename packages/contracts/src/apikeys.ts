import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

// Canonical API-key scopes, ordered by privilege. `read` maps to viewer-level
// access, `write` to member-level, `admin` to admin-level. A key is capped at
// the highest role its scopes grant; an unscoped key ([]) means full access.
export const ApiKeyScope = z.enum(["read", "write", "admin"]);
export type ApiKeyScope = z.infer<typeof ApiKeyScope>;

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
  scopes: z.array(ApiKeyScope).max(64).default([]),
  expires_at: IsoDate.nullable().optional(),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequest>;

export const CreatedApiKey = ApiKey.extend({
  token: z.string(),
});
export type CreatedApiKey = z.infer<typeof CreatedApiKey>;
