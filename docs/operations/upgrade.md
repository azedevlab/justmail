# Upgrades

JustMail ships as a set of container images built from the repo. Upgrading is:
pull the new tree, rebuild, and bring the stack back up. Schema migrations
apply automatically when the new `api`/`worker` containers start.

## Before you upgrade

1. **Take a fresh backup.** Admin console → **Backups** → *Back up now*. See
   [backup & restore](backup-restore.md).
2. Read the [CHANGELOG](../../CHANGELOG.md) for the target release and note any
   breaking changes or new required `.env` settings.

## Upgrade (managed host)

```bash
cd /opt/justmail/app
sudo git fetch --all --prune
sudo git checkout <tag-or-main>
sudo bash scripts/deploy.sh
```

`deploy.sh` validates the compose file, rebuilds images with `--pull`, and
recreates services. It then runs a health check and exits non-zero if any
service fails to reach `running`.

## What happens to the database

Migrations are idempotent and forward-only. They run at container startup,
tracked in the `schema_migrations` table (applied files are never re-run).
There is no manual migration command and no down-migrations — roll back by
restoring a backup, not by reversing a migration.

## Rollback

If a release misbehaves:

```bash
cd /opt/justmail/app
sudo git checkout <previous-tag>
sudo bash scripts/deploy.sh
```

If the new release applied migrations that the old code cannot read, restore
the pre-upgrade backup (org owner → **Backups** → **Restore**) after checking
out the previous tag.

## Zero-ish downtime

A single-node deploy briefly recreates containers. For minimal interruption,
run the database and object storage externally (managed Postgres + S3) so app
containers are stateless and can be recreated quickly. Multi-node topology is
covered in [docs/multi-node.md](../multi-node.md).
