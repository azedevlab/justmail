-- Org (and optional per-domain) branding themes. Tokens are compiled by
-- @justmail/theme-engine into scoped CSS custom properties at read time; the
-- admin app injects them under [data-org="<id>"] so the whole console re-skins
-- to the org's brand. One default theme per org (domain_id IS NULL) plus at
-- most one override per domain.

CREATE TABLE IF NOT EXISTS themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  tokens jsonb NOT NULL,
  css_extra text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- NULLs are distinct in a plain UNIQUE, so enforce the "one default per org" and
-- "one per domain" invariants with two partial unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS themes_one_default_per_org
  ON themes (org_id)
  WHERE domain_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS themes_one_per_domain
  ON themes (domain_id)
  WHERE domain_id IS NOT NULL;
