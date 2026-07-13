-- Self-service profile pictures. The image bytes live in the storage adapter
-- under avatars/mailbox/<id>.<ext>; only the relative path and a change stamp
-- are tracked here. Shown in webmail and served as this sender's avatar to
-- other JustMail users who received their mail.

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz;
