#!/bin/bash
# Runs once on first postgres boot: create the restricted data-plane role.
# Postfix/Dovecot connect as 'mailplane' and may only SELECT dedicated views
# (grants happen in API migrations when the views are created).
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE mailplane LOGIN PASSWORD '${MAILPLANE_DB_PASSWORD}';
  REVOKE ALL ON SCHEMA public FROM mailplane;
  GRANT USAGE ON SCHEMA public TO mailplane;
EOSQL
