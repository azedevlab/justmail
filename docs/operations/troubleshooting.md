# Troubleshooting

Start here when something is off. For incident playbooks (Postgres failover,
mail blocked, cert issuance, DNS drift) see [runbooks/](../runbooks/).

## Inspect the stack

```bash
cd /opt/justmail/app/services/compose
docker compose --env-file /opt/justmail/.env ps          # service states
docker compose --env-file /opt/justmail/.env logs -f api  # follow a service
```

Swap `api` for `worker`, `postfix`, `dovecot`, `postgres`, `redis`, etc.

## API won't start

- **Config validation error at boot.** The API validates `/opt/justmail/.env`
  and fails fast. The log line names the missing/invalid variable — fix it in
  `.env` and restart. Compare against `services/compose/.env.example`.
- **Cannot reach the database.** Check `DATABASE_URL` and that the `postgres`
  container is `running`.

## Migrations

Applied migrations are recorded in `schema_migrations`:

```bash
docker compose --env-file /opt/justmail/.env exec postgres \
  psql -U justmail -d justmail -c \
  "SELECT filename, applied_at FROM schema_migrations ORDER BY filename DESC LIMIT 5;"
```

If a migration failed midway, the container exits on boot with the SQL error —
fix the cause (usually a manual DB edit) and restart; migrations re-run only
the unapplied files.

## Mail not sending or receiving

- Confirm **outbound port 25** is open from the host (many providers block it).
- Check **DNS Center** in the admin console for unpublished/failed records.
- See the [mail-blocked runbook](../runbooks/mail-blocked.md) and
  [dns-drift runbook](../runbooks/dns-drift.md).

## Backups failing

- The run row's status shows `failed` with the error. Common causes:
  - `pg_dump`/`pg_restore` missing — the image needs `postgresql-client`
    matching the server major, or set `PG_DUMP_BIN`/`PG_RESTORE_BIN`.
  - Object storage unreachable from the worker — check `STORAGE_*` settings.
- Exports/retention/legal-hold features are disabled until a Dovecot master
  user (`DOVECOT_MASTER_USER`/`DOVECOT_MASTER_PASSWORD`) is configured; the UI
  shows a warning when it is not.

## Webmail can't connect

- Webmail opens an IMAP session per user against Dovecot. Check the `dovecot`
  container is `running` and `IMAP_HOST`/`IMAP_PORT` are correct.
- A stale unlocked-credential entry expires after
  `WEBMAIL_CREDENTIAL_TTL_SECONDS` of inactivity; re-authenticate.

## Health checks

```bash
curl -fsS https://api.<domain>/v1/healthz     # API
open https://api.<domain>/v1/docs             # rendered API reference
```

Observability dashboards and alerts are described in
[docs/redesign/10-deployment.md](../redesign/10-deployment.md).
