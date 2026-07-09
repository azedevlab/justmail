#!/bin/bash
set -euo pipefail

TPL=/opt/justmail/templates
# shellcheck disable=SC2016  # literal ${VAR} list is envsubst's allowlist
render() { envsubst "$(printf '${%s} ' JM_HOSTNAME JM_DOMAIN MAILPLANE_DB_PASSWORD POSTGRES_DB MESSAGE_SIZE_LIMIT RENDERED_RELAYHOST RENDERED_RELAY_SASL RENDERED_RELAY_PASSMAP)" < "$1" > "$2"; }

# Outbound routing: direct MX or smarthost relay (AWS blocks outbound 25 by default)
if [[ "${OUTBOUND_MODE:-direct}" == "smarthost" && -n "${RELAYHOST:-}" ]]; then
  export RENDERED_RELAYHOST="${RELAYHOST}"
  export RENDERED_RELAY_SASL="yes"
  export RENDERED_RELAY_PASSMAP="hash:/etc/postfix/sasl_passwd"
  echo "${RELAYHOST} ${RELAYHOST_USER}:${RELAYHOST_PASSWORD}" > /etc/postfix/sasl_passwd
  chmod 600 /etc/postfix/sasl_passwd
  postmap /etc/postfix/sasl_passwd
else
  export RENDERED_RELAYHOST=""
  export RENDERED_RELAY_SASL="no"
  export RENDERED_RELAY_PASSMAP=""
fi

render "$TPL/main.cf.tmpl" /etc/postfix/main.cf
cp "$TPL/master.cf" /etc/postfix/master.cf

mkdir -p /etc/postfix/pgsql
for f in "$TPL"/pgsql/*.cf.tmpl; do
  render "$f" "/etc/postfix/pgsql/$(basename "${f%.tmpl}")"
done
chmod 640 /etc/postfix/pgsql/*.cf

# DH params (generated once, kept in spool volume)
if [[ ! -f /var/spool/postfix/dh4096.pem ]]; then
  openssl dhparam -out /var/spool/postfix/dh4096.pem 2048
fi
cp /var/spool/postfix/dh4096.pem /etc/postfix/dh4096.pem

# Self-signed bootstrap cert until certd issues the real one
if [[ ! -s /certs/mail/fullchain.pem ]]; then
  mkdir -p /etc/postfix/bootstrap-certs
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
    -keyout /etc/postfix/bootstrap-certs/key.pem \
    -out /etc/postfix/bootstrap-certs/fullchain.pem \
    -subj "/CN=${JM_HOSTNAME}" 2>/dev/null
  postconf -e "smtpd_tls_cert_file=/etc/postfix/bootstrap-certs/fullchain.pem" \
             "smtpd_tls_key_file=/etc/postfix/bootstrap-certs/key.pem"
fi

# chroot copies postfix needs
cp /etc/resolv.conf /var/spool/postfix/etc/resolv.conf 2>/dev/null || true
cp /etc/services /var/spool/postfix/etc/services 2>/dev/null || true

# Hot-reload TLS when certd issues or renews (checksum watcher, no docker
# socket needed). Seed `last` with the current checksum so the
# bootstrap->real-cert transition also triggers a reload.
watch_certs() {
  local last now
  last=$(md5sum /certs/mail/fullchain.pem 2>/dev/null | cut -d' ' -f1 || true)
  while sleep 300; do
    now=$(md5sum /certs/mail/fullchain.pem 2>/dev/null | cut -d' ' -f1 || true)
    if [[ -n "$now" && "$now" != "$last" ]]; then
      postconf -e "smtpd_tls_cert_file=/certs/mail/fullchain.pem" \
                 "smtpd_tls_key_file=/certs/mail/key.pem"
      postfix reload || true
      last="$now"
    fi
  done
}
watch_certs &

exec /usr/sbin/postfix start-fg
