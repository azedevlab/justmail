-- Mail groups (distribution lists): one address fans a delivered message out to
-- every member. Delivery reuses the Postfix virtual_alias path via the
-- mail_aliases view; sending-as-group is gated by mail_sender_login.

CREATE TABLE IF NOT EXISTS mail_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  local_part citext NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  allow_member_send boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, local_part)
);

CREATE TABLE IF NOT EXISTS mail_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES mail_groups(id) ON DELETE CASCADE,
  address citext NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, address)
);

CREATE INDEX IF NOT EXISTS mail_group_members_group_idx
  ON mail_group_members (group_id);

-- Rebuild mail_aliases with an added branch that expands enabled, non-empty
-- groups. Column list is unchanged so the mailplane GRANT is preserved.
CREATE OR REPLACE VIEW mail_aliases AS
  SELECT (a.source || '@' || d.name)::citext AS source,
         array_to_string(a.destinations, ',') AS destinations
  FROM aliases a
  JOIN domains d ON d.id = a.domain_id
  WHERE a.enabled AND d.status = 'active'
  UNION ALL
  SELECT (m.local_part || '@' || d.name)::citext AS source,
         array_to_string(
           CASE WHEN m.forward_keep_copy
                THEN m.forward_to || (m.local_part || '@' || d.name)::citext
                ELSE m.forward_to END, ',') AS destinations
  FROM mailboxes m
  JOIN domains d ON d.id = m.domain_id
  WHERE m.status = 'active' AND d.status = 'active'
    AND cardinality(m.forward_to) > 0
  UNION ALL
  SELECT ('@' || d.name)::citext AS source,
         d.catch_all_target::text AS destinations
  FROM domains d
  WHERE d.status = 'active' AND d.catch_all_target IS NOT NULL
  UNION ALL
  SELECT (g.local_part || '@' || d.name)::citext AS source,
         string_agg(gm.address::text, ',') AS destinations
  FROM mail_groups g
  JOIN domains d ON d.id = g.domain_id
  JOIN mail_group_members gm ON gm.group_id = g.id
  WHERE g.enabled AND d.status = 'active'
  GROUP BY g.local_part, d.name;

-- Rebuild mail_sender_login so group members may send as the group address when
-- the group opts in.
CREATE OR REPLACE VIEW mail_sender_login AS
  SELECT (m.local_part || '@' || d.name)::citext AS sender,
         (m.local_part || '@' || d.name)::text AS login
  FROM mailboxes m
  JOIN domains d ON d.id = m.domain_id
  WHERE m.status = 'active' AND d.status = 'active' AND m.smtp_enabled
  UNION ALL
  SELECT (a.source || '@' || d.name)::citext AS sender,
         unnest(a.destinations)::text AS login
  FROM aliases a
  JOIN domains d ON d.id = a.domain_id
  WHERE a.enabled AND d.status = 'active'
  UNION ALL
  SELECT (g.local_part || '@' || d.name)::citext AS sender,
         gm.address::text AS login
  FROM mail_groups g
  JOIN domains d ON d.id = g.domain_id
  JOIN mail_group_members gm ON gm.group_id = g.id
  WHERE g.enabled AND g.allow_member_send AND d.status = 'active';
