import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { config } from "../config";
import { REDIS, type RedisClient } from "./redis.module";
import {
  THROTTLE_KEY,
  THROTTLE_SKIP,
  type ThrottleOptions,
} from "./throttle.decorator";

interface Bucket {
  count: number;
  resetAt: number;
}

/** Fixed-window rate limiter. Uses Redis INCR/EXPIRE when available so limits
 *  are shared across API replicas; falls back to an in-process Map otherwise.
 *  Routes bucket against the global window by default; `@Throttle()` gives a
 *  route its own stricter window, and `@SkipThrottle()` exempts it. */
@Injectable()
export class ThrottlerGuard implements CanActivate {
  private readonly memory = new Map<string, Bucket>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;

    const skip = this.reflector.getAllAndOverride<boolean>(THROTTLE_SKIP, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const override = this.reflector.getAllAndOverride<ThrottleOptions>(
      THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const limit = override?.limit ?? config.RATE_LIMIT_GLOBAL_MAX;
    const ttl = override?.ttl ?? config.RATE_LIMIT_GLOBAL_TTL;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const bucketId = override
      ? `${context.getClass().name}.${context.getHandler().name}`
      : "global";
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `throttle:${bucketId}:${ip}`;

    const { count, ttlRemaining } = await this.hit(key, ttl);

    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - count)));

    if (count > limit) {
      res.setHeader("Retry-After", String(ttlRemaining));
      throw new HttpException(
        {
          type: "about:blank",
          title: "Too Many Requests",
          status: HttpStatus.TOO_MANY_REQUESTS,
          detail: "Rate limit exceeded. Please slow down and try again.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private async hit(
    key: string,
    ttl: number,
  ): Promise<{ count: number; ttlRemaining: number }> {
    if (this.redis) {
      try {
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, ttl);
          return { count, ttlRemaining: ttl };
        }
        const remaining = await this.redis.ttl(key);
        return { count, ttlRemaining: remaining > 0 ? remaining : ttl };
      } catch {
        // Redis unavailable mid-flight: fall through to in-process counting
        // rather than failing open on a security control.
      }
    }
    return this.hitMemory(key, ttl);
  }

  private hitMemory(
    key: string,
    ttl: number,
  ): { count: number; ttlRemaining: number } {
    const now = Date.now();
    const existing = this.memory.get(key);
    if (!existing || existing.resetAt <= now) {
      this.memory.set(key, { count: 1, resetAt: now + ttl * 1000 });
      if (this.memory.size > 50_000) this.sweep(now);
      return { count: 1, ttlRemaining: ttl };
    }
    existing.count += 1;
    return {
      count: existing.count,
      ttlRemaining: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  private sweep(now: number): void {
    for (const [k, b] of this.memory) {
      if (b.resetAt <= now) this.memory.delete(k);
    }
  }
}
