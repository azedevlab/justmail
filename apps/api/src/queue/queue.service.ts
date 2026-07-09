import { Injectable } from "@nestjs/common";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";

@Injectable()
export class QueueService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
  ) {}

  async latest(orgId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query(
      `SELECT active, deferred, hold, oldest_age_s, taken_at
       FROM queue_snapshots ORDER BY taken_at DESC LIMIT 1`,
    );
    if (!rows[0]) {
      return { active: 0, deferred: 0, hold: 0, oldest_age_s: 0, taken_at: null };
    }
    return { ...rows[0], taken_at: (rows[0].taken_at as Date).toISOString() };
  }

  /** Group deferred queue-ids from recent mail_events, so admins can trace them
   *  without SSH access to the postfix container. */
  async deferred(orgId: string, userId: string, limit = 100) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{
      queue_id: string;
      from_addr: string;
      to_addr: string;
      dsn: string;
      last_seen: Date;
      attempts: string;
    }>(
      `SELECT queue_id,
              max(from_addr) AS from_addr,
              max(to_addr) AS to_addr,
              max(dsn) AS dsn,
              max(occurred_at) AS last_seen,
              count(*) AS attempts
       FROM mail_events
       WHERE queue_id IS NOT NULL
         AND (org_id = $1 OR org_id IS NULL)
         AND event LIKE '%.defer%'
         AND occurred_at > now() - interval '24 hours'
       GROUP BY queue_id ORDER BY max(occurred_at) DESC
       LIMIT $2`,
      [orgId, Math.min(limit, 500)],
    );
    return rows.map((r) => ({
      ...r,
      last_seen: r.last_seen.toISOString(),
      attempts: Number(r.attempts),
    }));
  }

  async trace(orgId: string, userId: string, queueId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query(
      `SELECT event, direction, from_addr, to_addr, relay, dsn, spam_score,
              spam_action, tls_version, size_bytes, detail, occurred_at
       FROM mail_events
       WHERE queue_id = $1 AND (org_id = $2 OR org_id IS NULL)
       ORDER BY occurred_at ASC LIMIT 200`,
      [queueId, orgId],
    );
    return rows.map((r) => ({
      ...r,
      occurred_at: (r.occurred_at as Date).toISOString(),
      spam_score: r.spam_score === null ? null : Number(r.spam_score),
    }));
  }
}
