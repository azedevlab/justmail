-- Mailbox-first webmail login: a session can be bound to a single mailbox so the
-- account's own address + password logs straight into that inbox. The session
-- still anchors to a users row (a lightweight identity row per mailbox) so the
-- existing session/audit plumbing is unchanged; mailbox_id records the binding
-- and drives per-mailbox isolation in the webmail read path.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES mailboxes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sessions_mailbox_idx ON sessions (mailbox_id);
