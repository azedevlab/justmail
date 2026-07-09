# Deployment architecture

## Deployment targets

| Target | Audience | Delivery |
|---|---|---|
| Single-node Compose | homelab, small teams | `services/compose/` |
| Kubernetes (HA) | production | `services/helm/justmail` |
| One-click cloud (AWS/DO/Hetzner) | eval, dev | `services/terraform/` |
| Local dev | contributors | `pnpm dev` |

## Single-node topology

Everything on one box (Ubuntu 24.04 LTS or 26.04 LTS):

- Traefik edge
- api, admin, webmail, landing, worker, caldav
- postfix, dovecot, rspamd, clamav
- postgres, redis, vector, loki, prometheus, grafana
- fail2ban, certd, mtasts

Compose profiles group services (`core`, `mail`, `app`, `obs`, `sec`,
`certs`) so operators can disable pieces. Compose file lives at
`services/compose/docker-compose.yml`.

Storage: local FS by default (`STORAGE_KIND=local` under
`/opt/justmail/attachments`). Backups: nightly to `/opt/justmail/backups`
or object store if configured.

Sizing: 4 vCPU / 16 GB / 500 GB SSD comfortably handles 10 000 mailboxes
and 1 M msgs/day. Below 8 GB the operator gets a hard warning at install.

## Kubernetes topology (HA)

```
                 ┌────────────────────────────┐
                 │        Ingress             │
                 │  (nginx / traefik / hz)    │
                 └───────────┬────────────────┘
                             │
             ┌───────────────┼─────────────────┐
             │               │                 │
        ┌────▼────┐    ┌─────▼────┐     ┌──────▼─────┐
        │ admin   │    │ webmail  │     │  landing   │
        │ (Deploy)│    │ (Deploy) │     │   (Deploy) │
        └────┬────┘    └─────┬────┘     └────────────┘
             │               │
             └───────┬───────┘
                     │
                ┌────▼────┐
                │   api   │  (Deploy — HPA on CPU + p95 latency)
                │  (WS)   │
                └────┬────┘
                     │
        ┌────────────┼────────────────────────────────┐
        │            │                                │
   ┌────▼────┐  ┌────▼─────┐  ┌────────┐  ┌───────────▼───────┐
   │Postgres │  │ Redis    │  │Object  │  │  Mail data plane  │
   │ (Zalando│  │(Sentinel │  │Storage │  │(Postfix Statefulset│
   │  / PGO) │  │ or Cluster)│ │provider│  │ Dovecot Statefulset│
   └─────────┘  └──────────┘  └────────┘  │ Rspamd Deployment) │
                                          └────────────────────┘
```

Charts under `services/helm/justmail/`:

- Umbrella chart depends on Zalando Postgres Operator, Redis chart,
  Cert-Manager, ExternalDNS, Ingress-Nginx (or Traefik).
- CRDs shipped: `Domain`, `Mailbox`, `Alias`, `WebhookEndpoint`,
  `BackupSchedule` — mirror API entities so `kubectl get mailbox` works.
- ServiceMonitors + PodMonitors for Prometheus operator.
- PDBs for every Deployment.
- HPA on api (CPU 60%, p95 latency budget), webmail (CPU 70%),
  admin (CPU 70%), workers per queue depth.

## Cloud one-click

Terraform modules per provider under `services/terraform/`:

- `aws/`: VPC, EKS, RDS Postgres, ElastiCache Redis, S3, ACM, Route53.
- `hetzner/`: HCloud VMs behind a load balancer, RDS-analog via managed
  Postgres (or self-managed), object storage via built-in S3 API.
- `do/`: DOKS, managed DB, spaces.

Every module wires:

- Cert-manager DNS-01 to the provider's DNS zone.
- Backup destination in the provider's object store.
- Firewall: 25, 465, 587, 993, 995, 4190 inbound to mail plane; 80, 443
  inbound to edge; nothing else.

## Configuration

