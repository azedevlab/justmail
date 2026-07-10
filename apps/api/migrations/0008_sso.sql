-- 0008_sso: per-org OIDC/SAML single sign-on.

-- Externally-authenticated users have no local password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- An org may register one or more identity providers. Non-secret config lives
-- in `config` (jsonb); the OIDC client_secret is sealed into `secret_enc`.
CREATE TABLE sso_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('oidc','saml')),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  -- Email domain used to route login (user@domain → this provider).
  email_domain citext,
  -- Provision a JustMail account on first successful login.
  auto_provision boolean NOT NULL DEFAULT true,
  default_role text NOT NULL DEFAULT 'member'
    CHECK (default_role IN ('owner','admin','member','viewer')),
  config jsonb NOT NULL DEFAULT '{}',
  secret_enc text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sso_providers_org_idx ON sso_providers (org_id);
-- At most one enabled provider claims a given email domain.
CREATE UNIQUE INDEX sso_providers_domain_idx ON sso_providers (email_domain)
  WHERE email_domain IS NOT NULL AND enabled;

-- Links an IdP subject to a local user, per provider.
CREATE TABLE sso_identities (
  provider_id uuid NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, subject)
);
CREATE INDEX sso_identities_user_idx ON sso_identities (user_id);

-- Transient per-login flow state (CSRF, PKCE, nonce, relay target). Rows are
-- single-use and expire; a sweep on read is enough for this low volume.
CREATE TABLE sso_login_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  code_verifier text,
  nonce text,
  relay_target text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sso_login_flows_expiry_idx ON sso_login_flows (expires_at);
