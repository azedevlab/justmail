-- 0013_retention: message retention policy, legal holds, and mailbox exports.
-- Retention pruning and export both reach Dovecot as a master user; when the
-- master credential is unset these features degrade to read-only/no-op.

CREATE TABLE retention_policies (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  -- Messages older than this many days are expunged. NULL/0 = keep forever.
  delete_after_days int,
  -- Folders the policy prunes. Empty applies to nothing (safe default).
  folders text[] NOT NULL DEFAULT '{Trash,Junk}',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL mailbox_id = the entire org is held.
  mailbox_id uuid REFERENCES mailboxes(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX legal_holds_org_active_idx
  ON legal_holds (org_id) WHERE released_at IS NULL;

CREATE TABLE mailbox_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'mbox' CHECK (format IN ('mbox')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','done','error')),
  message_count int NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_key text,
  error text,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX mailbox_exports_org_idx
  ON mailbox_exports (org_id, created_at DESC);
