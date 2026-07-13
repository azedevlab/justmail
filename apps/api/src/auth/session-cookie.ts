import type { Request, Response } from "express";
import { config } from "../config";

/**
 * Per-app session cookies. The admin console and webmail are separate surfaces
 * on separate subdomains but talk to the same API subdomain, so both cookies
 * are scoped to the parent domain (JM_WEB_HOST) to reach the API — yet they use
 * distinct NAMES so logging into one app never overwrites the other's session.
 * The API selects which cookie a request belongs to from the X-JM-App header
 * (set by each frontend's api client) or, for redirect flows, the target host.
 *
 * `jm_session` is the legacy single shared cookie; it is cleared on every login
 * so a pre-isolation cookie can't shadow the new per-app one.
 */
export const ADMIN_SESSION_COOKIE = "jm_admin_session";
export const WEBMAIL_SESSION_COOKIE = "jm_webmail_session";
export const LEGACY_SESSION_COOKIE = "jm_session";

export type AppSurface = "admin" | "webmail";

export function cookieName(app: AppSurface): string {
  return app === "webmail" ? WEBMAIL_SESSION_COOKIE : ADMIN_SESSION_COOKIE;
}

function appFromHost(host: string | undefined): AppSurface {
  if (host && config.JM_WEBMAIL_HOST && host === config.JM_WEBMAIL_HOST) {
    return "webmail";
  }
  return "admin";
}

/** Resolve the app surface from a redirect target / relay URL (SSO). */
export function appFromUrl(url: string | undefined): AppSurface {
  try {
    return appFromHost(new URL(url ?? "").hostname);
  } catch {
    return "admin";
  }
}

/**
 * Resolve the app surface for a browser XHR: the explicit X-JM-App header wins,
 * falling back to the request Origin/Referer host. Defaults to admin so any
 * unlabelled caller lands on the console cookie rather than leaking into webmail.
 */
export function appFromRequest(req: Request): AppSurface {
  const header = String(req.headers["x-jm-app"] ?? "").toLowerCase();
  if (header === "webmail") return "webmail";
  if (header === "admin") return "admin";
  const origin =
    (req.headers.origin as string | undefined) ??
    (req.headers.referer as string | undefined) ??
    "";
  try {
    return appFromHost(new URL(origin).hostname);
  } catch {
    return "admin";
  }
}

function cookieDomain(): string | undefined {
  return config.NODE_ENV === "production" ? config.JM_WEB_HOST : undefined;
}

export function setSessionCookie(
  res: Response,
  app: AppSurface,
  token: string,
  expiresAt: Date,
): void {
  const domain = cookieDomain();
  // Drop the legacy shared cookie at both scopes so it can't keep the two apps
  // entangled after they migrate to per-app cookies.
  if (domain) res.clearCookie(LEGACY_SESSION_COOKIE, { path: "/", domain });
  res.clearCookie(LEGACY_SESSION_COOKIE, { path: "/" });
  res.cookie(cookieName(app), token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    domain,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response, app: AppSurface): void {
  const domain = cookieDomain();
  res.clearCookie(cookieName(app), { path: "/", domain });
  // Also drop the host-only variant and the legacy shared cookie.
  res.clearCookie(cookieName(app), { path: "/" });
  if (domain) res.clearCookie(LEGACY_SESSION_COOKIE, { path: "/", domain });
  res.clearCookie(LEGACY_SESSION_COOKIE, { path: "/" });
}
