# Database design

Postgres 17 with `citext` and `pgcrypto` extensions. Row-Level Security enabled
on every tenant-scoped table. All timestamps `timestamptz` in UTC. Every
schema change is a versioned migration; migrations checksummed by the runner.

## Tenancy model

- **organizations** — the tenant root.
- **teams** — sub-tenant inside an organization (v1.0 new; groups mailboxes
  for RBAC and quota).
- **users** — global identity; linked to organizations by `org_members`.
- **api_keys** — bearer credentials scoped to one organization.
- **sessions** — cookie-backed session with device fingerprint (v1.0 new).

RLS policies restrict every SELECT/UPDATE/DELETE by `org_id = current_setting('jm.org_id')::uuid`.
The application sets the session variable per request via PgBouncer's
`SET LOCAL`.

## Core schema (v1.0 delta on top of v0's 0001_init)

```sql
-- Tenants -------------------------------------------------------------------
organizations(id, name, slug, plan, settings jsonb, created_at, updated_at)
teams(id, org_id, name, slug, created_at, UNIQUE (org_id, slug))
users(id, email citext UNIQUE, name, password_hash, totp_secret text encoded,
      totp_enabled, status, created_at, updated_at)
org_members(org_id, user_id, role, team_id NULLABLE, PK(org_id, user_id))

-- Identity + credentials ---------------------------------------------------
sessions(id, user_id, token_hash, ip inet, user_agent, device_fingerprint,
         last_seen_at, expires_at, created_at)
webauthn_credentials(id, user_id, credential_id bytea UNIQUE, public_key,
                     counter, name, last_used_at, created_at)
recovery_codes(id, user_id, code_hash, used_at, created_at)
sso_providers(id, org_id, kind text CHECK IN ('oidc','saml'),
              name, config jsonb, active, created_at)
sso_identities(user_id, provider_id, subject text, created_at, PK(user_id, provider_id))
invites(id, org_id, email, role, team_id NULLABLE, token_hash,
        invited_by, expires_at, accepted_at, created_at)
api_keys(id, org_id, name, key_prefix, key_hash, scopes text[],
         last_used_at, expires_at, created_by, created_at, revoked_at)

-- Mail plane ---------------------------------------------------------------
domains(id, org_id, name citext UNIQUE, status, verification_token,
        is_primary, catch_all_target, max_mailboxes, max_quota_mb,
        outbound_mode, retention_days, created_at, updated_at)
mailboxes(id, domain_id, team_id NULLABLE, local_part citext,
          name, password_hash, quota_mb, quota_used_bytes,
          status, imap_enabled, pop3_enabled, smtp_enabled, sieve_enabled,
          autoresponder jsonb, forward_to citext[], forward_keep_copy,
          created_at, updated_at, UNIQUE(domain_id, local_part))
aliases(id, domain_id, source citext, destinations citext[], enabled,
        created_at, updated_at, UNIQUE(domain_id, source))
mailbox_identities(id, mailbox_id, address citext, display_name,
                   signature_id NULLABLE, is_default, UNIQUE(address))
signatures(id, mailbox_id, name, html, text, is_default, created_at)
templates(id, mailbox_id, name, subject, html, text, created_at)
folders(id, mailbox_id, name, path, kind, created_at,
        UNIQUE(mailbox_id, path))  -- mirrors IMAP folders for UI persistence
labels(id, mailbox_id, name, color, created_at)
message_labels(mailbox_id, uid, folder, label_id, PK(mailbox_id, uid, label_id))
snoozes(id, mailbox_id, uid, folder, snooze_until, created_at)
outbox(id, mailbox_id, mime bytea, send_at, status, attempts,
       last_error, message_id, created_at)  -- schedule send + undo send

-- Attachments (metadata; blobs live in object storage) ---------------------
attachments(id, org_id, mailbox_id NULLABLE, message_id NULLABLE,
            content_hash text UNIQUE, filename, mime, size_bytes,
            virus_status text CHECK IN ('pending','clean','infected','error'),
            preview_state text CHECK IN ('none','pending','ready','failed'),
            storage_kind text, storage_key text, created_at)
attachment_refs(attachment_id, referrer_kind, referrer_id, PK(attachment_id, referrer_kind, referrer_id))
uploads(id, org_id, uploader_id, filename, size_bytes, uploaded_bytes,
        offset_bytes, storage_kind, storage_key, expires_at, created_at)
thumbnails(attachment_id, kind, storage_key, width, height, size_bytes, created_at,
           PK(attachment_id, kind))

-- Sieve --------------------------------------------------------------------
sieve_rules(id, mailbox_id, name, priority, script_source, enabled,
            compiled_at, created_at, updated_at)

-- Deliverability ------------------------------------------------------------
dkim_keys(id, domain_id, selector, algorithm, private_key_enc, public_key,
          status, created_at, activated_at, retired_at, UNIQUE(domain_id, selector))
dns_records(id, domain_id, purpose, type, name, content, ttl, priority,
            managed, provider_record_id, observed_content, check_status,
            last_checked_at, created_at, updated_at,
            UNIQUE(domain_id, purpose, name, type))
certificates(id, org_id NULLABLE, domains text[], kind, status,
             not_before, not_after, acme_order_url, last_error,
             storage_path, created_at, updated_at)
dmarc_reports(id, org_id, domain_id NULLABLE, reporter, begin_ts, end_ts,
              pass, fail, raw jsonb, created_at)
dmarc_records(id, report_id, source_ip inet, count int, disposition,
              dkim_result, spf_result, header_from, envelope_from)
dnsbl_checks(id, domain_id NULLABLE, ip inet, bl, hit, checked_at)
warmup_schedules(org_id PK, enabled, started_at, days, daily_limit_start,
                 daily_limit_target)
warmup_counters(org_id, day date, sent int, PK(org_id, day))

-- Reputation ---------------------------------------------------------------
sender_reputation(org_id, day date, sent, bounced, complained, deferred,
                  PK(org_id, day))
recipient_domains(org_id, recipient_domain, sent, bounced, complained,
                  PK(org_id, recipient_domain))

-- Observability ------------------------------------------------------------
mail_events (
  id uuid DEFAULT gen_random_uuid(),
  org_id uuid, domain_id uuid, mailbox_id uuid NULLABLE,
  queue_id text, message_id text, direction text,
  event text NOT NULL,
  from_addr citext, to_addr citext, relay,
  delay_ms int, size_bytes int,
  spam_score numeric, spam_action text,
  tls_version text, dsn text,
  detail text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
-- Monthly partitions created 30 days ahead by a partition-maintainer worker.

queue_snapshots(id, active, deferred, hold, oldest_age_s, taken_at)

audit_logs (
  id uuid, org_id uuid,
  actor_type text, actor_id uuid, action text,
  target_type text, target_id uuid,
  ip inet, meta jsonb, created_at timestamptz,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

events(id, org_id, type, entity_kind, entity_id, payload jsonb, published_at)
  -- inbox pattern for webhook + WS fan-out; retained 7 days.

-- Webhooks -----------------------------------------------------------------
webhook_endpoints(id, org_id, url, events text[], secret_enc, active,
                  last_delivered_at, last_status, failure_count,
                  created_by, created_at)
webhook_deliveries(id, endpoint_id, event, payload jsonb, status int,
                   attempts, next_attempt_at, delivered_at, last_error, created_at)

-- Notifications ------------------------------------------------------------
notifications(id, org_id, user_id, kind, title, body, url, read_at, created_at)
web_push_subs(id, user_id, endpoint, p256dh, auth, ua, created_at)

-- Backups ------------------------------------------------------------------
backup_schedules(org_id PK, destination, kinds text[], retention_days,
                 encryption_key_id, enabled, updated_by, updated_at)
backups(id, org_id NULLABLE, kind, destination, status, size_bytes,
        snapshot_ref, checksum, encryption_key_id, error, started_at,
        finished_at)

-- Security -----------------------------------------------------------------
blocked_ips(id, ip inet UNIQUE, source, reason, expires_at, created_at)
country_blocks(org_id, iso2 char(2), PK(org_id, iso2))
policy_settings(org_id PK, per_domain jsonb, per_org jsonb, updated_at)
rate_limits(id, org_id NULLABLE, kind, key text, window_sec int, capacity int,
            UNIQUE(org_id, kind, key))

-- Plugins ------------------------------------------------------------------
plugins(id, name text UNIQUE, publisher, version, signature, manifest jsonb,
        installed_by, installed_at, disabled_at)
plugin_installs(id, org_id, plugin_id, config jsonb, enabled, updated_at)

-- Themes -------------------------------------------------------------------
themes(id, org_id NULLABLE, domain_id NULLABLE, name, tokens jsonb, css_extra,
       created_by, created_at, updated_at)

-- Contacts / Calendar / Tasks / Notes (v1.0 minimal; *DAV takes over v1.1)
contacts(id, mailbox_id, display, emails text[], phones text[], vcard, updated_at)
calendars(id, mailbox_id, name, color, caldav_url NULLABLE, created_at)
calendar_events(id, calendar_id, uid, dtstart timestamptz, dtend timestamptz,
                summary, description, location, ical, updated_at)
tasks(id, mailbox_id, list, title, notes, due_at, priority, done_at, created_at)
notes(id, mailbox_id, title, body_md, updated_at, created_at)

-- Data-plane views (unchanged from v0, expanded) --------------------------
CREATE VIEW mail_domains AS SELECT name::text FROM domains WHERE status='active';
-- mail_mailboxes / mail_auth / mail_aliases / mail_sender_login: same shape as v0,
-- plus new mail_policy view that surfaces country blocks + warmup caps
-- consumed by a postfix policy service.
```

