import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import type {
  CreateWebhookRequest,
  CreatedWebhook,
  WebhookDelivery,
  WebhookEndpoint,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { open, seal } from "../common/secretbox";
import type { SessionPrincipal } from "../auth/auth.service";

interface EndpointRow {
  id: string;
  org_id: string;
  url: string;
  events: string[];
  secret_enc: string;
  active: boolean;
  last_delivered_at: Date | null;
  last_status: number | null;
  failure_count: number;
  created_at: Date;
}

const MAX_ATTEMPTS = 6;
// Progressive backoff (seconds). After the 6th attempt we give up.
const BACKOFF = [10, 60, 300, 1800, 7200, 21600];

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, userId: string): Promise<WebhookEndpoint[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<EndpointRow>(
      `SELECT id, org_id, url, events, secret_enc, active, last_delivered_at,
              last_status, failure_count, created_at
       FROM webhook_endpoints WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return rows.map(toEndpoint);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    req: CreateWebhookRequest,
    ip?: string,
  ): Promise<CreatedWebhook> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const enc = seal(secret);
    const { rows } = await this.db.query<EndpointRow>(
      `INSERT INTO webhook_endpoints (org_id, url, events, secret_enc, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, org_id, url, events, secret_enc, active, last_delivered_at,
                 last_status, failure_count, created_at`,
      [orgId, req.url, req.events, enc, principal.userId],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webhook.create",
      targetType: "webhook",
      targetId: rows[0]!.id,
      ip,
      meta: { url: req.url, events: req.events },
    });
    return { ...toEndpoint(rows[0]!), secret };
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rowCount } = await this.db.query(
      "DELETE FROM webhook_endpoints WHERE id = $1 AND org_id = $2",
      [id, orgId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Webhook not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webhook.delete",
      targetType: "webhook",
      targetId: id,
      ip,
    });
  }

  async recentDeliveries(
    orgId: string,
    userId: string,
    endpointId: string,
    limit = 50,
  ): Promise<WebhookDelivery[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<{
      id: string;
      event: string;
      status: number | null;
      attempts: number;
      next_attempt_at: Date | null;
      delivered_at: Date | null;
      last_error: string | null;
      created_at: Date;
    }>(
      `SELECT d.id, d.event, d.status, d.attempts, d.next_attempt_at,
              d.delivered_at, d.last_error, d.created_at
       FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.endpoint_id = $1 AND e.org_id = $2
       ORDER BY d.created_at DESC LIMIT $3`,
      [endpointId, orgId, Math.min(limit, 200)],
    );
    return rows.map((r) => ({
      id: r.id,
      event: r.event,
      status: r.status,
      attempts: r.attempts,
      next_attempt_at: r.next_attempt_at ? r.next_attempt_at.toISOString() : null,
      delivered_at: r.delivered_at ? r.delivered_at.toISOString() : null,
      last_error: r.last_error,
      created_at: r.created_at.toISOString(),
    }));
  }

  /** Emit an event to every subscribed endpoint. Never throws — deliveries are
   *  queued to the DB and worked off by tick(). */
  async emit(
    orgId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { rows } = await this.db.query<{ id: string }>(
        `SELECT id FROM webhook_endpoints
         WHERE org_id = $1 AND active AND $2 = ANY(events)`,
        [orgId, event],
      );
      if (rows.length === 0) return;
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (const r of rows) {
        const b = values.length;
        tuples.push(`($${b + 1}, $${b + 2}, $${b + 3}::jsonb, now())`);
        values.push(r.id, event, JSON.stringify(payload));
      }
      await this.db.query(
        `INSERT INTO webhook_deliveries (endpoint_id, event, payload, next_attempt_at)
         VALUES ${tuples.join(", ")}`,
        values,
      );
    } catch (err) {
      this.logger.warn(`webhook enqueue failed: ${(err as Error).message}`);
    }
  }

  /** Attempt to deliver every ready delivery. Called by the worker loop. */
  async tick(): Promise<{ delivered: number; failed: number }> {
    const { rows } = await this.db.query<{
      id: string;
      endpoint_id: string;
      event: string;
      payload: unknown;
      attempts: number;
      url: string;
      secret_enc: string;
    }>(
      `SELECT d.id, d.endpoint_id, d.event, d.payload, d.attempts,
              e.url, e.secret_enc
       FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.delivered_at IS NULL
         AND d.next_attempt_at IS NOT NULL AND d.next_attempt_at <= now()
       ORDER BY d.next_attempt_at LIMIT 50`,
    );
    let delivered = 0;
    let failed = 0;
    for (const r of rows) {
      const secret = open(r.secret_enc);
      const bodyStr = JSON.stringify({
        event: r.event,
        data: r.payload,
        delivered_at: new Date().toISOString(),
      });
      const sig = createHmac("sha256", secret).update(bodyStr).digest("hex");
      let status: number | null = null;
      let errMsg: string | null = null;
      try {
        const res = await fetch(r.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-justmail-event": r.event,
            "x-justmail-signature": `sha256=${sig}`,
          },
          body: bodyStr,
          signal: AbortSignal.timeout(10_000),
        });
        status = res.status;
      } catch (err) {
        errMsg = (err as Error).message.slice(0, 500);
      }
      const attempts = r.attempts + 1;
      const success = status !== null && status >= 200 && status < 300;
      if (success) {
        delivered++;
        await this.db.tx(async (tx) => {
          await tx.query(
            `UPDATE webhook_deliveries SET status = $2, attempts = $3,
               delivered_at = now(), next_attempt_at = NULL, last_error = NULL
             WHERE id = $1`,
            [r.id, status, attempts],
          );
          await tx.query(
            `UPDATE webhook_endpoints SET last_delivered_at = now(),
               last_status = $2, failure_count = 0 WHERE id = $1`,
            [r.endpoint_id, status],
          );
        });
      } else {
        failed++;
        const next =
          attempts >= MAX_ATTEMPTS ? null : nextRetry(attempts);
        await this.db.tx(async (tx) => {
          await tx.query(
            `UPDATE webhook_deliveries SET status = $2, attempts = $3,
               next_attempt_at = $4, last_error = $5
             WHERE id = $1`,
            [r.id, status, attempts, next, errMsg ?? `HTTP ${status}`],
          );
          await tx.query(
            `UPDATE webhook_endpoints SET last_status = $2,
               failure_count = failure_count + 1 WHERE id = $1`,
            [r.endpoint_id, status],
          );
        });
      }
    }
    return { delivered, failed };
  }
}

function nextRetry(attempts: number): Date {
  const delay = BACKOFF[Math.min(attempts, BACKOFF.length - 1)] ?? 3600;
  return new Date(Date.now() + delay * 1000);
}

function toEndpoint(r: EndpointRow): WebhookEndpoint {
  return {
    id: r.id,
    url: r.url,
    events: r.events ?? [],
    active: r.active,
    last_delivered_at: r.last_delivered_at
      ? r.last_delivered_at.toISOString()
      : null,
    last_status: r.last_status,
    failure_count: r.failure_count,
    created_at: r.created_at.toISOString(),
  };
}
