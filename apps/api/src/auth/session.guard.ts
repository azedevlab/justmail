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

export const SESSION_COOKIE = "jm_session";

declare module "express" {
  interface Request {
    principal?: SessionPrincipal;
    apiKey?: ApiKeyPrincipal;
  }
}

/**
 * Accepts either a session cookie (jm_session) or a Bearer API token. When a
 * token authenticates, we synthesize a SessionPrincipal that carries the key's
 * scopes so downstream code has a uniform surface.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    // A browser can hold more than one jm_session cookie at different scopes
    // (e.g. a stale host-only cookie left over from before the cookie was
    // scoped to the parent domain). It then sends `jm_session=A; jm_session=B`
    // and cookie-parser surfaces only the FIRST — which may be the stale one,
    // making a perfectly valid login 401. Try every jm_session value present
    // (capped) so a good token is never masked by a stale duplicate.
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

// Collect every distinct jm_session token the request carries: the one
// cookie-parser exposed plus any additional duplicates in the raw Cookie
// header (which cookie-parser drops). Order: parser value first, then header
// order. Capped so a client can't force unbounded session lookups.
const MAX_SESSION_TOKENS = 5;
function sessionTokens(req: Request): string[] {
  const tokens: string[] = [];
  const parsed = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[SESSION_COOKIE];
  if (parsed) tokens.push(parsed);

  const raw = req.headers.cookie;
  if (raw) {
    for (const part of raw.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
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
