#!/bin/bash
# Nightly backup: postgres dump + maildir snapshot -> S3-compatible target.
# Requires: AWS_* or S3-compatible creds in /opt/justmail/.env, `aws` CLI or rclone.
set -euo pipefail

ENV_FILE=/opt/justmail/.env
# shellcheck source=/dev/null
source "$ENV_FILE"
STAMP=$(date -u +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "==> pg_dump"
docker compose --env-file "$ENV_FILE" -f /opt/justmail/app/infra/compose/docker-compose.yml \
  exec -T postgres pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB" > "$WORK/db-$STAMP.dump"

echo "==> maildir snapshot"
docker run --rm -v justmail_vmail:/var/vmail:ro -v "$WORK":/out alpine \
  tar -cf - -C /var/vmail . | zstd -T0 -o "$WORK/vmail-$STAMP.tar.zst"

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  echo "==> upload to $BACKUP_S3_URI"
  aws s3 cp "$WORK/db-$STAMP.dump" "$BACKUP_S3_URI/db/" --only-show-errors
  aws s3 cp "$WORK/vmail-$STAMP.tar.zst" "$BACKUP_S3_URI/vmail/" --only-show-errors
else
  mkdir -p /opt/justmail/backups
  mv "$WORK"/db-*.dump "$WORK"/vmail-*.tar.zst /opt/justmail/backups/
  find /opt/justmail/backups -mtime +7 -delete
fi
echo "==> backup $STAMP done"
