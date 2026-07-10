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
import { parseByService } from "./parse";

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
  constructor(private readonly db: Db) {}

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
    for (const e of events) {
      const message = String(e.message ?? "").slice(0, 4000);
      if (!message) continue;
      const service = String(e.service ?? "unknown").slice(0, 32);
      const occurredAt = e.timestamp ? new Date(e.timestamp) : new Date();
      const parsed = parseByService(service, message);
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
  }
}
