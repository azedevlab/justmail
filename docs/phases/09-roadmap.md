# Phase 9 — Implementation roadmap

Milestone gates are strict: nothing from M(n+1) starts before M(n) ships to example.com.

## Milestone 1 — Core platform (the current target)

**Definition of done:** a fresh Ubuntu server + one deploy command = working mail
hosting for example.com, fully managed from the UI; mail received from the internet and
sent (via smarthost until port 25 opens); zero SSH needed for daily operation.

Order of work (each step deployable):

| Step | Deliverable | Depends on |
|---|---|---|
| 1.1 | **Infra foundation**: compose stack (PG, Redis, Traefik, api, web stubs), bootstrap-server.sh, deploy.sh, GitHub Actions CI/CD, ACME certs live | — |
| 1.2 | **Auth & tenancy**: migrations #1, login/sessions/2FA, org bootstrap, RBAC guards, audit log | 1.1 |
| 1.3 | **Mail data plane**: postfix/dovecot/rspamd/clamav containers wired to PG views; manual SQL row = working mailbox (verified by real SMTP/IMAP round-trip) | 1.1 |
| 1.4 | **Domains & mailboxes UI+API**: CRUD, quotas, aliases, forwarding, catch-all, autoresponder, suspend; password flows; CSV import/export | 1.2, 1.3 |
| 1.5 | **DKIM + DNS Center**: key generation/rotation, Cloudflare sync, verification wizard, propagation checker, one-click repair, MTA-STS/TLS-RPT hosting | 1.4 |
| 1.6 | **Observability**: vector→loki + mail_events pipeline, dashboard (live cards/charts), queue management, log search, message tracing, WS realtime | 1.3 |
| 1.7 | **Security & certs surface**: fail2ban integration, blocked IPs, security score v1, cert dashboard, settings (smarthost toggle, limits) | 1.4 |
| 1.8 | **Hardening pass**: e2e test suite (SMTP/IMAP/API), backup job v1 (pg_dump + maildir → S3-compatible), runbooks, load sanity (10k mailboxes seeded) | all |

## Milestone 2 — Fleet & enterprise basics

Organizations self-service (invites, roles UI), API keys + Developer Portal (OpenAPI
docs, generated SDK), webhooks, backups UI (schedules, restore flows, S3/MinIO targets),
DNSBL monitoring + deliverability dashboard (DMARC report ingestion), country blocking,
LDAP/AD sync (commercial), SSO/OAuth (commercial), IP warmup scheduler.

## Milestone 3 — Webmail

JustMail Web client: conversation view, folders/labels, sieve-backed rules UI, TipTap
composer (rich text/markdown/HTML), undo send, scheduled send, full-text search
(Dovecot FTS + API), contacts, split view, offline-tolerant multi-account.

## Milestone 4 — Suite & scale

Calendar (CalDAV) & tasks, mobile-friendly PWA, multi-node data plane (MTA pool +
shared storage), clustering docs, marketplace/theming, BIMI/VMC assistant.

## Working agreements

- Every step lands as PR(s) with CI green: lint, typecheck, unit, e2e-in-compose.
- Deploy to example.com at least at every step boundary — the server is the demo.
- Schema changes only via migrations; no destructive migration without a backup gate.
- Docs in `docs/` updated in the same PR that changes behavior.
