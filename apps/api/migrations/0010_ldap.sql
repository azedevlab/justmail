-- 0010_ldap: per-org LDAP/AD directory synchronisation.
CREATE TABLE ldap_directories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 389,
  encryption text NOT NULL DEFAULT 'starttls'
    CHECK (encryption IN ('none','starttls','ldaps')),
  verify_tls boolean NOT NULL DEFAULT true,
  bind_dn text NOT NULL,
  bind_password_enc text,
  base_dn text NOT NULL,
  user_filter text NOT NULL,
  group_filter text,
  email_attribute text NOT NULL DEFAULT 'mail',
  name_attribute text NOT NULL DEFAULT 'cn',
  uid_attribute text NOT NULL DEFAULT 'uid',
  member_attribute text NOT NULL DEFAULT 'memberOf',
  group_role_map jsonb NOT NULL DEFAULT '{}',
  default_role text NOT NULL DEFAULT 'member'
    CHECK (default_role IN ('owner','admin','member','viewer')),
  deactivate_missing boolean NOT NULL DEFAULT true,
  sync_interval_minutes integer NOT NULL DEFAULT 60,
  last_synced_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ldap_directories_org_idx ON ldap_directories (org_id);

CREATE TABLE ldap_identities (
  directory_id uuid NOT NULL REFERENCES ldap_directories(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (directory_id, external_id)
);
CREATE INDEX ldap_identities_user_idx ON ldap_identities (user_id);

CREATE TABLE ldap_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id uuid NOT NULL REFERENCES ldap_directories(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','ok','error')),
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  deactivated_count integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX ldap_sync_runs_dir_idx ON ldap_sync_runs (directory_id, started_at DESC);
