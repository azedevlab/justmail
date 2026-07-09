FROM debian:bookworm-slim

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      postfix postfix-pgsql ca-certificates gettext-base openssl \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 25 465 587
HEALTHCHECK --interval=30s --timeout=5s \
  CMD postfix status || exit 1

ENTRYPOINT ["/entrypoint.sh"]
