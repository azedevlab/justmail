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

echo "==> SIEVE-DIAG comprehensive"
MBOX=$(compose exec -T dovecot sh -c 'ls -d /var/vmail/*/* 2>/dev/null | head -1' | tr -d "\r")
echo "SIEVE-DIAG mailbox dir: [$MBOX]"
if [[ -n "$MBOX" ]]; then
  DOM=$(basename "$(dirname "$MBOX")")
  LP=$(basename "$MBOX")
  ADDR="$LP@$DOM"
  echo "SIEVE-DIAG test recipient: $ADDR"
  echo "SIEVE-DIAG --- active-script filesystem state ---"
  compose exec -T dovecot sh -c "ls -la '$MBOX/.dovecot.sieve' 2>&1; echo '-- sieve dir --'; ls -la '$MBOX/sieve/' 2>&1" || true
  echo "SIEVE-DIAG --- sieve-test engine run on active script ---"
  compose exec -T dovecot sh -c "printf 'Subject: SIEVEDIAG\r\n\r\nbody\r\n' > /tmp/d.eml; sieve-test '$MBOX/.dovecot.sieve' /tmp/d.eml 2>&1 | tail -25" || true
  echo "SIEVE-DIAG --- live LMTP delivery test ---"
  compose exec -T postfix sh -c "printf 'From: diag@$DOM\r\nTo: $ADDR\r\nSubject: SIEVEDIAG-live\r\n\r\nbody\r\n' | sendmail -f 'diag@$DOM' '$ADDR'" || true
  sleep 5
  echo "SIEVE-DIAG --- dovecot lmtp log lines ---"
  compose logs --tail=250 --no-color dovecot 2>&1 | grep -iE 'lmtp\(|sieve:' | tail -25 || true
fi

docker image prune -f >/dev/null
echo "==> Deploy OK"
