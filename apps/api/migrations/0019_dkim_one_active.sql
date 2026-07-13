-- Enforce the "exactly one active DKIM key per domain" invariant at the database
-- level instead of relying on read-then-write application logic (which could
-- race two activations into two active keys, or zero — a signing outage).

-- Defensively resolve any pre-existing duplicates first so the unique index can
-- be created: keep the most-recently-activated active key per domain, retire the
-- rest.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY domain_id
           ORDER BY activated_at DESC NULLS LAST, created_at DESC
         ) AS rn
  FROM dkim_keys
  WHERE status = 'active'
)
UPDATE dkim_keys k
   SET status = 'retired', retired_at = now()
  FROM ranked
 WHERE k.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX dkim_one_active_per_domain
  ON dkim_keys (domain_id)
  WHERE status = 'active';
