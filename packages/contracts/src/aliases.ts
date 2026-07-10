import { z } from "zod";
import { Email, IsoDate, LocalPart, Uuid } from "./primitives.js";

export const Alias = z.object({
  id: Uuid,
  domain_id: Uuid,
  domain_name: z.string(),
  source: z.string(),
  address: z.string(),
  destinations: z.array(Email),
  enabled: z.boolean(),
  created_at: IsoDate,
});
export type Alias = z.infer<typeof Alias>;

export const CreateAliasRequest = z.object({
  source: LocalPart,
  destinations: z.array(Email).min(1).max(20),
  enabled: z.boolean().optional(),
});
export type CreateAliasRequest = z.infer<typeof CreateAliasRequest>;

export const UpdateAliasRequest = z.object({
  destinations: z.array(Email).min(1).max(20).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateAliasRequest = z.infer<typeof UpdateAliasRequest>;
