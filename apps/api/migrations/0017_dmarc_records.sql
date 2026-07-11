-- 0017_dmarc_records: per-source drilldown rows for DMARC aggregate reports.

CREATE TABLE dmarc_report_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES dmarc_reports(id) ON DELETE CASCADE,
  source_ip text,
  count int NOT NULL DEFAULT 0,
  disposition text NOT NULL DEFAULT 'none',
  dkim_pass boolean NOT NULL DEFAULT false,
  spf_pass boolean NOT NULL DEFAULT false,
  header_from text
);
CREATE INDEX dmarc_report_records_report_idx
  ON dmarc_report_records (report_id);
