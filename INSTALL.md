# JustMail Installation Guide

This guide walks you from a bare Linux server to a working, deliverable mail
platform. There are three supported paths:

- **[A. Docker Compose](#a-docker-compose-single-node)** — the recommended way to run a single node.
- **[B. One-command installer](#b-one-command-installer-ubuntu)** — a wrapper around Compose for Ubuntu.
- **[C. Kubernetes (Helm)](#c-kubernetes-helm)** — for multi-node / HA deployments.

If you just want to try it, start with **A**.

---

## Prerequisites

**Server**

- Linux host with **≥ 4 vCPU, 16 GB RAM, 200 GB SSD** (2 vCPU / 8 GB works for a
  small trial).
- Docker Engine 24+ and the Docker Compose plugin (the installer sets these up
  for you on Ubuntu).

**Network — open these ports**

| Port | Protocol | Purpose |
|------|----------|---------|
| 25 | SMTP | Inbound mail from other servers |
| 80, 443 | HTTP/HTTPS | Web apps + ACME TLS issuance |
| 465, 587 | SMTPS / submission | Sending mail from clients |
| 993 | IMAPS | Mailbox access |
| 995 | POP3S | Mailbox access (POP) |
| 4190 | ManageSieve | Server-side filters |

> Many cloud providers block **outbound port 25** by default. If yours does,
> request an unblock or configure a smarthost relay (see
> [Sending through a relay](#sending-through-a-relay-smarthost)).

**DNS & identity**

- A **domain you control** with DNS hosted at a supported provider
  (Cloudflare or deSEC today; others behind the same interface).
- A **DNS API token** so JustMail can publish SPF/DKIM/DMARC/MTA-STS records for
  you (or you can publish them manually via the exported zone file).
- **Reverse DNS (PTR)** for your server's IP pointing at `mail.<your-domain>`.
  Set this with your hosting provider — without it, Gmail and others will
  reject or spam-file your outbound mail.

---

## A. Docker Compose (single node)

### 1. Clone and configure

```bash
git clone https://github.com/azedevlab/justmail.git
cd justmail
cp services/compose/.env.example services/compose/.env
chmod 600 services/compose/.env
```

Edit `services/compose/.env`. The essentials:

```dotenv
# Hostnames — all should resolve to this server
JM_DOMAIN=example.com
JM_ADMIN_HOST=admin.example.com
JM_WEBMAIL_HOST=mail.example.com
JM_API_HOST=api.example.com
MAIL_HOSTNAME=mail.example.com
JM_HOSTNAME=mail.example.com
ACME_EMAIL=postmaster@example.com

# Datastores — set strong values
POSTGRES_PASSWORD=…
MAILPLANE_DB_PASSWORD=…
REDIS_PASSWORD=…
RSPAMD_CONTROLLER_PASSWORD=…

# App secrets — generate each with: openssl rand -hex 32
APP_SECRET=…
ENCRYPTION_KEY=…
EVENTS_INGEST_TOKEN=…

# DNS provider (for automatic record publishing)
DNS_PROVIDER=cloudflare
CLOUDFLARE_API_TOKEN=…
CLOUDFLARE_ACCOUNT_ID=…

# Storage — local disk by default; point at S3/R2/MinIO for production
STORAGE_KIND=local
STORAGE_LOCAL_PATH=/opt/justmail/attachments
```

Generate secrets quickly:

```bash
for k in APP_SECRET ENCRYPTION_KEY EVENTS_INGEST_TOKEN; do
  echo "$k=$(openssl rand -hex 32)"
done
```

### 2. Point DNS at the server

Create A records so the app hostnames resolve to your server's public IP:

```
A   admin.example.com   → <server-ip>
A   mail.example.com    → <server-ip>
A   api.example.com     → <server-ip>
```

`admin`/`api` can sit behind a proxy (e.g. Cloudflare); the **mail** host must be
**DNS-only** (mail cannot be proxied). The MX / SPF / DKIM / DMARC records are
published for you later from the admin console (or exported as a zone file).

### 3. Start the stack

```bash
docker compose -f services/compose/docker-compose.yml \
  --profile core --profile certs --profile mail --profile app up -d
```

Profiles let you choose what runs:

| Profile | Brings up |
|---------|-----------|
| `core` | Postgres, Redis, Traefik |
| `certs` | certd (ACME/TLS certificate issuance) |
| `mail` | Postfix, Dovecot, Rspamd, ClamAV |
| `app` | API, worker, admin, webmail, landing |
| `obs` | Grafana, Loki, Vector (observability) |
| `sec` | security tooling |

Check status:

```bash
docker compose -f services/compose/docker-compose.yml ps
```

TLS certificates are issued automatically on first boot (a self-signed cert is
used until the real one arrives).

### 4. Create the first admin

Open `https://admin.example.com`. On first run the console shows a bootstrap
form that creates the initial owner account and organization. (This one-time
form is only available until the first user exists.)

Prefer the API? POST to `/auth/bootstrap`:

```bash
curl -sS https://api.example.com/auth/bootstrap \
  -H 'content-type: application/json' \
  -d '{
        "email": "you@example.com",
        "password": "a-strong-password-min-12-chars",
        "name": "Your Name",
        "org_name": "Your Org"
      }'
```

Then sign in at `https://admin.example.com`.

### 5. Add your domain and go green

In the admin console:

1. **Domains → Add domain** → enter `example.com`.
2. **DKIM → Generate**, then **Activate**.
3. **DNS Center → Publish to Cloudflare** — this reconciles every record
   (MX, SPF, DKIM, DMARC, MTA-STS, TLS-RPT, CAA), never clobbering unrelated
   records, and removes stale duplicates.
   - No DNS API token? Use **Download zone file** and import it into your DNS.
4. **Recheck** after propagation — every record should turn ✅ green.
5. Create mailboxes under **Mailboxes**, then log into webmail at
   `https://mail.example.com`.

---

## B. One-command installer (Ubuntu)

On a fresh Ubuntu 24.04+ server:

```bash
curl -fsSL https://raw.githubusercontent.com/azedevlab/justmail/main/scripts/install.sh | sudo bash
```

The installer:

1. Installs Docker if missing.
2. Creates the `justmail` service user and `/opt/justmail/{app,backups,attachments}`.
3. Clones the repo to `/opt/justmail/app`.
4. Copies `.env.example` → `/opt/justmail/.env` (chmod 600) and stops so you can
   edit it.

Edit `/opt/justmail/.env` (same keys as path A), then re-run the command. It
brings up the `core`, `mail`, `obs`, `sec`, and `app` profiles. Continue with
[Create the first admin](#4-create-the-first-admin).

---

## C. Kubernetes (Helm)

For multi-node or HA installs:

```bash
helm install justmail ./services/helm/justmail --values my-values.yaml
```

See [docs/multi-node.md](docs/multi-node.md) for the scale-out topology
(PgBouncer + read replicas, Redis Cluster, a Dovecot Director pool, and shared
maildir on a network/clustered filesystem). Distributed mail storage tuning is
covered in [docs/deployment/shared-storage.md](docs/deployment/shared-storage.md).

---

## Production hardening

- **Object storage** — set `STORAGE_KIND` to `s3`/`r2`/`minio`/`b2`/`wasabi`/`do`/
  `scaleway`/`ceph`/`azure`/`gcs` and provide the credentials, so attachments and
  backups live off the box.
- **Database HA** — set `DATABASE_URL` (writer) and `DATABASE_READONLY_URL`
  (reader/replica); tune `DATABASE_POOL_MAX`, timeouts, and `DATABASE_SSL`.
- **Cache HA** — configure `REDIS_SENTINELS`/`REDIS_SENTINEL_NAME` or
  `REDIS_CLUSTER_NODES` with `REDIS_TLS` and auth.
- **Backups** — schedule the operator CLI: `justmail backup` (see
  [docs/operations/backup-restore.md](docs/operations/backup-restore.md)).
- **Passkeys / SSO** — configure WebAuthn (`WEBAUTHN_RP_ID`) and OIDC/SAML in the
  admin console.

## Sending through a relay (smarthost)

If outbound port 25 is blocked, route outgoing mail through a relay by setting
the smarthost variables in `.env` and restarting the `mail` profile. See the
[operations guide](docs/operations/) for details.

## Operating the stack

The `justmail` CLI wraps day-2 operations:

```bash
justmail status              # which services are up
justmail logs api            # tail a service
justmail backup              # trigger a backup
justmail restore --backup <id>
justmail upgrade             # pull + rolling redeploy
justmail storage:migrate     # move objects between storage backends
```

## Troubleshooting

| Symptom | Where to look |
|---------|---------------|
| DNS records won't go green | Admin → DNS Center; re-**Publish** then **Recheck**. See [docs/runbooks/dns-drift.md](docs/runbooks/dns-drift.md). |
| Outbound mail lands in spam | Confirm PTR/rDNS and that DKIM is **activated**; see [docs/runbooks/mail-blocked.md](docs/runbooks/mail-blocked.md). |
| TLS certificate not issued | Ensure ports 80/443 are open and the hostnames resolve to this server. |
| IMAP index corruption on shared storage | Set `MAIL_STORAGE_BACKEND` and run a Dovecot Director — see [shared-storage.md](docs/deployment/shared-storage.md). |
| Postgres failover / replica lag | [docs/runbooks/postgres-failover.md](docs/runbooks/postgres-failover.md) |

More runbooks: [docs/runbooks/](docs/runbooks/).
