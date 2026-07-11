# Quickstart

Get JustMail running on a fresh Ubuntu 24.04+ host. Budget ~15 minutes plus
DNS propagation time.

## Prerequisites

- A server with a public IPv4 address and **outbound port 25 open** (most
  clouds block it by default — open a support ticket first).
- A domain you control, with access to its DNS records.
- Docker Engine 24+ (the installer pulls it if missing).
- Ports 25, 80, 443, 465, 587, 993 reachable from the internet.

## 1. Install

```bash
curl -fsSL https://get.justmail.dev | sudo bash
```

The first run clones the repo to `/opt/justmail/app`, creates
`/opt/justmail/.env` from the example, then stops so you can edit it.

## 2. Configure `/opt/justmail/.env`

At minimum set:

| Variable | Meaning |
|----------|---------|
| `JM_DOMAIN` | Primary domain (e.g. `example.com`). |
| `MAIL_HOSTNAME` | FQDN of the mail server (e.g. `mail.example.com`). |
| `DNS_PROVIDER` + token | Provider used to publish SPF/DKIM/DMARC records. |
| `STORAGE_KIND` | `local` for single-node, or `s3`/`r2`/… for object storage. |
| `ENCRYPTION_KEY` | 32+ char secret. Generate with `openssl rand -base64 48`. |

Every setting is documented in `services/compose/.env.example`. The API
validates the whole file at boot and **fails fast** with a clear error if
anything required is missing.

## 3. Bring the stack up

```bash
sudo bash /opt/justmail/app/scripts/install.sh
```

This runs `docker compose up -d`. Database migrations apply automatically the
first time the `api` and `worker` containers start — there is no separate
migration step.

## 4. Publish DNS

Open the admin console (`https://admin.<your-domain>`), go to **DNS Center**,
and apply the generated records. SPF, DKIM, DMARC, MTA-STS, and TLS-RPT are
produced for you. Deliverability tooling in the console verifies them.

## 5. Create your first mailbox

Admin console → **Domains** → add your domain → **Mailboxes** → create a
mailbox. Log in to webmail at `https://mail.<your-domain>` with those
credentials.

## Verify

```bash
# API health
curl -fsS https://api.<your-domain>/v1/healthz

# Interactive API reference
open https://api.<your-domain>/v1/docs
```

## Next steps

- [Backup & restore](backup-restore.md) — turn on scheduled backups.
- [Upgrades](upgrade.md) — how to move to a new release safely.
- [Troubleshooting](troubleshooting.md) — when something is off.
- [Architecture](../architecture.md) — how the pieces fit together.
