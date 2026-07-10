-- Personalization for the composer: reusable HTML signatures and message
-- templates. Both are scoped to a single mailbox (the sending identity) so a
-- user manages their own; org_id is carried for tenant isolation on queries.

CREATE TABLE signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  name text NOT NULL,
  html text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX signatures_mailbox_idx ON signatures (mailbox_id);

-- At most one default signature per mailbox; the service demotes the prior
-- default in the same transaction when a new one is promoted.
CREATE UNIQUE INDEX signatures_one_default_idx
  ON signatures (mailbox_id)
  WHERE is_default;

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  html text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX templates_mailbox_idx ON templates (mailbox_id);
