import { SetMetadata } from "@nestjs/common";

export interface ThrottleOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  ttl: number;
}

export const THROTTLE_KEY = "throttle:options";
export const THROTTLE_SKIP = "throttle:skip";

/** Override the global rate limit for a single route (or controller). */
export const Throttle = (opts: ThrottleOptions) =>
  SetMetadata(THROTTLE_KEY, opts);

/** Exempt a route (or controller) from rate limiting entirely. */
export const SkipThrottle = () => SetMetadata(THROTTLE_SKIP, true);
