-- 0012_org_quota: org-level storage allocation ceiling.
-- NULL = unlimited; otherwise the sum of mailbox quota_mb across the org may
-- not exceed this value (enforced at provisioning time in the API).
ALTER TABLE organizations ADD COLUMN storage_quota_mb bigint;
