FROM debian:bookworm-slim

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-pgsql \
      dovecot-sieve dovecot-managesieved ca-certificates gettext-base openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 5000 vmail \
    && useradd -u 5000 -g 5000 -d /var/vmail -s /usr/sbin/nologin vmail

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 993 995 4190 24 12345
HEALTHCHECK --interval=30s --timeout=5s CMD doveadm service status >/dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
