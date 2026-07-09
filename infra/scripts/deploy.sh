#!/bin/bash
# JustMail deploy — run on the server. Code arrives via rsync (CI) or git (manual).
# Usage: deploy.sh            -> deploy current /opt/justmail/app working tree
#        deploy.sh <git-ref>  -> fetch+checkout ref first (requires git remote access)
set -euo pipefail

APP_DIR=/opt/justmail/app
ENV_FILE=/opt/justmail/.env
REF="${1:-}"

PROFILES=(--profile core --profile certs --profile mail --profile obs --profile sec)
# 'app' profile joins once the application images exist (Phase 11)
if [[ -f "$APP_DIR/infra/docker/api/Dockerfile" ]]; then
  PROFILES+=(--profile app)
fi

[[ -f "$ENV_FILE" ]] || { echo "FATAL: $ENV_FILE missing (copy infra/compose/.env.example)"; exit 1; }

cd "$APP_DIR"
# Service-level `env_file: [.env]` resolves relative to the compose file, and
# rsync --delete wipes anything untracked there — relink every deploy.
ln -sf "$ENV_FILE" "$APP_DIR/infra/compose/.env"

if [[ -n "$REF" ]]; then
  echo "==> Fetching $REF"
  git fetch --all --prune
  git checkout -q --detach "$REF"
fi
echo "==> Deploying $(git rev-parse --short HEAD 2>/dev/null || echo 'rsynced tree')"

compose() {
  docker compose --env-file "$ENV_FILE" -f infra/compose/docker-compose.yml "${PROFILES[@]}" "$@"
}

compose config -q                     # validate before touching anything
compose build --pull

# Fail2Ban refuses to start if its watched log doesn't exist yet
docker run --rm -v justmail_maillog:/log alpine:3.21 touch /log/auth-failures.log

compose up -d --remove-orphans

echo "==> Health check"
sleep 10
FAILED=$(compose ps --format '{{.Name}} {{.State}}' | awk '$2!="running" && $2!="" {print $1}' || true)
if [[ -n "$FAILED" ]]; then
  echo "FAILED services:"
  echo "$FAILED"
  compose ps
  exit 1
fi

docker image prune -f >/dev/null
echo "==> Deploy OK"
