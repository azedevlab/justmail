import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  AddMemberRequest,
  CreateOrgRequest,
  UpdateMemberRequest,
  UpdateOrgRequest,
  UpdateQuotaRequest,
} from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { OrgsService } from "./orgs.service";

@Controller("orgs")
@UseGuards(SessionGuard)
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  list(@Principal() principal: SessionPrincipal) {
    return this.orgs.listForUser(principal.userId);
  }

  @Post()
  create(
    @Principal() principal: SessionPrincipal,
    @Body(new ZodPipe(CreateOrgRequest)) body: CreateOrgRequest,
    @Req() req: Request,
  ) {
    return this.orgs.create(principal, body, req.ip);
  }

  @Get(":id")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.orgs.get(id, principal.userId);
  }

  @Patch(":id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateOrgRequest)) body: UpdateOrgRequest,
    @Req() req: Request,
  ) {
    return this.orgs.update(principal, id, body, req.ip);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.orgs.remove(principal, id, req.ip);
  }

  @Get(":id/quota")
  quota(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.orgs.getQuota(id, principal.userId);
  }

  @Put(":id/quota")
  setQuota(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateQuotaRequest)) body: UpdateQuotaRequest,
    @Req() req: Request,
  ) {
    return this.orgs.setQuota(principal, id, body.storage_quota_mb, req.ip);
  }

  @Get(":id/members")
  members(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.orgs.listMembers(id, principal.userId);
  }

  @Post(":id/members")
  @HttpCode(204)
  addMember(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(AddMemberRequest)) body: AddMemberRequest,
    @Req() req: Request,
  ) {
    return this.orgs.addMember(principal, id, body, req.ip);
  }

  @Patch(":id/members/:userId")
  @HttpCode(204)
  updateMember(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body(new ZodPipe(UpdateMemberRequest)) body: UpdateMemberRequest,
    @Req() req: Request,
  ) {
    if (!body.role) return;
    return this.orgs.updateMember(principal, id, userId, body.role, req.ip);
  }

  @Delete(":id/members/:userId")
  @HttpCode(204)
  removeMember(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: Request,
  ) {
    return this.orgs.removeMember(principal, id, userId, req.ip);
  }
}
