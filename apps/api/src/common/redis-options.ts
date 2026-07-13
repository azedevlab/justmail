/**
 * Pure Redis/Valkey connection planning, split out so the topology logic
 * (standalone vs Sentinel vs Cluster, TLS, auth) is unit-testable without
 * instantiating ioredis. The module factory turns a plan into a client.
 */

export interface RedisConfigInput {
  REDIS_URL?: string;
  REDIS_SENTINELS?: string;
  REDIS_SENTINEL_NAME?: string;
  REDIS_CLUSTER_NODES?: string;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS: boolean;
  REDIS_TLS_REJECT_UNAUTHORIZED: boolean;
  REDIS_MAX_RETRIES_PER_REQUEST: number;
}

export interface RedisNode {
  host: string;
  port: number;
}

export type RedisPlan =
  | { kind: "none" }
  | { kind: "standalone"; url: string; options: Record<string, unknown> }
  | { kind: "sentinel"; sentinels: RedisNode[]; name: string; options: Record<string, unknown> }
  | { kind: "cluster"; nodes: RedisNode[]; options: Record<string, unknown> };

/** Parse "host:port,host2:6380" into nodes; port defaults to 6379. */
export function parseNodes(list: string): RedisNode[] {
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.lastIndexOf(":");
      if (idx === -1) return { host: entry, port: 6379 };
      const host = entry.slice(0, idx);
      const port = Number(entry.slice(idx + 1));
      return { host, port: Number.isFinite(port) ? port : 6379 };
    });
}

function commonOptions(c: RedisConfigInput): Record<string, unknown> {
  const options: Record<string, unknown> = {
    maxRetriesPerRequest: c.REDIS_MAX_RETRIES_PER_REQUEST,
    enableReadyCheck: true,
  };
  if (c.REDIS_USERNAME) options.username = c.REDIS_USERNAME;
  if (c.REDIS_PASSWORD) options.password = c.REDIS_PASSWORD;
  if (c.REDIS_TLS) {
    options.tls = { rejectUnauthorized: c.REDIS_TLS_REJECT_UNAUTHORIZED };
  }
  return options;
}

export function planRedis(c: RedisConfigInput): RedisPlan {
  const options = commonOptions(c);
  // HA topologies win over a plain URL so an operator can flip to Sentinel/Cluster
  // without unsetting REDIS_URL.
  if (c.REDIS_CLUSTER_NODES) {
    return { kind: "cluster", nodes: parseNodes(c.REDIS_CLUSTER_NODES), options };
  }
  if (c.REDIS_SENTINELS && c.REDIS_SENTINEL_NAME) {
    return {
      kind: "sentinel",
      sentinels: parseNodes(c.REDIS_SENTINELS),
      name: c.REDIS_SENTINEL_NAME,
      options,
    };
  }
  if (c.REDIS_URL) {
    return { kind: "standalone", url: c.REDIS_URL, options };
  }
  return { kind: "none" };
}
