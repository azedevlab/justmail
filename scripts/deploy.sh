#!/usr/bin/env bash
# Server-side deploy script. Invoked by CI (via rsync + ssh) or manually.
#
# Usage:
#   deploy.sh              → deploy current /opt/justmail/app working tree
#   deploy.sh <git-ref>    → fetch + check out ref first
set -euo pipefail

APP_DIR=/opt/justmail/app
ENV_FILE=/opt/justmail/.env
REF="${1:-}"

PROFILES=(--profile core --profile certs --profile mail --profile obs --profile sec)
# The `app` profile joins once the application images can build (all v1.0
# packages present).
if [[ -f "$APP_DIR/services/docker/api/Dockerfile" ]]; then
  PROFILES+=(--profile app)
fi
# Self-hosted object storage: bring up MinIO + the one-shot bucket init only
# when this deploy actually selects it, so local / external-S3 deploys don't
# run an unused MinIO. The bucket-init container exits 0 once done; `compose ps`
# (without -a) hides exited containers, so the health check won't flag it.
if [[ -f "$ENV_FILE" ]] && grep -qE '^STORAGE_KIND=minio[[:space:]]*$' "$ENV_FILE"; then
  PROFILES+=(--profile storage)
fi

[[ -f "$ENV_FILE" ]] || { echo "FATAL: $ENV_FILE missing (copy services/compose/.env.example)"; exit 1; }

cd "$APP_DIR"

# Service-level `env_file: [.env]` resolves relative to the compose file, and
# rsync --delete wipes anything untracked there — relink every deploy.
ln -sf "$ENV_FILE" "$APP_DIR/services/compose/.env"

if [[ -n "$REF" ]]; then
  echo "==> Fetching $REF"
  git fetch --all --prune
  git checkout -q --detach "$REF"
fi
echo "==> Deploying $(git rev-parse --short HEAD 2>/dev/null || echo 'rsynced tree')"

compose() {
  docker compose --env-file "$ENV_FILE" \
    -f services/compose/docker-compose.yml \
    "${PROFILES[@]}" "$@"
}

compose config -q                     # validate before touching anything
compose build --pull

# Fail2Ban refuses to start if its watched log doesn't exist yet
docker run --rm -v justmail_maillog:/log alpine:3.21 touch /log/auth-failures.log

compose up -d --remove-orphans

echo "==> Health check"
sleep 15
FAILED=$(compose ps --format '{{.Name}} {{.State}}' | awk '$2!="running" && $2!="" {print $1}' || true)
if [[ -n "$FAILED" ]]; then
  echo "FAILED services:"
  echo "$FAILED"
  compose ps
  exit 1
fi

echo "==> SIEVE-DIAG effective config"
compose exec -T dovecot doveconf -n 2>&1 | grep -iE 'protocol|mail_plugins|sieve|submission_host|postmaster|mail_home|mail_location' || true
echo "==> SIEVE-DIAG recent dovecot log"
compose logs --tail=200 --no-color dovecot 2>&1 | grep -iE 'sieve|lmtp|error|warn|deprecat|permission|plugin' | tail -80 || true

docker image prune -f >/dev/null
echo "==> Deploy OK"
