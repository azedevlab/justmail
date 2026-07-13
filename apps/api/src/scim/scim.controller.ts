import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { Scim, ScimGuard } from "./scim.guard";
import { ScimService, type ListParams, type ScimContext } from "./scim.service";
import { ZodPipe } from "../common/zod.pipe";
import { ScimGroupBody, ScimPatchBody, ScimUserBody } from "./scim.schemas";

const SCIM_JSON = "application/scim+json";

function ok(res: Response, body: object, status = 200): void {
  res.status(status).type(SCIM_JSON).json(body);
}

// SCIM 2.0 provisioning endpoints (RFC 7644). Base URL is per-org and
// authenticated by the org's SCIM bearer token.
@Controller("scim/v2/:orgId")
@UseGuards(ScimGuard)
export class ScimController {
  constructor(private readonly scim: ScimService) {}

  private list(q: Record<string, string | undefined>): ListParams {
    return {
      filter: q.filter,
      startIndex: q.startIndex ? Number(q.startIndex) : undefined,
      count: q.count ? Number(q.count) : undefined,
    };
  }

  // ── Discovery ──────────────────────────────────────────────────────────────
  @Get("ServiceProviderConfig")
  spConfig(@Res() res: Response) {
    ok(res, this.scim.serviceProviderConfig());
  }

  @Get("ResourceTypes")
  resourceTypes(@Scim() ctx: ScimContext, @Res() res: Response) {
    ok(res, this.scim.resourceTypes(this.scim.baseUrl(ctx.orgId)));
  }

  @Get("Schemas")
  schemas(@Res() res: Response) {
    ok(res, this.scim.schemas());
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  @Get("Users")
  async listUsers(
    @Scim() ctx: ScimContext,
    @Query() q: Record<string, string>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.listUsers(ctx, this.list(q)));
  }

  @Get("Users/:id")
  async getUser(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.getUser(ctx, id));
  }

  @Post("Users")
  async createUser(
    @Scim() ctx: ScimContext,
    @Body(new ZodPipe(ScimUserBody)) body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.createUser(ctx, body), 201);
  }

  @Put("Users/:id")
  async replaceUser(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Body(new ZodPipe(ScimUserBody)) body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.replaceUser(ctx, id, body));
  }

  @Patch("Users/:id")
  async patchUser(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Body(new ZodPipe(ScimPatchBody)) body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.patchUser(ctx, id, body));
  }

  @Delete("Users/:id")
  async deleteUser(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    await this.scim.deleteUser(ctx, id);
    res.status(204).end();
  }

  // ── Groups ─────────────────────────────────────────────────────────────────
  @Get("Groups")
  async listGroups(
    @Scim() ctx: ScimContext,
    @Query() q: Record<string, string>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.listGroups(ctx, this.list(q)));
  }

  @Get("Groups/:id")
  async getGroup(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.getGroup(ctx, id));
  }

  @Post("Groups")
  async createGroup(
    @Scim() ctx: ScimContext,
    @Body(new ZodPipe(ScimGroupBody)) body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.createGroup(ctx, body), 201);
  }

  @Put("Groups/:id")
  async replaceGroup(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Body(new ZodPipe(ScimGroupBody)) body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.replaceGroup(ctx, id, body));
  }

  @Patch("Groups/:id")
  async patchGroup(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Body(new ZodPipe(ScimPatchBody)) body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    ok(res, await this.scim.patchGroup(ctx, id, body));
  }

  @Delete("Groups/:id")
  async deleteGroup(
    @Scim() ctx: ScimContext,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    await this.scim.deleteGroup(ctx, id);
    res.status(204).end();
  }
}
