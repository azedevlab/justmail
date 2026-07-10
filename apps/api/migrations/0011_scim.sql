-- 0011_scim: SCIM 2.0 inbound provisioning (Okta/Entra push users & groups).
CREATE TABLE scim_configs (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  token_hash text,
  token_prefix text,
  default_role text NOT NULL DEFAULT 'member'
    CHECK (default_role IN ('owner','admin','member','viewer')),
  group_role_map jsonb NOT NULL DEFAULT '{}',
  deactivate boolean NOT NULL DEFAULT true,
  last_request_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One SCIM resource per provisioned member. id is the SCIM resource id we
-- return to the IdP; user_id links to the underlying JustMail account.
CREATE TABLE scim_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id text,
  user_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  raw jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE UNIQUE INDEX scim_users_org_username_idx
  ON scim_users (org_id, lower(user_name));
CREATE INDEX scim_users_external_idx ON scim_users (org_id, external_id);

CREATE TABLE scim_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id text,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX scim_groups_org_name_idx
  ON scim_groups (org_id, lower(display_name));

CREATE TABLE scim_group_members (
  group_id uuid NOT NULL REFERENCES scim_groups(id) ON DELETE CASCADE,
  scim_user_id uuid NOT NULL REFERENCES scim_users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, scim_user_id)
);
CREATE INDEX scim_group_members_user_idx ON scim_group_members (scim_user_id);
