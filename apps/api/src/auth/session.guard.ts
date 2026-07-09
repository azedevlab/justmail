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
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const cookieToken = cookies?.[SESSION_COOKIE];
    if (cookieToken) {
      const principal = await this.auth.resolveSession(cookieToken);
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
