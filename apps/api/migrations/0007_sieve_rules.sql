-- Structured mail filters. Rules are stored as conditions/actions (not raw
-- Sieve) so the UI can round-trip them; the service compiles all enabled rules
-- for a mailbox, ordered by priority, into a single Sieve script uploaded over
-- ManageSieve. script_source caches the per-rule compiled preview for the UI.

CREATE TABLE sieve_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  match text NOT NULL DEFAULT 'all',
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  script_source text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rules are always listed and compiled in priority order per mailbox.
CREATE INDEX sieve_rules_mailbox_priority_idx
  ON sieve_rules (mailbox_id, priority, created_at);
