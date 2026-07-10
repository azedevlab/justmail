-- Attachment metadata + resumable upload state. Blobs live in the storage
-- adapter; content_hash is sha256(payload) so we can dedupe per org.

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mailbox_id uuid REFERENCES mailboxes(id) ON DELETE SET NULL,
  message_id text,
  content_hash text NOT NULL,
  filename text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL,
  virus_status text NOT NULL DEFAULT 'pending'
    CHECK (virus_status IN ('pending','clean','infected','error')),
  preview_state text NOT NULL DEFAULT 'none'
    CHECK (preview_state IN ('none','pending','ready','failed')),
  storage_kind text NOT NULL,
  storage_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, content_hash)
);
CREATE INDEX attachments_org_created_idx ON attachments (org_id, created_at DESC);
CREATE INDEX attachments_virus_pending_idx
  ON attachments (id) WHERE virus_status = 'pending';

CREATE TABLE attachment_refs (
  attachment_id uuid NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  referrer_kind text NOT NULL CHECK (referrer_kind IN ('draft','message','signature','theme')),
  referrer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, referrer_kind, referrer_id)
);

CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_bytes bigint NOT NULL DEFAULT 0,
  offset_bytes bigint NOT NULL DEFAULT 0,
  storage_kind text NOT NULL,
  storage_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX uploads_org_idx ON uploads (org_id);
CREATE INDEX uploads_expiry_idx ON uploads (expires_at);

CREATE TABLE thumbnails (
  attachment_id uuid NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  storage_key text NOT NULL,
  width int NOT NULL,
  height int NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, kind)
);
