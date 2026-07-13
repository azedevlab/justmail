import { describe, expect, it } from "vitest";
import { parseNodes, planRedis, type RedisConfigInput } from "./redis-options";

const base: RedisConfigInput = {
  REDIS_TLS: false,
  REDIS_TLS_REJECT_UNAUTHORIZED: true,
  REDIS_MAX_RETRIES_PER_REQUEST: 2,
};

describe("parseNodes", () => {
  it("parses host:port pairs and defaults the port", () => {
    expect(parseNodes("a:6379, b:6380 ,c")).toEqual([
      { host: "a", port: 6379 },
      { host: "b", port: 6380 },
      { host: "c", port: 6379 },
    ]);
  });
});

describe("planRedis", () => {
  it("returns none when nothing is configured", () => {
    expect(planRedis(base)).toEqual({ kind: "none" });
  });

  it("uses standalone when only REDIS_URL is set", () => {
    const plan = planRedis({ ...base, REDIS_URL: "redis://localhost:6379" });
    expect(plan.kind).toBe("standalone");
  });

  it("prefers sentinel over a plain URL", () => {
    const plan = planRedis({
      ...base,
      REDIS_URL: "redis://localhost:6379",
      REDIS_SENTINELS: "s1:26379,s2:26379",
      REDIS_SENTINEL_NAME: "mymaster",
    });
    expect(plan).toMatchObject({
      kind: "sentinel",
      name: "mymaster",
      sentinels: [
        { host: "s1", port: 26379 },
        { host: "s2", port: 26379 },
      ],
    });
  });

  it("prefers cluster over everything else", () => {
    const plan = planRedis({
      ...base,
      REDIS_URL: "redis://localhost:6379",
      REDIS_CLUSTER_NODES: "n1:7000,n2:7001",
    });
    expect(plan.kind).toBe("cluster");
  });

  it("threads auth + TLS into options", () => {
    const plan = planRedis({
      ...base,
      REDIS_URL: "redis://localhost:6379",
      REDIS_USERNAME: "u",
      REDIS_PASSWORD: "p",
      REDIS_TLS: true,
      REDIS_TLS_REJECT_UNAUTHORIZED: false,
    });
    expect(plan.kind === "standalone" && plan.options).toMatchObject({
      username: "u",
      password: "p",
      tls: { rejectUnauthorized: false },
    });
  });
});
