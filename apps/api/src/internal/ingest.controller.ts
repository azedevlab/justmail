import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "../config";
import { Db } from "../db/db.service";
import { SkipThrottle } from "../common/throttle.decorator";
import { NotificationsService } from "../notifications/notifications.service";
import { parseByService, type ParsedEvent } from "./parse";

interface VectorEvent {
  service?: string;
  message?: string;
  timestamp?: string;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

// Vector ships mail-stack log lines here; parseByService pulls out the fields
// (queue_id, from/to, spam score, dsn, tls) that dashboards + queue views need.
@Controller("internal/events")
@SkipThrottle()
export class IngestController {
  constructor(
    private readonly db: Db,
    private readonly notifications: NotificationsService,
  ) {}

  @Post("ingest")
  @HttpCode(204)
  async ingest(
    @Headers("x-ingest-token") token: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    if (
      !token ||
      !timingSafeEqual(digest(token), digest(config.EVENTS_INGEST_TOKEN))
    ) {
      throw new UnauthorizedException({ title: "Invalid ingest token" });
    }

    const events = (Array.isArray(body) ? body : [body]).filter(
      (e): e is VectorEvent => typeof e === "object" && e !== null,
    );
    if (events.length === 0) return;

    const cols = [
      "event",
      "direction",
      "queue_id",
      "from_addr",
      "to_addr",
      "size_bytes",
      "spam_score",
      "spam_action",
      "tls_version",
      "dsn",
      "detail",
      "occurred_at",
    ];
    const values: unknown[] = [];
    const tuples: string[] = [];
    const parsedList: ParsedEvent[] = [];
    for (const e of events) {
      const message = String(e.message ?? "").slice(0, 4000);
      if (!message) continue;
      const service = String(e.service ?? "unknown").slice(0, 32);
      const occurredAt = e.timestamp ? new Date(e.timestamp) : new Date();
      const parsed = parseByService(service, message);
      parsedList.push(parsed);
      const base = values.length;
      tuples.push(
        `(${cols.map((_, i) => `$${base + i + 1}`).join(", ")})`,
      );
      values.push(
        parsed.event,
        parsed.direction,
        parsed.queue_id,
        parsed.from_addr,
        parsed.to_addr,
        parsed.size_bytes,
        parsed.spam_score,
        parsed.spam_action,
        parsed.tls_version,
        parsed.dsn,
        message,
        Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      );
    }
    if (tuples.length === 0) return;

    await this.db.query(
      `INSERT INTO mail_events (${cols.join(", ")}) VALUES ${tuples.join(", ")}`,
      values,
    );

    void this.notifyDeliveries(parsedList);
  }

  // A successful Postfix→Dovecot LMTP hand-off (`postfix.lmtp.sent`) is the
  // point a message actually lands in a local mailbox. The delivery line
  // carries the recipient but not the sender, so correlate the sender from the
  // `from=` line (qmgr/cleanup) sharing the same queue id — this batch first,
  // then recent history. Best-effort: notification failures never disturb
  // log ingest.
  private async notifyDeliveries(parsed: ParsedEvent[]): Promise<void> {
    const deliveries = parsed.filter(
      (p) => p.event === "postfix.lmtp.sent" && p.to_addr,
    );
    if (deliveries.length === 0) return;

    const fromByQid = new Map<string, string>();
    for (const p of parsed) {
      if (p.queue_id && p.from_addr) fromByQid.set(p.queue_id, p.from_addr);
    }

    for (const d of deliveries) {
      try {
        let sender = d.queue_id ? fromByQid.get(d.queue_id) ?? null : null;
        if (!sender && d.queue_id) {
          const { rows } = await this.db.query<{ from_addr: string }>(
            `SELECT from_addr FROM mail_events
             WHERE queue_id = $1 AND from_addr IS NOT NULL AND from_addr <> ''
             ORDER BY occurred_at DESC LIMIT 1`,
            [d.queue_id],
          );
          sender = rows[0]?.from_addr ?? null;
        }
        await this.notifications.notifyInboundDelivery(d.to_addr!, sender);
      } catch {
        // best-effort; a failed notification must not fail ingest
      }
    }
  }
}
