import { Global, Logger, Module } from "@nestjs/common";
import Redis, { Cluster } from "ioredis";
import { config } from "../config";
import { planRedis } from "./redis-options";

/** Injection token for the shared Redis client. Resolves to `null` when no
 *  Redis is configured so the API still boots in dev without Redis. */
export const REDIS = Symbol("REDIS");

export type RedisClient = Redis | Cluster | null;

const logger = new Logger("redis");

function createClient(): RedisClient {
  const plan = planRedis(config);
  let client: Redis | Cluster;
  switch (plan.kind) {
    case "none":
      logger.warn(
        "no Redis configured — Redis-backed features degrade to in-process fallback",
      );
      return null;
    case "cluster":
      client = new Cluster(plan.nodes, { redisOptions: plan.options });
      break;
    case "sentinel":
      client = new Redis({ sentinels: plan.sentinels, name: plan.name, ...plan.options });
      break;
    case "standalone":
      client = new Redis(plan.url, plan.options);
      break;
  }
  client.on("error", (err) => logger.error(`redis error: ${err.message}`));
  return client;
}

@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: createClient }],
  exports: [REDIS],
})
export class RedisModule {}
