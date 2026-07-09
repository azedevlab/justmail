# Phase 10 — Infrastructure

Everything lives in `infra/`. One compose project (`justmail`), served from
`/opt/justmail` on the host. Deploys are `git pull + docker compose up -d` wrapped in
`deploy.sh`, run by GitHub Actions over SSH (or by a human — identical path).

## 1. Hosts & DNS (example.com on Cloudflare)

| Record | Value | Proxy |
|---|---|---|
| `A mail.example.com` | 203.0.113.10 (Elastic IP recommended) | **DNS only** (mail can't be proxied) |
| `A justmail.example.com` (UI) | same | proxied ok |
| `A api.justmail.example.com` | same | **DNS only** (WebSocket + no CF timeouts) |
| `MX @ → mail.example.com` etc. | managed by DNS Center at runtime | — |

PTR (203.0.113.10 → mail.example.com): via AWS rDNS form — external to Cloudflare.

## 2. Compose topology

Profiles allow incremental bring-up: `core` (traefik, postgres, redis), `mail`
(postfix, dovecot, rspamd, clamav), `app` (api, worker, web), `obs` (vector, loki,
prometheus, grafana), `sec` (fail2ban), `certs` (certd).

- Traefik terminates HTTPS for `justmail.example.com` (web), `api.justmail.example.com`
  (api, incl. `/v1/ws` WebSocket), `grafana.justmail.example.com` (admin-gated).
- Postfix/Dovecot publish mail ports directly on the host (no proxy): 25, 465, 587,
  993, 995, 4190.
- `certd` (acme.sh + Cloudflare DNS-01) issues `mail.example.com` (+ `mta-sts`,
  `autoconfig`, `autodiscover`) into the shared `certs` volume and reloads
  postfix/dovecot on renewal. Traefik gets its own certs via the same DNS-01 resolver.
- Secrets: single `/opt/justmail/.env` (chmod 600), sourced by compose. Template in
  `infra/compose/.env.example`. Never in git, never in images.

## 3. Server bootstrap (`bootstrap-server.sh`, idempotent)

1. apt update/upgrade, unattended-upgrades on
2. Docker Engine + compose plugin (official repo)
3. Hardening: UFW logging off (SGs are authoritative on AWS), SSH keys-only +
   no root login, sysctl (`net.core.somaxconn`, file limits, vm.overcommit for redis)
4. `/opt/justmail` layout + `justmail` system user in `docker` group
5. Hostname → `mail.example.com`, `/etc/mailname`
6. Swap file 2G (safety on 16G box), journald cap

## 4. CI/CD (GitHub Actions)

- **ci.yml** (PR + main): pnpm install → turbo lint/typecheck/test/build →
  compose config validation → (later) e2e SMTP/IMAP suite against ephemeral stack.
- **deploy.yml** (push to main, after CI): SSH (key in repo secrets) →
  `/opt/justmail/deploy.sh <git-sha>` → health checks → rollback to previous sha on
  failure. Images built on the server (simple, single node); registry becomes worth it
  at multi-node (M4).

## 5. Backups

`backup.sh` (cron via worker in M1.8): nightly `pg_dump -Fc` + rsync-style maildir
snapshot (tar + zstd) → S3-compatible target (AWS S3 or MinIO), 7 daily / 4 weekly
retention, restore runbook in `docs/runbooks/restore.md`.

## 6. Monitoring wiring

- Exporters: node-exporter (host), postgres-exporter, redis-exporter, postfix-exporter
  (log-derived), rspamd built-in `/metrics`, cAdvisor (containers).
- Vector: postfix/dovecot/rspamd container logs → Loki (raw, 14d) + HTTP sink → api
  (`POST /internal/events/ingest`, shared-secret header) for `mail_events`.
- Prometheus 30d retention; Grafana provisioned dashboards: Mail Overview, System,
  Postgres, Rspamd. Alerting (M2): queue depth, disk, cert expiry, blocklist hit.

## 7. Port matrix (Security Group)

| Port | Service | Note |
|---|---|---|
| 22 | SSH | restrict source IP if possible |
| 25 | Postfix SMTP | inbound receive — required |
| 80/443 | Traefik | 80 only for ACME HTTP fallback + redirect |
| 465/587 | Postfix submission | client sending |
| 993/995 | Dovecot IMAPS/POP3S | plaintext 143/110 not exposed |
| 4190 | ManageSieve | filter management |

Outbound 25 blocked by AWS → `outbound_mode=smarthost` until the limit-removal request
is approved; then flip to `direct` in Settings (no redeploy).
