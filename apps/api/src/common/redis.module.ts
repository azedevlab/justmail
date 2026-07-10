import { Global, Logger, Module } from "@nestjs/common";
import Redis from "ioredis";
import { config } from "../config";

/** Injection token for the shared Redis client. Resolves to `null` when
 *  REDIS_URL is unset so the API still boots in dev without Redis. */
export const REDIS = Symbol("REDIS");

export type RedisClient = Redis | null;

const logger = new Logger("redis");

function createClient(): RedisClient {
  if (!config.REDIS_URL) {
    logger.warn(
      "REDIS_URL not set — Redis-backed features degrade to in-process fallback",
    );
    return null;
  }
  const client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });
  client.on("error", (err) => logger.error(`redis error: ${err.message}`));
  return client;
}

@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: createClient }],
  exports: [REDIS],
})
export class RedisModule {}
