import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const VirusStatus = z.enum(["pending", "clean", "infected", "error"]);
export type VirusStatus = z.infer<typeof VirusStatus>;

export const PreviewState = z.enum(["none", "pending", "ready", "failed"]);
export type PreviewState = z.infer<typeof PreviewState>;

export const Attachment = z.object({
  id: Uuid,
  filename: z.string(),
  mime: z.string(),
  size_bytes: z.number().int(),
  content_hash: z.string(),
  virus_status: VirusStatus,
  preview_state: PreviewState,
  created_at: IsoDate,
});
export type Attachment = z.infer<typeof Attachment>;

// tus.io Creation-With-Upload compatible request shape (subset).
export const CreateUploadRequest = z.object({
  filename: z.string().max(500),
  mime: z.string().max(200),
  size_bytes: z.number().int().min(1).max(2 * 1024 * 1024 * 1024),
});
export type CreateUploadRequest = z.infer<typeof CreateUploadRequest>;

export const Upload = z.object({
  id: Uuid,
  filename: z.string(),
  mime: z.string(),
  size_bytes: z.number().int(),
  uploaded_bytes: z.number().int(),
  offset_bytes: z.number().int(),
  expires_at: IsoDate,
  created_at: IsoDate,
});
export type Upload = z.infer<typeof Upload>;

export const FinaliseUploadRequest = z.object({
  attach_to: z
    .object({
      kind: z.enum(["draft", "message", "signature", "theme"]),
      id: Uuid,
    })
    .optional(),
});
export type FinaliseUploadRequest = z.infer<typeof FinaliseUploadRequest>;
