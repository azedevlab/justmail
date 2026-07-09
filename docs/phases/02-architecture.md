# Phase 2 — Architecture

## 1. High-level model: control plane vs data plane

```
                        ┌─────────────────────────────────────────────┐
                        │                CONTROL PLANE                │
                        │                                             │
  Browser ── HTTPS ──►  │  Traefik ──► web (Next.js 16)              │
                        │          ──► api (NestJS)  ◄── ws (realtime)│
                        │                │                            │
                        │                ▼                            │
                        │  PostgreSQL ◄──┼──► Redis ◄── BullMQ workers│
                        │  (desired +    │    (cache, pub/sub, queues)│
                        │   observed     │                            │
                        │   state)       ▼                            │
                        │        Reconciler (DNS, DKIM, certs, drift) │
                        └────────┬───────────────────────┬────────────┘
                                 │ pgsql lookup maps     │ Cloudflare API,
                                 │ (read-only views)     │ ACME, AWS PTR check
                        ┌────────▼────────────────────┐  ▼
                        │         DATA PLANE          │  external world
                        │                             │
  SMTP 25/465/587 ────► │  Postfix ◄──► Rspamd ◄──► ClamAV
  IMAP 993 / POP3 995 ► │  Dovecot (auth/userdb via SQL)
  Sieve 4190 ─────────► │  (maildir volume)           │
                        └────────┬────────────────────┘
                                 │ syslog/stdout
                        ┌────────▼────────────────────┐
                        │        OBSERVABILITY        │
                        │  Vector → Loki (raw logs)   │
                        │         → api (parsed mail  │
                        │            events → PG+WS)  │
                        │  Prometheus ← exporters     │
                        │  Grafana (ops), Tempo (api) │
                        └─────────────────────────────┘
```

**Rule:** the data plane never depends on the control plane being up. If the API dies,
mail keeps flowing — Postfix/Dovecot read PostgreSQL directly via lookup maps, and
PostgreSQL is the only shared dependency (it gets the highest availability budget).

## 2. Core decisions (with rationale)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Postfix + Dovecot query PostgreSQL directly** (`pgsql:` maps, SQL auth) | Mailbox/domain/alias CRUD is a DB write — instant, no reloads, no config editing. Proven at scale (Mailcow uses MySQL the same way). |
| D2 | **Rspamd only** — no OpenDKIM/OpenDMARC | Rspamd does DKIM sign/verify, DMARC, ARC, greylisting, rate-limit, RBLs, and fronts ClamAV. One HTTP API for the control plane. |
| D3 | **Traefik is the single edge proxy** | Native Docker service discovery + ACME for the web tier; mail ports (25/465/587/993/995/4190) are published directly by Postfix/Dovecot — proxying SMTP adds latency and breaks client-IP handling for zero benefit on one node. Nginx dropped. |
| D4 | **Certificates via ACME DNS-01 (Cloudflare) with a dedicated `certd` job** | One wildcard-capable flow that works before ports are open, covers mail hostnames (`mail.`, `autoconfig.`, `mta-sts.`), stores certs in a shared volume, hot-reloads Postfix/Dovecot. Traefik handles its own HTTPS certs the same way. |
| D5 | **Desired-state reconciler** | `domains`, `dns_records`, `dkim_keys`, `certificates` tables hold *desired* state; BullMQ jobs reconcile against Cloudflare/ACME/filesystem and write *observed* state. Enables drift detection + "one-click repair". |
| D6 | **Log-derived mail events** | Vector tails Postfix/Dovecot/Rspamd logs → (a) Loki for raw search, (b) HTTP sink into the API which parses into `mail_events` (queued/sent/deferred/bounced) keyed by queue-id → powers tracing, live flow, bounce tracking. No MTA patches. |
| D7 | **Outbound routing is switchable** | `direct` (default once port 25 opens) or `smarthost` (SES/any relay via 587) — a Settings toggle writing Postfix relayhost params via pgsql map. Current AWS block ≠ blocker. |
| D8 | **Org-scoped multi-tenancy from migration #1** | `organizations → domains → mailboxes/aliases`; every API query is org-scoped. Single-node deploy now, no schema rewrite for clustering later. |
| D9 | **Realtime via Redis pub/sub → WebSocket gateway** | API workers publish events (mail flow, queue depth, health checks); NestJS WS gateway fans out to the dashboard. TanStack Query cache invalidation driven by WS messages. |
| D10 | **Monorepo: pnpm workspaces + Turborepo** | Shared types between NestJS and Next.js, generated TS SDK from OpenAPI, atomic PRs across API+UI. |

## 3. Service topology (Docker Compose)

