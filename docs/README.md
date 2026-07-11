# JustMail documentation

Every doc here is rendered on the marketing site under `/docs/<version>/`.
Source is the truth; the site refreshes on merge to `main`.

## Reading order for operators

1. [operations/quickstart.md](operations/quickstart.md) — install in ~15 minutes
2. [architecture.md](architecture.md) — how the pieces fit together
3. [operations/backup-restore.md](operations/backup-restore.md) — scheduled backups + restore
4. [operations/upgrade.md](operations/upgrade.md) — move to a new release safely
5. [operations/troubleshooting.md](operations/troubleshooting.md) — when something is off
6. [redesign/10-deployment.md](redesign/10-deployment.md) — topology + observability
7. [runbooks/](runbooks/) — playbooks for when things go sideways

The API reference is served live at `/v1/docs` (rendered) and
`/v1/openapi.json` (raw OpenAPI 3.1).

## Reading order for contributors

1. [../CONTRIBUTING.md](../CONTRIBUTING.md)
2. [redesign/06-architecture.md](redesign/06-architecture.md)
3. [redesign/09-api.md](redesign/09-api.md)
4. [redesign/12-testing.md](redesign/12-testing.md)

## Reading order for auditors

1. [redesign/05-security.md](redesign/05-security.md)
2. [redesign/08-database.md](redesign/08-database.md) — RLS + partition policy
3. [../SECURITY.md](../SECURITY.md)
4. Runbooks
