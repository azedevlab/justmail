FROM alpine:3.21

# get.acme.sh silently ignores --home/--nocron (it only accepts email=), which
# left acme.sh in /root/.acme.sh — install from a pinned release tarball instead.
ARG ACME_VERSION=3.1.0

RUN apk add --no-cache bash curl openssl socat coreutils \
    && curl -fsSL "https://github.com/acmesh-official/acme.sh/archive/refs/tags/${ACME_VERSION}.tar.gz" | tar -xz -C /usr/local \
    && mv "/usr/local/acme.sh-${ACME_VERSION}" /usr/local/acme.sh \
    && test -x /usr/local/acme.sh/acme.sh

COPY run.sh /run.sh
RUN chmod +x /run.sh

ENTRYPOINT ["/run.sh"]
