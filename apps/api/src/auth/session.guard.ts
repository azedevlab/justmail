import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService, SessionPrincipal } from "./auth.service";
import { ApiKeysService, ApiKeyPrincipal } from "../apikeys/apikeys.service";
import { appFromRequest, cookieName } from "./session-cookie";

declare module "express" {
  interface Request {
    principal?: SessionPrincipal;
    apiKey?: ApiKeyPrincipal;
  }
}

/**
 * Accepts either a per-app session cookie (jm_admin_session / jm_webmail_session)
 * or a Bearer API token. The cookie read is scoped to the calling app so an
 * admin and a webmail session can coexist without overwriting each other. When
 * a token authenticates, we synthesize a SessionPrincipal that carries the
 * key's scopes so downstream code has a uniform surface.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    // A browser can hold more than one copy of the session cookie at different
    // scopes (e.g. a stale host-only cookie left over from a prior scope). It
    // then sends `<name>=A; <name>=B` and cookie-parser surfaces only the FIRST
    // — which may be the stale one, making a valid login 401. Try every value
    // for this app's cookie (capped) so a good token is never masked.
    for (const token of sessionTokens(req)) {
      const principal = await this.auth.resolveSession(token);
      if (principal) {
        req.principal = principal;
        return true;
      }
    }
    const bearer = extractBearer(req);
    if (bearer) {
      const key = await this.apiKeys.resolve(bearer);
      req.apiKey = key;
      req.principal = {
        userId: key.keyId,
        sessionId: key.keyId,
        email: `apikey:${key.keyId}`,
        name: `API key ${key.keyId.slice(0, 8)}`,
      };
      return true;
    }
    throw new UnauthorizedException({ title: "Not authenticated" });
  }
}

// Collect every distinct token for THIS app's session cookie: the one
// cookie-parser exposed plus any additional duplicates in the raw Cookie
// header (which cookie-parser drops). Order: parser value first, then header
// order. Capped so a client can't force unbounded session lookups.
const MAX_SESSION_TOKENS = 5;
function sessionTokens(req: Request): string[] {
  const name = cookieName(appFromRequest(req));
  const tokens: string[] = [];
  const parsed = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[name];
  if (parsed) tokens.push(parsed);

  const raw = req.headers.cookie;
  if (raw) {
    for (const part of raw.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() !== name) continue;
      const value = decodeCookieValue(part.slice(eq + 1).trim());
      if (value) tokens.push(value);
    }
  }
  return [...new Set(tokens)].slice(0, MAX_SESSION_TOKENS);
}

function decodeCookieValue(raw: string): string {
  const unquoted =
    raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
      ? raw.slice(1, -1)
      : raw;
  try {
    return decodeURIComponent(unquoted);
  } catch {
    return unquoted;
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return m ? (m[1] ?? "").trim() : null;
}

export const Principal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionPrincipal => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.principal!;
  },
);
