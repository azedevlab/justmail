#!/bin/sh
# Dovecot IMAPSieve pipes the moved message on stdin; forward it verbatim to the
# rspamd controller for Bayes ham training. Failures are swallowed so a learn
# hiccup never blocks the user's IMAP move.
set -eu
PW=$(cat /etc/dovecot/sieve/rspamd.password 2>/dev/null || true)
exec curl -sf -m 15 --data-binary @- -H "Password: ${PW}" \
  http://rspamd:11334/learnham