- Single source of env: `packages/contracts/env.ts` validates every var.
- Compose renders envs from `.env`.
- Helm renders envs from `values.yaml`.
- Terraform renders envs into `helm_release.values`.
- Secrets: never inline. Compose reads from `/opt/justmail/.env` (chmod
  600); Helm reads from a `Secret` (external secret manager encouraged);
  Terraform pulls from AWS SM / Vault.

## Ingress and TLS

- Public entry: 80 → 443 redirect, HSTS (marketing site only), sane cipher
  suites.
- Certs: DNS-01 by default (avoids exposing HTTP-01 for wildcard needs).
  Two ACME resolvers configured — Let's Encrypt (primary) and ZeroSSL
  (fallback).
- Per-domain admin/webmail: routers keyed by SNI; certs issued per hosted
  domain automatically when the domain is verified.

## DNS

- Operator's own DNS provider is a plugin. Cloudflare shipped first-party;
  Route53, deSEC, Gandi in v1.0.
- All DNS reconciliation is desired-state; state is refreshed on demand
  and on a schedule.

## Firewall

- The installer prints exact `ufw` and `nftables` rules.
- Docker + ufw interaction (Docker rewrites iptables) is documented and
  handled by installing the `docker-ufw` companion or a per-service
  approach.

## Deploy flow

- Development: `pnpm dev` runs everything via Docker Compose with hot
  reload for apps and workers; changes to Nest modules restart the api.
- CI: `pnpm ci` runs lint + typecheck + unit + integration + e2e in
  parallel jobs, then builds container images with SBOMs and signs them
  with cosign.
- CD: image tags flow into environments via GitOps (Argo CD) or a direct
  SSH+rsync path for single-node. Rollbacks are one-command
  (`justmail rollback --to <sha>`).

## Rolling upgrades

- API: 1 pod out at a time; 30 s drain; readiness gate on migration
  version match.
- Postgres: migrations run before pods scale up. Destructive migrations
  require a `justmail upgrade --allow-destructive` confirmation and a
  fresh backup id.
- Mail plane (Postfix/Dovecot): stateful set rolling update; Dovecot
  Director drains connections gracefully.

## Blue/green (optional)

- Two identical stacks behind a switching ingress. Cut over at DNS+ingress
  once the "green" stack passes readiness. Roll back = flip the ingress.

## Failure modes and recovery

- Postgres primary loss → PGO fails over; app pods restart with new
  connection string; documented in `docs/runbooks/postgres-failover.md`.
- Redis loss → sessions cleared (invisible), rate-limit counters reset
  (acceptable), webhook queue rehydrates from DB `webhook_deliveries`.
- Storage outage → uploads fail with `503`; downloads for CDN-cached
  attachments continue; audit-logged.
- Mail plane outage → api continues; SMTP relayed to disk queue on the
  edge; documented in `docs/runbooks/mail-plane-outage.md`.

## Backups & DR

- Nightly full: pg_dump + tar of vmail + object-storage inventory.
- Hourly WAL archive to object storage.
- Restore drill: weekly job restores latest backup into a scratch cluster
  and asserts row counts + storage checksum. Alerts on drift.

## Observability

- Vector → Loki for logs; Prometheus for metrics; Tempo for traces (v1.1).
- Dashboards ship in-repo under `services/grafana/dashboards/`.
- Alerting rules under `services/prometheus/alerts/`; suggested
  Alertmanager receivers documented but not enforced.

## Cost profiles

- Single-node on Hetzner CX41: ~€27/mo, fits 10k mailboxes comfortably.
- HA on AWS us-east-1 with EKS + RDS + ElastiCache + S3: ~$1200/mo
  baseline for a 3-node cluster excluding egress.
- Costs for Terraform outputs printed by the module at plan time.

## Operator responsibilities

- Rotate secrets on the documented schedule.
- Watch the `justmail health` panel.
- Test restore quarterly.
- Read the changelog before upgrading.

## Version support policy

- The current minor and the previous minor are supported.
- Security fixes for the last two minors.
- LTS releases marked in the changelog; supported for 12 months of
  security-only patches.
