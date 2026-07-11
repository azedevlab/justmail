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
  CreateMailGroupRequest,
  MailGroupMembersRequest,
  UpdateMailGroupRequest,
} from "@justmail/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { GroupsService } from "./groups.service";

@Controller("orgs/:orgId")
@UseGuards(SessionGuard)
export class GroupsController {
  constructor(private readonly svc: GroupsService) {}

  @Get("groups")
  list(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ) {
    return this.svc.listOrg(orgId, principal.userId);
  }

  @Get("groups/:id")
  get(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.get(orgId, id, principal.userId);
  }

  @Get("domains/:domainId/groups")
  listDomain(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
  ) {
    return this.svc.listDomain(orgId, domainId, principal.userId);
  }

  @Post("domains/:domainId/groups")
  create(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Body(new ZodPipe(CreateMailGroupRequest)) body: CreateMailGroupRequest,
    @Req() req: Request,
  ) {
    return this.svc.create(principal, orgId, domainId, body, req.ip);
  }

  @Patch("groups/:id")
  update(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateMailGroupRequest)) body: UpdateMailGroupRequest,
    @Req() req: Request,
  ) {
    return this.svc.update(principal, orgId, id, body, req.ip);
  }

  @Put("groups/:id/members")
  setMembers(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(MailGroupMembersRequest)) body: MailGroupMembersRequest,
    @Req() req: Request,
  ) {
    return this.svc.setMembers(principal, orgId, id, body.members, req.ip);
  }

  @Delete("groups/:id")
  @HttpCode(204)
  remove(
    @Principal() principal: SessionPrincipal,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.svc.remove(principal, orgId, id, req.ip);
  }
}
