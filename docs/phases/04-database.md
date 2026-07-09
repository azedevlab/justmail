# Phase 4 — Database design

PostgreSQL 17. Plain-SQL migrations (`apps/api/src/db/migrations`), advisory-locked on
API boot. Two consumers: the NestJS control plane (full access) and the mail data plane
(Postfix/Dovecot via a **restricted role reading dedicated views only** — see §4).

Conventions: `uuid` PKs (v7), `timestamptz` everywhere, `created_at/updated_at` on all
tables, soft state via `status` enums (no soft-delete columns; audit log preserves history).

## 1. Identity & tenancy

```sql
organizations (
  id uuid PK, name text, slug text UNIQUE,
  plan text DEFAULT 'free', settings jsonb DEFAULT '{}',
  created_at, updated_at
)

users (                                   -- control-plane logins, NOT mailboxes
  id uuid PK, email citext UNIQUE, name text,
  password_hash text,                     -- argon2id
  totp_secret text NULL, totp_enabled bool DEFAULT false,
  status text CHECK (status IN ('active','suspended','invited')),
  created_at, updated_at
)

org_members (
  org_id uuid FK, user_id uuid FK,
  role text CHECK (role IN ('owner','admin','member','viewer')),
  PRIMARY KEY (org_id, user_id)
)

sessions (
  id uuid PK, user_id uuid FK, token_hash text UNIQUE,
  ip inet, user_agent text, expires_at timestamptz, created_at
)

api_keys (
  id uuid PK, org_id uuid FK, name text,
  key_prefix text,                        -- "jm_live_abc1" shown in UI
  key_hash text UNIQUE,                   -- sha256 of full key
  scopes text[],                          -- ['domains:read','mailboxes:write',...]
  last_used_at timestamptz NULL, expires_at timestamptz NULL,
  created_by uuid FK users, created_at, revoked_at timestamptz NULL
)

audit_logs (                              -- append-only, no updates/deletes
  id uuid PK, org_id uuid FK, actor_type text,  -- 'user'|'api_key'|'system'
  actor_id uuid NULL, action text,        -- 'mailbox.create', 'dns.repair', ...
  target_type text, target_id uuid NULL,
  ip inet NULL, meta jsonb, created_at
) PARTITION BY RANGE (created_at);        -- monthly partitions
```

## 2. Mail objects (desired state)

```sql
domains (
  id uuid PK, org_id uuid FK, name citext UNIQUE,       -- 'example.com'
  status text CHECK (status IN ('pending_verification','verifying','active','suspended')),
  verification_token text,                              -- TXT _justmail-verify
  is_primary bool DEFAULT false,
  catch_all_target citext NULL,                         -- rcpt for catch-all, NULL = off
  max_mailboxes int NULL, max_quota_mb bigint NULL,     -- org-imposed limits
  outbound_mode text DEFAULT 'inherit',                 -- inherit|direct|smarthost
  created_at, updated_at
)

mailboxes (
  id uuid PK, domain_id uuid FK,
  local_part citext,                                    -- 'alice'
  UNIQUE (domain_id, local_part),
  address citext GENERATED,                             -- 'alice@example.com'
  name text, password_hash text,                        -- argon2id (dovecot-compatible)
  quota_mb bigint DEFAULT 1024, quota_used_bytes bigint DEFAULT 0,  -- updated by dovecot dict
  status text CHECK (status IN ('active','suspended','disabled')),
  imap_enabled bool DEFAULT true, pop3_enabled bool DEFAULT true,
  smtp_enabled bool DEFAULT true, sieve_enabled bool DEFAULT true,
  autoresponder jsonb NULL,       -- {enabled, subject, body, starts_at, ends_at}
  forward_to citext[] DEFAULT '{}', forward_keep_copy bool DEFAULT true,
  created_at, updated_at
)

aliases (
  id uuid PK, domain_id uuid FK,
  source citext,                  -- 'sales' or '*' handled via domains.catch_all_target
  UNIQUE (domain_id, source),
  destinations citext[] NOT NULL, -- multiple targets = distribution list
  enabled bool DEFAULT true, created_at, updated_at
)

dkim_keys (
  id uuid PK, domain_id uuid FK,
  selector text,                  -- 'jm2026a'
  UNIQUE (domain_id, selector),
  algorithm text DEFAULT 'ed25519' CHECK (algorithm IN ('rsa2048','ed25519')),
  private_key_enc text,           -- encrypted at rest (app-level AES-GCM, key from env)
  public_key text,
  status text CHECK (status IN ('pending','published','active','retired')),
  created_at, activated_at timestamptz NULL, retired_at timestamptz NULL
)
```

## 3. Desired vs observed state (reconciler)

