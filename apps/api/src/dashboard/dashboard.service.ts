import { Injectable } from "@nestjs/common";
import type { DashboardOverview } from "@justmail/types";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
  ) {}

  async overview(orgId: string, userId: string): Promise<DashboardOverview> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const [domains, mailboxes, quota, events, queue] = await Promise.all([
      this.db.query<{ total: string; active: string }>(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE status = 'active') AS active
         FROM domains WHERE org_id = $1`,
        [orgId],
      ),
      this.db.query<{ total: string; active: string; suspended: string }>(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE m.status = 'active') AS active,
                count(*) FILTER (WHERE m.status = 'suspended') AS suspended
         FROM mailboxes m JOIN domains d ON d.id = m.domain_id
         WHERE d.org_id = $1`,
        [orgId],
      ),
      this.db.query<{ used: string; alloc: string }>(
        `SELECT COALESCE(sum(m.quota_used_bytes),0) AS used,
                COALESCE(sum(m.quota_mb),0) AS alloc
         FROM mailboxes m JOIN domains d ON d.id = m.domain_id
         WHERE d.org_id = $1`,
        [orgId],
      ),
      this.db.query<{
        inbound: string;
        outbound: string;
        rejected: string;
        deferred: string;
      }>(
        `SELECT
           count(*) FILTER (WHERE direction = 'inbound') AS inbound,
           count(*) FILTER (WHERE direction = 'outbound') AS outbound,
           count(*) FILTER (WHERE event LIKE '%.reject%' OR event LIKE '%.bounce%') AS rejected,
           count(*) FILTER (WHERE event LIKE '%.defer%') AS deferred
         FROM mail_events
         WHERE occurred_at > now() - interval '24 hours'
           AND (org_id = $1 OR org_id IS NULL)`,
        [orgId],
      ),
      this.db.query<{
        active: number;
        deferred: number;
        hold: number;
        oldest_age_s: number;
      }>(
        `SELECT COALESCE(active,0) AS active, COALESCE(deferred,0) AS deferred,
                COALESCE(hold,0) AS hold, COALESCE(oldest_age_s,0) AS oldest_age_s
         FROM queue_snapshots ORDER BY taken_at DESC LIMIT 1`,
      ),
    ]);

    return {
      domains: {
        total: Number(domains.rows[0]?.total ?? 0),
        active: Number(domains.rows[0]?.active ?? 0),
      },
      mailboxes: {
        total: Number(mailboxes.rows[0]?.total ?? 0),
        active: Number(mailboxes.rows[0]?.active ?? 0),
        suspended: Number(mailboxes.rows[0]?.suspended ?? 0),
      },
      quota: {
        used_bytes: Number(quota.rows[0]?.used ?? 0),
        allocated_mb: Number(quota.rows[0]?.alloc ?? 0),
      },
      events_24h: {
        inbound: Number(events.rows[0]?.inbound ?? 0),
        outbound: Number(events.rows[0]?.outbound ?? 0),
        rejected: Number(events.rows[0]?.rejected ?? 0),
        deferred: Number(events.rows[0]?.deferred ?? 0),
      },
      queue: {
        active: Number(queue.rows[0]?.active ?? 0),
        deferred: Number(queue.rows[0]?.deferred ?? 0),
        hold: Number(queue.rows[0]?.hold ?? 0),
        oldest_age_s: Number(queue.rows[0]?.oldest_age_s ?? 0),
      },
    };
  }

  async recentEvents(orgId: string, userId: string, limit = 100) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query(
      `SELECT id, occurred_at, event, direction, from_addr, to_addr, size_bytes,
              spam_score, spam_action, tls_version, dsn, queue_id, detail
       FROM mail_events
       WHERE (org_id = $1 OR org_id IS NULL)
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [orgId, Math.min(limit, 500)],
    );
    return rows.map((r) => ({
      ...r,
      occurred_at: (r.occurred_at as Date).toISOString(),
      spam_score: r.spam_score === null ? null : Number(r.spam_score),
    }));
  }
}
