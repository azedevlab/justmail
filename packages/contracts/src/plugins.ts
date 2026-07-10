import { z } from "zod";
import { IsoDate, Slug, Uuid } from "./primitives.js";

export const PluginSlot = z.enum([
  "admin:sidebar",
  "admin:dashboard-tile",
  "admin:mailbox-detail",
  "webmail:toolbar",
  "webmail:message-actions",
  "webmail:composer-toolbar",
  "mail:pre-queue",
  "mail:post-delivery",
  "auth:provider",
  "storage:adapter",
  "notifications:channel",
]);
export type PluginSlot = z.infer<typeof PluginSlot>;

export const PluginPermission = z.enum([
  "domains:read",
  "domains:write",
  "mailboxes:read",
  "mailboxes:write",
  "aliases:read",
  "aliases:write",
  "webhooks:emit",
  "storage:read",
  "storage:write",
  "audit:write",
  "settings:read",
  "settings:write",
  "notifications:send",
]);
export type PluginPermission = z.infer<typeof PluginPermission>;

export const PluginManifest = z.object({
  name: Slug,
  version: z.string(),
  description: z.string().max(500),
  homepage: z.string().url().optional(),
  license: z.string(),
  publisher: z.string(),
  signature: z.string(),
  server_entry: z.string().optional(),
  client_entry: z.string().optional(),
  slots: z.array(PluginSlot).max(20),
  permissions: z.array(PluginPermission).max(20),
});
export type PluginManifest = z.infer<typeof PluginManifest>;

export const Plugin = z.object({
  id: Uuid,
  name: Slug,
  version: z.string(),
  publisher: z.string(),
  manifest: PluginManifest,
  installed_at: IsoDate,
  disabled_at: IsoDate.nullable(),
});
export type Plugin = z.infer<typeof Plugin>;

export const PluginInstall = z.object({
  id: Uuid,
  plugin_id: Uuid,
  config: z.record(z.unknown()),
  enabled: z.boolean(),
  updated_at: IsoDate,
});
export type PluginInstall = z.infer<typeof PluginInstall>;
