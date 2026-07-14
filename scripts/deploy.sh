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

echo "==> SIEVE-DIAG redirect + fileinto delivery test"
MBOX=$(compose exec -T dovecot sh -c 'ls -d /var/vmail/*/* 2>/dev/null | head -1' | tr -d "\r")
MBOX2=$(compose exec -T dovecot sh -c 'ls -d /var/vmail/*/* 2>/dev/null | sed -n 2p' | tr -d "\r")
echo "SIEVE-DIAG mailbox1: [$MBOX]  mailbox2: [$MBOX2]"
if [[ -n "$MBOX" && -n "$MBOX2" ]]; then
  DOM=$(basename "$(dirname "$MBOX")");  LP=$(basename "$MBOX");   ADDR="$LP@$DOM"
  DOM2=$(basename "$(dirname "$MBOX2")"); LP2=$(basename "$MBOX2"); ADDR2="$LP2@$DOM2"
  echo "SIEVE-DIAG deliver to $ADDR, redirect to $ADDR2"
  compose exec -T dovecot sh -c '
    MBOX="'"$MBOX"'"; ADDR2="'"$ADDR2"'"
    mkdir -p "$MBOX/sieve"
    [ -L "$MBOX/.dovecot.sieve" ] && mv "$MBOX/.dovecot.sieve" /tmp/bk.link 2>/dev/null || true
    cat > "$MBOX/sieve/diag.sieve" <<SEOF
require ["imap4flags","fileinto","mailbox"];
if header :contains "subject" "SIEVEDIAG" {
  addflag "\\\\Flagged";
  redirect "$ADDR2";
  fileinto :create "SieveDiag";
}
SEOF
    ln -sf sieve/diag.sieve "$MBOX/.dovecot.sieve"
    chown -R vmail:vmail "$MBOX/sieve"; chown -h vmail:vmail "$MBOX/.dovecot.sieve"
    su -s /bin/sh vmail -c "sievec \"$MBOX/sieve/diag.sieve\"" 2>&1 || echo "sievec failed"
  ' || true
  compose exec -T postfix sh -c "printf 'From: diag@$DOM\r\nTo: $ADDR\r\nSubject: SIEVEDIAG probe\r\n\r\nbody\r\n' | sendmail -f 'diag@$DOM' '$ADDR'" || true
  sleep 12
  echo "SIEVE-DIAG --- postfix delivery log (expect status=sent to both $ADDR and $ADDR2) ---"
  compose logs --tail=150 --no-color postfix 2>&1 | grep -iE "status=|reject|defer|bounce" | tail -20 || true
  echo "SIEVE-DIAG --- result ---"
  compose exec -T dovecot sh -c '
    MBOX="'"$MBOX"'"; MBOX2="'"$MBOX2"'"
    echo "fileinto (mbox1 SieveDiag/new): $(ls "$MBOX/Maildir/.SieveDiag/new/" 2>/dev/null | wc -l)"
    echo "redirect  (mbox2 INBOX new):    $(grep -rl SIEVEDIAG "$MBOX2/Maildir/new/" 2>/dev/null | wc -l)"
    rm -rf "$MBOX/Maildir/.SieveDiag"
    grep -rl SIEVEDIAG "$MBOX/Maildir/new/" 2>/dev/null | xargs -r rm -f
    grep -rl SIEVEDIAG "$MBOX2/Maildir/new/" 2>/dev/null | xargs -r rm -f
    rm -f "$MBOX/sieve/diag.sieve" "$MBOX/sieve/diag.svbin" "$MBOX/.dovecot.sieve"
    [ -e /tmp/bk.link ] && mv /tmp/bk.link "$MBOX/.dovecot.sieve" 2>/dev/null || true
  ' || true
  echo "SIEVE-DIAG --- dovecot sieve log ---"
  compose logs --tail=300 --no-color dovecot 2>&1 | grep -iE 'sieve:|redirect' | grep -ivE '_capability|sieve_plugins|sieve_global|sieve_pipe|= file:' | tail -15 || true
fi

docker image prune -f >/dev/null
echo "==> Deploy OK"
