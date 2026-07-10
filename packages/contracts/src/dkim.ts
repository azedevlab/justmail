import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const DkimAlgorithm = z.enum(["rsa2048", "ed25519"]);
export type DkimAlgorithm = z.infer<typeof DkimAlgorithm>;

export const DkimStatus = z.enum(["pending", "published", "active", "retired"]);
export type DkimStatus = z.infer<typeof DkimStatus>;

export const DkimKey = z.object({
  id: Uuid,
  domain_id: Uuid,
  domain_name: z.string(),
  selector: z.string(),
  algorithm: DkimAlgorithm,
  public_key: z.string(),
  status: DkimStatus,
  created_at: IsoDate,
  activated_at: IsoDate.nullable(),
  retired_at: IsoDate.nullable(),
});
export type DkimKey = z.infer<typeof DkimKey>;

export const CreateDkimKeyRequest = z.object({
  algorithm: DkimAlgorithm.default("rsa2048"),
});
export type CreateDkimKeyRequest = z.infer<typeof CreateDkimKeyRequest>;
