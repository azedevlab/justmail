#!/bin/bash
set -euo pipefail

TPL=/opt/justmail/templates
# shellcheck disable=SC2016  # literal ${VAR} list is envsubst's allowlist
VARS='${JM_HOSTNAME} ${JM_DOMAIN} ${MAILPLANE_DB_PASSWORD} ${POSTGRES_DB}'
envsubst "$VARS" < "$TPL/dovecot.conf.tmpl" > /etc/dovecot/dovecot.conf
envsubst "$VARS" < "$TPL/dovecot-sql.conf.ext.tmpl" > /etc/dovecot/dovecot-sql.conf.ext
chmod 600 /etc/dovecot/dovecot-sql.conf.ext

mkdir -p /var/vmail && chown vmail:vmail /var/vmail

# IMAPSieve → rspamd Bayes training. Install the learn scripts into a writable
# dir (the templates mount is read-only), stash the controller password for the
# pipe helpers, and precompile the sieve scripts so Dovecot doesn't need to.
install -d -o vmail -g vmail -m 0755 /etc/dovecot/sieve
install -o vmail -g vmail -m 0644 \
  "$TPL/report-spam.sieve" "$TPL/report-ham.sieve" /etc/dovecot/sieve/
install -o vmail -g vmail -m 0755 \
  "$TPL/learn-spam.sh" "$TPL/learn-ham.sh" /etc/dovecot/sieve/
printf '%s' "${RSPAMD_CONTROLLER_PASSWORD:-}" > /etc/dovecot/sieve/rspamd.password
chown vmail:vmail /etc/dovecot/sieve/rspamd.password
chmod 600 /etc/dovecot/sieve/rspamd.password
sievec /etc/dovecot/sieve/report-spam.sieve
sievec /etc/dovecot/sieve/report-ham.sieve

# Self-signed bootstrap cert until certd issues the real one
if [[ ! -s /certs/mail/fullchain.pem ]]; then
  mkdir -p /etc/dovecot/bootstrap-certs
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
    -keyout /etc/dovecot/bootstrap-certs/key.pem \
    -out /etc/dovecot/bootstrap-certs/fullchain.pem \
    -subj "/CN=${JM_HOSTNAME}" 2>/dev/null
  sed -i \
    -e 's|^ssl_cert = .*|ssl_cert = </etc/dovecot/bootstrap-certs/fullchain.pem|' \
    -e 's|^ssl_key = .*|ssl_key = </etc/dovecot/bootstrap-certs/key.pem|' \
    /etc/dovecot/dovecot.conf
fi

# Hot-reload TLS when certd issues or renews. Seed `last` with the current
# checksum so the bootstrap->real-cert transition also triggers a reload.
watch_certs() {
  local last now
  last=$(md5sum /certs/mail/fullchain.pem 2>/dev/null | cut -d' ' -f1 || true)
  while sleep 300; do
    now=$(md5sum /certs/mail/fullchain.pem 2>/dev/null | cut -d' ' -f1 || true)
    if [[ -n "$now" && "$now" != "$last" ]]; then
      sed -i \
        -e 's|^ssl_cert = .*|ssl_cert = </certs/mail/fullchain.pem|' \
        -e 's|^ssl_key = .*|ssl_key = </certs/mail/key.pem|' \
        /etc/dovecot/dovecot.conf
      doveadm reload || true
      last="$now"
    fi
  done
}
watch_certs &

exec dovecot -F
