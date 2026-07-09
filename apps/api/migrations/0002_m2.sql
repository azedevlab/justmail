-- 0002_m2: invites, webhooks, backup config, DMARC reports.

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email, accepted_at)
);
CREATE INDEX invites_org_idx ON invites (org_id);

CREATE TABLE webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret_enc text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_delivered_at timestamptz,
  last_status int,
  failure_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_endpoints_org_idx ON webhook_endpoints (org_id);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status int,
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_endpoint_idx ON webhook_deliveries (endpoint_id, created_at DESC);
CREATE INDEX webhook_deliveries_pending_idx ON webhook_deliveries (next_attempt_at)
  WHERE delivered_at IS NULL;

CREATE TABLE backup_schedules (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  destination text NOT NULL DEFAULT '',
  kinds text[] NOT NULL DEFAULT '{full}',
  retention_days int NOT NULL DEFAULT 7,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dmarc_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES domains(id) ON DELETE SET NULL,
  reporter text NOT NULL,
  begin_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,
  pass int NOT NULL DEFAULT 0,
  fail int NOT NULL DEFAULT 0,
  raw jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dmarc_reports_org_time_idx ON dmarc_reports (org_id, end_ts DESC);

-- We track known DNSBLs the platform checks against; results land in mail_events
-- with event='dnsbl.hit' so the dashboard can surface them.
CREATE TABLE dnsbl_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid REFERENCES domains(id) ON DELETE CASCADE,
  ip inet,
  bl text NOT NULL,
  hit boolean NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dnsbl_checks_time_idx ON dnsbl_checks (checked_at DESC);
