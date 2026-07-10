import { z } from "zod";
import { IsoDate } from "./primitives.js";

export const SettingRow = z.object({
  key: z.string(),
  value: z.unknown(),
  updated_at: IsoDate,
});
export type SettingRow = z.infer<typeof SettingRow>;

export const UpsertSettingRequest = z.object({
  value: z.unknown(),
});
export type UpsertSettingRequest = z.infer<typeof UpsertSettingRequest>;
