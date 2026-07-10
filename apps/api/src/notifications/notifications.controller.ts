import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { config } from "../config";
import { ZodPipe } from "../common/zod.pipe";
import { Principal, SessionGuard } from "../auth/session.guard";
import type { SessionPrincipal } from "../auth/auth.service";
import { NotificationsService } from "./notifications.service";

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  user_agent: z.string().optional(),
});

@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@Principal() principal: SessionPrincipal) {
    return this.svc.list(principal);
  }

  @Post(":id/mark-read")
  @HttpCode(204)
  markRead(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.markRead(principal, id);
  }

  @Post("read-all")
  @HttpCode(204)
  markAllRead(@Principal() principal: SessionPrincipal) {
    return this.svc.markAllRead(principal);
  }

  // Public VAPID key the browser needs to create a push subscription. Null
  // when the deployment has not provisioned web-push keys.
  @Get("web-push/key")
  vapidKey(): { key: string | null } {
    return { key: config.WEB_PUSH_VAPID_PUBLIC_KEY ?? null };
  }

  @Post("web-push/subscribe")
  @HttpCode(204)
  subscribe(
    @Principal() principal: SessionPrincipal,
    @Body(new ZodPipe(SubscribeBody)) body: z.infer<typeof SubscribeBody>,
  ) {
    return this.svc.subscribeWebPush(principal, body);
  }

  @Delete("web-push/subscribe/:id")
  @HttpCode(204)
  unsubscribe(
    @Principal() principal: SessionPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.svc.unsubscribeWebPush(principal, id);
  }
}
