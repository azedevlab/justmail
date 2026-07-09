/**
 * Fetch wrapper for the JustMail API. Cookies carry the session — always
 * `credentials: "include"` so the CORS-signed jm_session cookie is sent.
 */
import type { Problem } from "@justmail/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.justmail.example.com";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: Problem,
  ) {
    super(problem.title || `HTTP ${status}`);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get("content-type")?.includes("json") ?? false;
  if (!res.ok) {
    const problem = isJson
      ? ((await res.json()) as Problem)
      : ({ type: "about:blank", title: res.statusText, status: res.status } as Problem);
    throw new ApiError(res.status, problem);
  }
  return (isJson ? await res.json() : ((await res.text()) as unknown)) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