| Container | Image base | Role | Exposed |
|---|---|---|---|
| `traefik` | traefik v3 | Edge: HTTPS, routing, web ACME | 80, 443 |
| `web` | node (Next.js standalone) | Admin UI | via traefik |
| `api` | node (NestJS) | REST + WS + reconciler + log-event ingest | via traefik (`api.` host) |
| `worker` | node (NestJS, BullMQ processors) | DNS sync, health checks, cert renew, backups, DNSBL monitor | — |
| `postgres` | postgres 17 | Control-plane + lookup source of truth | internal |
| `redis` | redis 7 | Cache, queues, pub/sub | internal |
| `postfix` | debian + postfix | SMTP in/out, submission | 25, 465, 587 |
| `dovecot` | dovecot/dovecot | IMAP/POP3/LMTP/Sieve, maildir owner | 993, 995, 4190 |
| `rspamd` | rspamd/rspamd | Milter: spam, DKIM, DMARC, ratelimit | internal (11332–11334) |
| `clamav` | clamav/clamav | AV scanning (via rspamd) | internal |
| `certd` | lightweight ACME (lego) | DNS-01 issuance/renewal → shared cert volume + reload hooks | — |
| `vector` | timberio/vector | Log shipping/parsing fan-out | internal |
| `loki` | grafana/loki | Log store | internal |
| `prometheus` | prom/prometheus | Metrics (node, postfix, dovecot, rspamd, postgres, redis exporters) | internal |
| `grafana` | grafana/grafana | Ops dashboards (admin-only, behind traefik) | via traefik |
| `fail2ban` | crazymax/fail2ban | Host-level bans from auth-failure logs (reads vector output) | host network |

Volumes: `vmail` (maildirs), `certs`, `pgdata`, `redisdata`, `rspamd-data`, `loki-data`, `prom-data`.
Networks: `edge` (traefik↔web/api), `mail` (postfix↔dovecot↔rspamd↔clamav), `data` (pg/redis), `observability`.

## 4. Mail flow

**Inbound:** `Postfix:25 → rspamd milter (spam/DKIM-verify/DMARC/AV) → LMTP → Dovecot → maildir`.
Quota enforced by Dovecot (SQL-backed), sieve filters per-user via ManageSieve.

**Outbound:** `Client → Postfix:465/587 (SASL auth against Dovecot) → rspamd (DKIM sign, rate-limit) → direct MX | smarthost (D7)`.

**Auth:** Dovecot SQL passdb (argon2id hashes) is the single auth source for
IMAP/POP3/SMTP-SASL. Control-plane logins are separate (`users` table, sessions + 2FA);
a mailbox is not automatically a platform user.

## 5. Control-plane internals (NestJS)

Modules: `auth` (sessions, 2FA TOTP, API keys), `orgs`, `domains` (verification,
DKIM lifecycle), `dns` (Cloudflare provider abstraction, propagation/health checks),
`mailboxes`, `aliases`, `queue` (postqueue via postfix container exec API — narrow,
allow-listed command surface), `events` (log ingest + tracing), `metrics`
(Prometheus query proxy for dashboard charts), `certs`, `security` (fail2ban state,
blocklists), `backups`, `settings`, `audit` (append-only log of every mutation),
`realtime` (WS gateway).

**Job queues (BullMQ):** `dns.reconcile`, `dns.propagation-check`, `domain.health-check`,
`cert.renew`, `dkim.rotate`, `dnsbl.monitor`, `backup.run`, `events.aggregate`.

## 6. Security baseline

- All secrets via environment (`.env` on server, never committed); Cloudflare token
  scoped to zone-edit on the target zone only.
- API: session cookies (httpOnly, SameSite=Lax) for the UI, `Authorization: Bearer` API
  keys (hashed at rest) for programmatic access; RBAC (owner/admin/member/viewer) per org.
- Argon2id for all password hashes; TOTP 2FA; audit log on every mutation.
- Postfix: no open relay (SASL required on submission, recipient restrictions on 25),
  TLS required on submission, `smtpd_tls_security_level=may` on 25 (opportunistic).
- Fail2Ban jails: dovecot-auth, postfix-sasl, api-login.
- Containers run non-root where images allow; mail network isolated from edge network.

## 7. Scaling path (beyond M1)

1. **Now:** single node, all services one compose file.
2. **Vertical + volumes:** maildir on dedicated EBS volume, PG tuned.
3. **Split planes:** control plane on separate node; multiple MTA nodes (stateless
   Postfix reading same PG; Dovecot director or shared-storage maildir).
4. **Object-storage mail** (dovecot obox alternatives / mdbox on shared FS) when
   mailbox count demands it. Schema and API are unchanged throughout — only deployment topology evolves.