```sql
dns_records (                     -- desired state, per domain
  id uuid PK, domain_id uuid FK,
  purpose text,                   -- 'mx'|'spf'|'dkim'|'dmarc'|'verification'|'mta_sts'|
                                  -- 'tls_rpt'|'autoconfig'|'autodiscover'|'bimi'|'caa'|'custom'
  type text, name text, content text, ttl int DEFAULT 300, priority int NULL,
  managed bool DEFAULT true,      -- false = user-defined custom record
  provider_record_id text NULL,   -- Cloudflare record id once created
  observed_content text NULL,     -- last value seen at provider
  check_status text CHECK (check_status IN ('unknown','pending','propagating','ok','drifted','missing','error')),
  last_checked_at timestamptz NULL,
  UNIQUE (domain_id, purpose, name, type)
)

certificates (
  id uuid PK, org_id uuid FK NULL,
  domains text[] NOT NULL,        -- SANs: ['mail.example.com','mta-sts.example.com',...]
  kind text CHECK (kind IN ('mail','web')),
  status text CHECK (status IN ('pending','issued','renewing','error','revoked')),
  not_before timestamptz, not_after timestamptz,
  acme_order_url text NULL, last_error text NULL,
  storage_path text,              -- path inside certs volume
  created_at, updated_at
)

health_checks (                   -- domain health snapshots (rDNS, MX reachability,
  id uuid PK, domain_id uuid FK,  --  blocklists, DNSSEC, MTA-STS fetch, cert expiry)
  kind text, status text CHECK (status IN ('pass','warn','fail')),
  detail jsonb, checked_at timestamptz
)
```

## 4. Data-plane contract: views for Postfix/Dovecot

A dedicated PG role `mailplane` has `SELECT` on these views **only** (no tables). This is
the entire surface area between data plane and database — stable even if tables evolve.

```sql
-- Postfix virtual_mailbox_domains
CREATE VIEW mail_domains AS
  SELECT name FROM domains WHERE status = 'active';

-- Postfix virtual_mailbox_maps
CREATE VIEW mail_mailboxes AS
  SELECT address, domain_id FROM mailboxes m
  JOIN domains d ON d.id = m.domain_id
  WHERE m.status = 'active' AND d.status = 'active';

-- Postfix virtual_alias_maps (aliases + forwarding + catch-all, precedence in SQL)
CREATE VIEW mail_aliases AS ...;   -- source address → comma-joined destinations

-- Dovecot passdb/userdb
CREATE VIEW mail_auth AS
  SELECT address AS "user", password_hash AS password,
         quota_mb, m.id AS mailbox_uuid, maildir_path(...)
  FROM mailboxes m JOIN domains d ...
  WHERE m.status = 'active' AND d.status = 'active';

-- Postfix sender_login_maps (SASL user may send as address/aliases)
CREATE VIEW mail_sender_login AS ...;

-- Postfix relayhost decision (outbound_mode + settings)
CREATE VIEW mail_transport AS ...;
```

Suspending a mailbox/domain in the UI = row disappears from views = auth and delivery
stop instantly. **This is the mechanism behind "never edit a config file".**

## 5. Observability & operations

```sql
mail_events (                     -- parsed from postfix/dovecot logs by Vector→API
  id uuid PK, org_id uuid NULL, domain_id uuid NULL,
  queue_id text,                  -- postfix queue id, correlates event chains
  message_id text NULL, direction text CHECK (direction IN ('inbound','outbound')),
  event text,                     -- 'accepted'|'queued'|'delivered'|'deferred'|'bounced'|
                                  -- 'rejected'|'quarantined'|'expired'
  from_addr citext NULL, to_addr citext NULL,
  relay text NULL, delay_ms int NULL, size_bytes int NULL,
  spam_score numeric NULL, spam_action text NULL,      -- from rspamd
  tls_version text NULL, dsn text NULL, detail text NULL,
  occurred_at timestamptz
) PARTITION BY RANGE (occurred_at);                    -- daily partitions, 90d retention

queue_snapshots (                 -- polled `postqueue -j` summary for dashboard trend
  id bigserial PK, active int, deferred int, hold int,
  oldest_age_s int, taken_at timestamptz
)

backups (
  id uuid PK, kind text CHECK (kind IN ('full','mail','db')),
  destination text,               -- 's3://bucket/...' | 'local'
  status text CHECK (status IN ('running','completed','failed')),
  size_bytes bigint NULL, snapshot_ref text NULL, error text NULL,
  started_at, finished_at timestamptz NULL
)

settings (                        -- platform-wide config (smarthost, limits, branding)
  key text PK, value jsonb, updated_by uuid NULL, updated_at
)

blocked_ips (
  id uuid PK, ip inet UNIQUE, source text,   -- 'fail2ban'|'manual'|'country'
  reason text, expires_at timestamptz NULL, created_at
)
```

## 6. Indexing & scale notes

- `mail_events`: BRIN on `occurred_at`, btree on `(queue_id)`, `(domain_id, occurred_at)`;
  daily partitions dropped after retention — the only high-write table.
- `mailboxes.address`, `aliases.source`: covering indexes — these back the hot
  data-plane view lookups (every SMTP RCPT does one).
- Dovecot writes `quota_used_bytes` via its dict-sql backend — the only data-plane write,
  isolated to one column via a security-barrier updatable view.
- Millions of mailboxes = single PG comfortably; `mail_events` volume is the scaling
  pressure point → partitioning from day one, Loki keeps raw logs so events can stay lean.
