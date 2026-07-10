import type { Problem } from "@justmail/contracts";

/**
 * Typed fetch wrapper used by every JustMail web app. Handles:
 *  - session cookies (credentials: "include")
 *  - RFC 9457 problem+json errors
 *  - Idempotency-Key propagation on mutations
 *  - RateLimit headers surfaced to the caller
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: Problem,
    public readonly response: Response,
  ) {
    super(problem.title || `HTTP ${status}`);
  }
}

export interface ClientOptions {
  base: string;
  onAuthError?: (err: ApiError) => void;
  onRateLimit?: (retryAfterMs: number) => void;
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  idempotencyKey?: string;
}

export class ApiClient {
  constructor(private readonly options: ClientOptions) {}

  async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = `${this.options.base}${path}`;
    const headers: Record<string, string> = {
      accept: "application/json",
      ...(this.options.defaultHeaders ?? {}),
      ...((options.headers as Record<string, string>) ?? {}),
    };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (options.idempotencyKey)
      headers["idempotency-key"] = options.idempotencyKey;

    const res = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      this.options.onRateLimit?.(retryAfter * 1000);
    }
    if (res.status === 204) return undefined as T;

    const isJson = res.headers.get("content-type")?.includes("json") ?? false;
    if (!res.ok) {
      const problem = isJson
        ? ((await res.json()) as Problem)
        : ({
            type: "about:blank",
            title: res.statusText,
            status: res.status,
          } as Problem);
      const err = new ApiError(res.status, problem, res);
      if (res.status === 401 || res.status === 403) {
        this.options.onAuthError?.(err);
      }
      throw err;
    }
    return (isJson ? await res.json() : await res.text()) as T;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, options);
  }
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("POST", path, { ...options, body });
  }
  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("PUT", path, { ...options, body });
  }
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("PATCH", path, { ...options, body });
  }
  del<T>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, options);
  }
}

export function createClient(base: string, options: Partial<ClientOptions> = {}) {
  return new ApiClient({ base, ...options });
}
