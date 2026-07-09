#!/bin/bash
# certd: issues/renews the mail certificate via Cloudflare DNS-01 and installs it
# into the shared /certs volume. Postfix/Dovecot watch the files and hot-reload.
set -euo pipefail

ACME=/usr/local/acme.sh/acme.sh
export LE_WORKING_DIR=/usr/local/acme.sh
export LE_CONFIG_HOME=/acme.sh
DOMAINS=(-d "${JM_HOSTNAME}" -d "mta-sts.${JM_DOMAIN}" -d "autoconfig.${JM_DOMAIN}" -d "autodiscover.${JM_DOMAIN}")

mkdir -p /certs/mail

"$ACME" --register-account -m "${ACME_EMAIL}" --server letsencrypt >/dev/null 2>&1 || true

issue() {
  "$ACME" --issue --dns dns_cf "${DOMAINS[@]}" \
    --server letsencrypt \
    --key-file /certs/mail/key.pem \
    --fullchain-file /certs/mail/fullchain.pem \
    --reloadcmd "chmod 644 /certs/mail/fullchain.pem && chmod 640 /certs/mail/key.pem" \
    && echo "certd: issued/installed for ${JM_HOSTNAME}"
}

if [[ ! -s /certs/mail/fullchain.pem ]]; then
  until issue; do
    echo "certd: issue failed, retrying in 5m"
    sleep 300
  done
fi

# Renewal loop (acme.sh renews when <30 days remain)
while true; do
  sleep 43200
  "$ACME" --cron >/dev/null 2>&1 || echo "certd: renew check failed"
done
