import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Request } from "express";
import { ScimService, type ScimContext } from "./scim.service";

declare module "express" {
  interface Request {
    scim?: ScimContext;
  }
}

// Authenticates a SCIM request by the org's bearer token. The org id is taken
// from the :orgId route segment so each org has a distinct SCIM base URL.
@Injectable()
export class ScimGuard implements CanActivate {
  constructor(private readonly scim: ScimService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const orgId = String(req.params.orgId ?? "");
    const header = req.headers.authorization ?? "";
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!orgId || !m) {
      throw new UnauthorizedException({ title: "Missing SCIM credentials" });
    }
    req.scim = await this.scim.authenticate(orgId, (m[1] ?? "").trim());
    return true;
  }
}

export const Scim = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ScimContext => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.scim!;
  },
);
