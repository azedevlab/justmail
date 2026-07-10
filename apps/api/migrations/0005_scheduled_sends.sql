-- Deferred outbound mail: powers the undo-send window (a short delay before
-- dispatch) and user-scheduled send (send_at in the future). A background
-- worker claims due rows and dispatches them. The mailbox password is sealed
-- with the platform key so a claimed row can authenticate to SMTP without a
-- live interactive session, and the row is kept only until it is sent.

CREATE TABLE scheduled_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  from_address text NOT NULL,
  sealed_password text NOT NULL,
  payload jsonb NOT NULL,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- The worker polls for due work: pending rows past send_at, plus 'sending' rows
-- that a crashed dispatch left stranded (reclaimed after a timeout).
CREATE INDEX scheduled_sends_due_idx
  ON scheduled_sends (send_at)
  WHERE status IN ('pending', 'sending');

-- Listing a mailbox's outstanding scheduled sends.
CREATE INDEX scheduled_sends_mailbox_idx
  ON scheduled_sends (mailbox_id, status);
