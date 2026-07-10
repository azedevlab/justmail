import type {
  PluginManifest,
  PluginPermission,
  PluginSlot,
} from "@justmail/contracts";

export type { PluginManifest, PluginPermission, PluginSlot };

/**
 * Host — what the plugin sees from the runtime. The API server implements
 * this and injects it into the plugin's server bundle via a typed proxy.
 * Only listed operations are available; anything else throws
 * PermissionDenied at runtime.
 */
export interface PluginHost {
  readonly orgId: string;
  readonly pluginId: string;

  storage: {
    put(key: string, body: Buffer, contentType?: string): Promise<string>;
    get(key: string): Promise<Buffer | null>;
    sign(key: string, ttlSec?: number): Promise<string>;
  };

  db: {
    // Restricted, read-only view of tenant data. Adapters expose only tables
    // the plugin has permission for.
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  };

  emitEvent(type: string, data: Record<string, unknown>): Promise<void>;
  notify(kind: string, title: string, body: string): Promise<void>;
  audit(action: string, meta?: Record<string, unknown>): Promise<void>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  log: {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
}

/** Server plugin default export shape. */
export interface ServerPlugin {
  manifest: PluginManifest;
  init(host: PluginHost): Promise<void> | void;
  hooks?: {
    onMailboxCreated?(
      host: PluginHost,
      event: { id: string; address: string },
    ): Promise<void>;
    onMailReceived?(
      host: PluginHost,
      event: { queue_id: string; from: string; to: string },
    ): Promise<void>;
    onMailSent?(
      host: PluginHost,
      event: { queue_id: string; from: string; to: string },
    ): Promise<void>;
    onDomainVerified?(
      host: PluginHost,
      event: { id: string; name: string },
    ): Promise<void>;
    // pre-queue lets plugins tag or reject inbound mail before it lands
    onMailPreQueue?(
      host: PluginHost,
      msg: {
        from: string;
        to: string[];
        subject: string;
        raw: Buffer;
      },
    ): Promise<
      | { action: "accept" }
      | { action: "reject"; code: number; text: string }
      | { action: "quarantine"; reason: string }
    >;
  };
}

/** Slot descriptor consumed by client-side mount points. */
export interface ClientSlot {
  slot: PluginSlot;
  render: (props: Record<string, unknown>) => unknown;
}

/** Client plugin default export shape. */
export interface ClientPlugin {
  manifest: PluginManifest;
  slots: ClientSlot[];
}

/** Utility for author-time typing. */
export function definePlugin<T extends ServerPlugin | ClientPlugin>(p: T): T {
  return p;
}

export class PermissionDenied extends Error {
  constructor(public readonly required: PluginPermission) {
    super(`plugin lacks permission: ${required}`);
    this.name = "PermissionDenied";
  }
}
