import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import webpush from "web-push";
import type {
  Notification,
  WebPushSubscription,
} from "@justmail/contracts";
import { config } from "../config";
import { Db } from "../db/db.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

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
  private vapidReady = false;

  constructor(private readonly db: Db) {}

  // Configure web-push VAPID details once, lazily. Returns false when the
  // deployment has not provisioned keys, in which case push is a no-op.
  private ensureVapid(): boolean {
    if (this.vapidReady) return true;
    const pub = config.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = config.WEB_PUSH_VAPID_PRIVATE_KEY;
    if (!pub || !priv) return false;
    const subject =
      config.WEB_PUSH_SUBJECT ?? `mailto:postmaster@${config.MAIL_HOSTNAME}`;
    webpush.setVapidDetails(subject, pub, priv);
    this.vapidReady = true;
    return true;
  }

  // Fan out a notification to every registered browser subscription for the
  // user. Best-effort: expired endpoints (404/410) are pruned; other failures
  // are logged but not retried here.
  private async pushToUser(
    userId: string,
    payload: { title: string; body: string; url: string | null },
  ): Promise<void> {
    if (!this.ensureVapid()) return;
    const { rows } = await this.db.query<SubRow>(
      "SELECT id, endpoint, p256dh, auth FROM web_push_subs WHERE user_id = $1",
      [userId],
    );
    const body = JSON.stringify(payload);
    await Promise.all(
      rows.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.db.query("DELETE FROM web_push_subs WHERE id = $1", [s.id]);
          } else {
            this.logger.warn(
              `web-push failed for ${s.id}: ${(err as Error).message}`,
            );
          }
        }
      }),
    );
  }

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
    const notification = toNotification(rows[0]!);
    void this.pushToUser(input.userId, {
      title: notification.title,
      body: notification.body,
      url: notification.url,
    });
    return notification;
  }

  // Fired from the log-ingest stream when Postfix reports a successful LMTP
  // hand-off to a local mailbox. The webmail identity row is keyed by the
  // mailbox address, so an unknown recipient means the account never signed
  // into webmail — nothing to notify, and no push subscription can exist.
  async notifyInboundDelivery(
    toAddr: string,
    fromAddr: string | null,
  ): Promise<void> {
    const email = toAddr.trim();
    if (!email.includes("@")) return;
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    const userId = rows[0]?.id;
    if (!userId) return;
    const sender = fromAddr?.trim() || "";
    await this.publish({
      userId,
      kind: "mail",
      title: "New message",
      body: sender ? `From ${sender}` : "You have new mail",
      url: "/",
    });
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
