import { Injectable, NotFoundException } from "@nestjs/common";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import type { DmarcRecord, DmarcReport, DmarcReportDetail } from "@justmail/contracts";
import { parseDmarcArchive, type DmarcParsedRecord } from "./dmarc-parse";

interface ReportRow {
  id: string;
  reporter: string;
  begin_ts: Date;
  end_ts: Date;
  pass: number | string;
  fail: number | string;
  created_at: Date;
  domain_name: string | null;
}

/**
 * DMARC aggregate reports arrive as gzip/zip XML at the rua address; a
 * downstream collector base64-encodes each attachment and POSTs it to
 * /internal/dmarc/ingest-xml, where it is parsed into a report + per-source
 * drilldown rows. Pre-parsed counts can still be recorded via /internal/dmarc/ingest.
 */
@Injectable()
export class DmarcService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
  ) {}

  async list(orgId: string, userId: string): Promise<DmarcReport[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<ReportRow>(
      `SELECT r.id, r.reporter, r.begin_ts, r.end_ts, r.pass, r.fail, r.created_at,
              d.name AS domain_name
       FROM dmarc_reports r LEFT JOIN domains d ON d.id = r.domain_id
       WHERE r.org_id = $1 ORDER BY r.end_ts DESC LIMIT 200`,
      [orgId],
    );
    return rows.map(toReport);
  }

  async getReport(
    orgId: string,
    id: string,
    userId: string,
  ): Promise<DmarcReportDetail> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<ReportRow>(
      `SELECT r.id, r.reporter, r.begin_ts, r.end_ts, r.pass, r.fail, r.created_at,
              d.name AS domain_name
       FROM dmarc_reports r LEFT JOIN domains d ON d.id = r.domain_id
       WHERE r.id = $1 AND r.org_id = $2`,
      [id, orgId],
    );
    if (rows.length === 0) {
      throw new NotFoundException({ title: "DMARC report not found" });
    }
    const { rows: recs } = await this.db.query<{
      source_ip: string | null;
      count: number | string;
      disposition: string;
      dkim_pass: boolean;
      spf_pass: boolean;
      header_from: string | null;
    }>(
      `SELECT source_ip, count, disposition, dkim_pass, spf_pass, header_from
       FROM dmarc_report_records
       WHERE report_id = $1 ORDER BY count DESC`,
      [id],
    );
    return {
      ...toReport(rows[0]!),
      records: recs.map(
        (r): DmarcRecord => ({
          source_ip: r.source_ip ?? "",
          count: Number(r.count),
          disposition: r.disposition,
          dkim_pass: r.dkim_pass,
          spf_pass: r.spf_pass,
          header_from: r.header_from,
        }),
      ),
    };
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
    records?: DmarcParsedRecord[];
  }): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM domains WHERE name = $1 AND org_id = $2",
      [payload.domain, payload.org_id],
    );
    const domainId = rows[0]?.id ?? null;
    return this.db.tx(async (client) => {
      const { rows: inserted } = await client.query<{ id: string }>(
        `INSERT INTO dmarc_reports (org_id, domain_id, reporter, begin_ts, end_ts, pass, fail, raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING id`,
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
      const reportId = inserted[0]!.id;
      for (const rec of payload.records ?? []) {
        await client.query(
          `INSERT INTO dmarc_report_records
             (report_id, source_ip, count, disposition, dkim_pass, spf_pass, header_from)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            reportId,
            rec.source_ip || null,
            rec.count,
            rec.disposition,
            rec.dkim_pass,
            rec.spf_pass,
            rec.header_from,
          ],
        );
      }
      return reportId;
    });
  }

  // Parse a raw aggregate archive (gzip/zip/plain XML bytes) and record it with
  // its per-source drilldown rows.
  async ingestArchive(orgId: string, archive: Buffer): Promise<string> {
    const parsed = parseDmarcArchive(archive);
    return this.ingest({
      org_id: orgId,
      domain: parsed.domain,
      reporter: parsed.reporter,
      begin_ts: parsed.begin_ts,
      end_ts: parsed.end_ts,
      pass: parsed.pass,
      fail: parsed.fail,
      raw: { report_id: parsed.report_id },
      records: parsed.records,
    });
  }
}

function toReport(r: {
  id: string;
  reporter: string;
  begin_ts: Date;
  end_ts: Date;
  pass: number | string;
  fail: number | string;
  created_at: Date;
  domain_name: string | null;
}): DmarcReport {
  return {
    id: r.id,
    reporter: r.reporter,
    begin_ts: r.begin_ts.toISOString(),
    end_ts: r.end_ts.toISOString(),
    pass: Number(r.pass),
    fail: Number(r.fail),
    created_at: r.created_at.toISOString(),
    domain_name: r.domain_name,
  };
}
