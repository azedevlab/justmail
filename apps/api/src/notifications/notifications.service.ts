import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  Notification,
  WebPushSubscription,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface Row {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  read_at: Date | null;
  created_at: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: Db) {}

  async list(principal: SessionPrincipal): Promise<Notification[]> {
    const { rows } = await this.db.query<Row>(
      `SELECT id, kind, title, body, url, read_at, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 200`,
      [principal.userId],
    );
    return rows.map(toNotification);
  }

  async markRead(principal: SessionPrincipal, id: string): Promise<void> {
    const { rowCount } = await this.db.query(
      "UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
      [id, principal.userId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Notification not found" });
  }

  async markAllRead(principal: SessionPrincipal): Promise<void> {
    await this.db.query(
      "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL",
      [principal.userId],
    );
  }

  async publish(input: {
    orgId?: string | null;
    userId: string;
    kind: string;
    title: string;
    body?: string;
    url?: string;
  }): Promise<Notification> {
    const { rows } = await this.db.query<Row>(
      `INSERT INTO notifications (org_id, user_id, kind, title, body, url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, kind, title, body, url, read_at, created_at`,
      [
        input.orgId ?? null,
        input.userId,
        input.kind,
        input.title,
        input.body ?? "",
        input.url ?? null,
      ],
    );
    return toNotification(rows[0]!);
  }

  async subscribeWebPush(
    principal: SessionPrincipal,
    sub: WebPushSubscription,
  ) {
    await this.db.query(
      `INSERT INTO web_push_subs (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
      [
        principal.userId,
        sub.endpoint,
        sub.keys.p256dh,
        sub.keys.auth,
        sub.user_agent ?? null,
      ],
    );
  }

  async unsubscribeWebPush(principal: SessionPrincipal, id: string) {
    await this.db.query(
      "DELETE FROM web_push_subs WHERE id = $1 AND user_id = $2",
      [id, principal.userId],
    );
  }
}

function toNotification(r: Row): Notification {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    url: r.url,
    read_at: r.read_at ? r.read_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
  };
}
