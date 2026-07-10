import { Injectable } from "@nestjs/common";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import type { DmarcReport } from "@justmail/contracts";

/**
 * DMARC aggregate reports arrive as XML at ruf/rua addresses; a downstream
 * parser (planned) POSTs the parsed report to /internal/dmarc/ingest.
 * Until then the raw XML can be recorded as-is via the same endpoint.
 */
@Injectable()
export class DmarcService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
  ) {}

  async list(orgId: string, userId: string): Promise<DmarcReport[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query(
      `SELECT r.id, r.reporter, r.begin_ts, r.end_ts, r.pass, r.fail, r.created_at,
              d.name AS domain_name
       FROM dmarc_reports r LEFT JOIN domains d ON d.id = r.domain_id
       WHERE r.org_id = $1 ORDER BY r.end_ts DESC LIMIT 200`,
      [orgId],
    );
    return rows.map((r) => ({
      id: r.id,
      reporter: r.reporter,
      begin_ts: (r.begin_ts as Date).toISOString(),
      end_ts: (r.end_ts as Date).toISOString(),
      pass: Number(r.pass),
      fail: Number(r.fail),
      created_at: (r.created_at as Date).toISOString(),
      domain_name: r.domain_name,
    }));
  }

  async ingest(payload: {
    org_id: string;
    domain: string;
    reporter: string;
    begin_ts: string;
    end_ts: string;
    pass: number;
    fail: number;
    raw: unknown;
  }): Promise<void> {
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM domains WHERE name = $1 AND org_id = $2",
      [payload.domain, payload.org_id],
    );
    const domainId = rows[0]?.id ?? null;
    await this.db.query(
      `INSERT INTO dmarc_reports (org_id, domain_id, reporter, begin_ts, end_ts, pass, fail, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        payload.org_id,
        domainId,
        payload.reporter,
        payload.begin_ts,
        payload.end_ts,
        payload.pass,
        payload.fail,
        JSON.stringify(payload.raw),
      ],
    );
  }
}
