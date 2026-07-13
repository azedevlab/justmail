# Installation

This is the condensed install path. The full, always-current guide lives in
[INSTALL.md](https://github.com/azedevlab/justmail/blob/main/INSTALL.md).

## Prerequisites

- Linux host, **≥ 4 vCPU / 16 GB RAM / 200 GB SSD** (2/8 works for a trial).
- Docker Engine 24+ and the Compose plugin.
- Ports open: **25** (SMTP), **80/443** (HTTP/S), **465/587** (submission),
  **993** (IMAPS), **995** (POP3S), **4190** (ManageSieve).
- A domain you control, a DNS API token (Cloudflare or deSEC), and **reverse
  DNS (PTR)** for your IP pointing at `mail.<your-domain>`.

> Many clouds block outbound port 25 — request an unblock or use a smarthost.

## Docker Compose (recommended)

```bash
git clone https://github.com/azedevlab/justmail.git
cd justmail
cp services/compose/.env.example services/compose/.env
chmod 600 services/compose/.env
# edit .env: domains, DNS token, and secrets (openssl rand -hex 32)

docker compose -f services/compose/docker-compose.yml \
  --profile core --profile certs --profile mail --profile app up -d
```

Profiles: `core` (Postgres/Redis/Traefik), `certs` (certd ACME/TLS), `mail`
(Postfix/Dovecot/Rspamd/ClamAV), `app` (API/worker/admin/webmail/landing), `obs`
(Grafana/Loki/Vector), `sec` (security tooling).

## Ubuntu one-command installer

```bash
curl -fsSL https://raw.githubusercontent.com/azedevlab/justmail/main/scripts/install.sh | sudo bash
```

Edit `/opt/justmail/.env` when prompted, then re-run.

## First admin

Open `https://admin.<your-domain>` — the first-run form creates the owner
account and organization. Or use the API:

```bash
curl -sS https://api.<your-domain>/auth/bootstrap \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"min-12-chars","name":"You","org_name":"Your Org"}'
```

## Go green

In the admin console: **Domains → Add**, **DKIM → Generate → Activate**, then
**DNS Center → Publish** (or download the zone file), and **Recheck** after
propagation. Every record should turn ✅.

See **[[Deployment]]** for Kubernetes and multi-node, and **[[FAQ]]** for
troubleshooting.
