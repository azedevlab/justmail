import { Injectable, Logger } from "@nestjs/common";
import { Db } from "../db/db.service";

/**
 * Approximates postfix queue depth from recent mail_events until the postfix
 * container starts emitting real `postqueue -j` snapshots. Good enough for the
 * dashboard chart; exact queue actions still require docker exec into postfix.
 */
@Injectable()
export class QueueSnapshotService {
  private readonly logger = new Logger(QueueSnapshotService.name);

  constructor(private readonly db: Db) {}

  async tick() {
    const { rows } = await this.db.query<{
      active: string;
      deferred: string;
      hold: string;
      oldest: number;
    }>(
      `WITH recent AS (
         SELECT queue_id,
                bool_or(event LIKE '%defer%') AS is_deferred,
                bool_or(event LIKE '%hold%') AS is_hold,
                bool_or(event LIKE '%.sent%' OR event LIKE '%delivered%') AS is_done,
                min(occurred_at) AS first_seen
         FROM mail_events
         WHERE queue_id IS NOT NULL
           AND occurred_at > now() - interval '15 minutes'
         GROUP BY queue_id
       )
       SELECT
         count(*) FILTER (WHERE NOT is_done AND NOT is_deferred AND NOT is_hold) AS active,
         count(*) FILTER (WHERE NOT is_done AND is_deferred AND NOT is_hold) AS deferred,
         count(*) FILTER (WHERE is_hold) AS hold,
         COALESCE(EXTRACT(EPOCH FROM (now() - min(first_seen))), 0)::int AS oldest
       FROM recent WHERE NOT is_done`,
    );
    const r = rows[0]!;
    await this.db.query(
      `INSERT INTO queue_snapshots (active, deferred, hold, oldest_age_s)
       VALUES ($1, $2, $3, $4)`,
      [Number(r.active), Number(r.deferred), Number(r.hold), r.oldest],
    );
    // Roll off snapshots older than a week.
    await this.db.query(
      "DELETE FROM queue_snapshots WHERE taken_at < now() - interval '7 days'",
    );
    this.logger.debug?.(`queue snapshot: active=${r.active} deferred=${r.deferred}`);
  }
}
