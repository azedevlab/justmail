-- 0022_bimi: brand logo (BIMI) storage key per domain.
-- Points at the org-prefixed StorageService object that the public
-- .well-known/bimi-logo.svg route streams. NULL = no logo uploaded yet, so
-- the seeded default._bimi TXT record's l= URL resolves to a 404 until set.
ALTER TABLE domains ADD COLUMN IF NOT EXISTS bimi_logo_key text;
