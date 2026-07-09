-- 0001_init: identity, tenancy, mail objects, reconciler state, observability,
-- and the mail_* views that are the ONLY surface Postfix/Dovecot touch.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Identity & tenancy ──────────────────────────────────────────────────────

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','invited')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX api_keys_org_idx ON api_keys (org_id);

CREATE TABLE audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user','api_key','system')),
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  ip inet,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
CREATE INDEX audit_logs_org_time_idx ON audit_logs (org_id, created_at DESC);

-- ── Mail objects (desired state) ───────────────────────────────────────────

CREATE TABLE domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name citext NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification','verifying','active','suspended')),
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_primary boolean NOT NULL DEFAULT false,
  catch_all_target citext,
  max_mailboxes int,
  max_quota_mb bigint,
  outbound_mode text NOT NULL DEFAULT 'inherit' CHECK (outbound_mode IN ('inherit','direct','smarthost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX domains_org_idx ON domains (org_id);

CREATE TABLE mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  local_part citext NOT NULL,
  name text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  quota_mb bigint NOT NULL DEFAULT 1024,
  quota_used_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
  imap_enabled boolean NOT NULL DEFAULT true,
  pop3_enabled boolean NOT NULL DEFAULT true,
  smtp_enabled boolean NOT NULL DEFAULT true,
  sieve_enabled boolean NOT NULL DEFAULT true,
  autoresponder jsonb,
  forward_to citext[] NOT NULL DEFAULT '{}',
  forward_keep_copy boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, local_part)
);

CREATE TABLE aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  source citext NOT NULL,
  destinations citext[] NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, source)
);

CREATE TABLE dkim_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  selector text NOT NULL,
  algorithm text NOT NULL DEFAULT 'ed25519' CHECK (algorithm IN ('rsa2048','ed25519')),
  private_key_enc text NOT NULL,
  public_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','active','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  retired_at timestamptz,
  UNIQUE (domain_id, selector)
);

-- ── Reconciler state ────────────────────────────────────────────────────────

CREATE TABLE dns_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN
    ('mx','spf','dkim','dmarc','verification','mta_sts','tls_rpt',
     'autoconfig','autodiscover','bimi','caa','custom')),
  type text NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  ttl int NOT NULL DEFAULT 300,
  priority int,
  managed boolean NOT NULL DEFAULT true,
  provider_record_id text,
  observed_content text,
  check_status text NOT NULL DEFAULT 'unknown'
    CHECK (check_status IN ('unknown','pending','propagating','ok','drifted','missing','error')),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, purpose, name, type)
);

CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  domains text[] NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mail','web')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','issued','renewing','error','revoked')),
  not_before timestamptz,
  not_after timestamptz,
  acme_order_url text,
  last_error text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','warn','fail')),
  detail jsonb NOT NULL DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX health_checks_domain_idx ON health_checks (domain_id, kind, checked_at DESC);

-- ── Observability & operations ─────────────────────────────────────────────

CREATE TABLE mail_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  domain_id uuid,
  queue_id text,
  message_id text,
  direction text CHECK (direction IN ('inbound','outbound')),
  event text NOT NULL,
  from_addr citext,
  to_addr citext,
  relay text,
  delay_ms int,
  size_bytes int,
  spam_score numeric,
  spam_action text,
  tls_version text,
  dsn text,
  detail text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE TABLE mail_events_default PARTITION OF mail_events DEFAULT;
CREATE INDEX mail_events_queue_idx ON mail_events (queue_id);
CREATE INDEX mail_events_domain_time_idx ON mail_events (domain_id, occurred_at DESC);
CREATE INDEX mail_events_time_brin ON mail_events USING brin (occurred_at);

CREATE TABLE queue_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  active int NOT NULL DEFAULT 0,
  deferred int NOT NULL DEFAULT 0,
  hold int NOT NULL DEFAULT 0,
  oldest_age_s int NOT NULL DEFAULT 0,
  taken_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('full','mail','db')),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  size_bytes bigint,
  snapshot_ref text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip inet NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('fail2ban','manual','country')),
  reason text NOT NULL DEFAULT '',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Data-plane views (the ONLY surface Postfix/Dovecot touch) ──────────────

CREATE VIEW mail_domains AS
  SELECT name::text FROM domains WHERE status = 'active';

CREATE VIEW mail_mailboxes AS
  SELECT (m.local_part || '@' || d.name)::citext AS address, m.domain_id
  FROM mailboxes m
  JOIN domains d ON d.id = m.domain_id
  WHERE m.status = 'active' AND d.status = 'active';

-- Aliases + per-mailbox forwarding + catch-all ('@domain' key), postfix precedence:
-- exact address first, then '@domain'.
CREATE VIEW mail_aliases AS
  SELECT (a.source || '@' || d.name)::citext AS source,
         array_to_string(a.destinations, ',') AS destinations
  FROM aliases a
  JOIN domains d ON d.id = a.domain_id
  WHERE a.enabled AND d.status = 'active'
  UNION ALL
  SELECT (m.local_part || '@' || d.name)::citext AS source,
         array_to_string(
           CASE WHEN m.forward_keep_copy
                THEN m.forward_to || (m.local_part || '@' || d.name)::citext
                ELSE m.forward_to END, ',') AS destinations
  FROM mailboxes m
  JOIN domains d ON d.id = m.domain_id
  WHERE m.status = 'active' AND d.status = 'active'
    AND cardinality(m.forward_to) > 0
  UNION ALL
  SELECT ('@' || d.name)::citext AS source,
         d.catch_all_target::text AS destinations
  FROM domains d
  WHERE d.status = 'active' AND d.catch_all_target IS NOT NULL;

CREATE VIEW mail_auth AS
  SELECT (m.local_part || '@' || d.name)::text AS "user",
         m.password_hash AS password,
         d.name::text AS domain_name,
         m.local_part::text AS local_part,
         m.quota_mb
  FROM mailboxes m
  JOIN domains d ON d.id = m.domain_id
  WHERE m.status = 'active' AND d.status = 'active';

CREATE VIEW mail_sender_login AS
  SELECT (m.local_part || '@' || d.name)::citext AS sender,
         (m.local_part || '@' || d.name)::text AS login
  FROM mailboxes m
  JOIN domains d ON d.id = m.domain_id
  WHERE m.status = 'active' AND d.status = 'active' AND m.smtp_enabled
  UNION ALL
  SELECT (a.source || '@' || d.name)::citext AS sender,
         unnest(a.destinations)::text AS login
  FROM aliases a
  JOIN domains d ON d.id = a.domain_id
  WHERE a.enabled AND d.status = 'active';

-- Restricted data-plane role: SELECT on views only (role created at postgres init)
GRANT SELECT ON mail_domains, mail_mailboxes, mail_aliases, mail_auth, mail_sender_login
  TO mailplane;