## Indexes (excerpt)

```sql
CREATE INDEX org_members_user_idx ON org_members(user_id);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at)
  WHERE expires_at > now();
CREATE INDEX api_keys_org_idx ON api_keys(org_id) WHERE revoked_at IS NULL;
CREATE INDEX domains_org_idx ON domains(org_id);
CREATE INDEX mailboxes_domain_idx ON mailboxes(domain_id);
CREATE INDEX mailboxes_status_idx ON mailboxes(status)
  WHERE status <> 'active';
CREATE INDEX attachments_hash_idx ON attachments(org_id, content_hash);
CREATE INDEX attachments_virus_pending
  ON attachments(id) WHERE virus_status='pending';
CREATE INDEX mail_events_org_time_idx ON mail_events(org_id, occurred_at DESC);
CREATE INDEX mail_events_time_brin ON mail_events USING brin(occurred_at);
CREATE INDEX mail_events_queue_idx ON mail_events(queue_id);
CREATE INDEX audit_logs_org_time_idx ON audit_logs(org_id, created_at DESC);
CREATE INDEX webhook_deliveries_pending
  ON webhook_deliveries(next_attempt_at)
  WHERE delivered_at IS NULL;
CREATE INDEX notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX outbox_pending
  ON outbox(mailbox_id, send_at) WHERE status='queued';
```

## Row-Level Security

```sql
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_mailboxes ON mailboxes
  USING (
    EXISTS (
      SELECT 1 FROM domains d
      WHERE d.id = mailboxes.domain_id
        AND d.org_id = current_setting('jm.org_id', true)::uuid
    )
  );
-- Analogous policies on every table with an org_id or a transitive one.
```

The Nest layer sets `SET LOCAL jm.org_id = '…'` at the start of every
transaction on the app connection pool. The mail-plane role (`mailplane`)
bypasses RLS because its views are already gated by status filters.

## Migration policy

- Files named `NNNN_short_name.sql` under `apps/api/migrations/`.
- Runner: transactional per file where possible; opts out with a marker
  comment `-- migrate: notx`.
- Ledger: `schema_migrations(version, applied_at, checksum)`. Refuse to run
  a file whose checksum differs from ledger.
- Destructive migrations (drops, type narrows, non-null on populated
  columns) require the operator to pass `--allow-destructive` and a fresh
  backup id.
- Baseline detection: on first boot against an existing v0 DB, the runner
  records the previously-applied migrations as `synthetic` so it doesn't
  re-run them.

## Data retention (defaults, per-domain overrideable)

| Table | Retention | Trigger |
|---|---|---|
| mail_events | 180 days | partition drop |
| audit_logs | 400 days | partition drop |
| webhook_deliveries | 30 days | partition drop |
| events | 7 days | scheduled delete |
| dmarc_reports | 400 days | scheduled delete |
| dnsbl_checks | 30 days | scheduled delete |
| queue_snapshots | 7 days | scheduled delete |
| notifications | 60 days | scheduled delete |
| sessions | until expiry | expiry job |
| uploads (incomplete) | 24 h | expiry job |

## GDPR primitives

- Every table with a user link stores `owner_id` derivable via join.
- `user-data --export <user>` walks the graph and streams JSON+attachments.
- `user-data --delete <user>` runs a scripted DELETE in FK-safe order and
  removes owned attachments from the storage adapter.
- Retention overrides via `policy_settings` per domain (compliance friendly).

## Views for the mail plane

Extended from v0 to add policy joins:

```sql
CREATE OR REPLACE VIEW mail_policy AS
  SELECT
    d.name AS domain,
    d.outbound_mode,
    COALESCE(w.days, 0) AS warmup_days,
    COALESCE(w.daily_limit_start, 0) AS warmup_start,
    COALESCE(w.daily_limit_target, 0) AS warmup_target,
    ARRAY(SELECT iso2 FROM country_blocks WHERE org_id = d.org_id) AS country_blocks
  FROM domains d
  LEFT JOIN warmup_schedules w ON w.org_id = d.org_id
  WHERE d.status = 'active';
```

Postfix consults this via a policy service (`smtpd_policy_service`) which
runs inside the api container, reads a redis-cached snapshot, and reloads
on postgres NOTIFY.
