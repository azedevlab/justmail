# JustMail

**Self-hosted mail hosting platform with a control plane you actually want to use.**

JustMail combines a battle-tested mail data plane (Postfix · Dovecot · Rspamd · ClamAV)
with a modern, API-first control plane (NestJS · Next.js · PostgreSQL · Redis) — domains,
mailboxes, DNS, DKIM, TLS, queue, and observability, all managed from a premium web UI.
No config file editing. Ever.

> Status: pre-release — Milestone 1 (core platform) in active development.

## Why

The mail stacks are good; the products around them are stuck in 2012. JustMail's thesis:
the mail data plane is a commodity — the product is the **control plane**: provisioning,
DNS automation, deliverability, and observability with the UX quality of Vercel, Stripe
and Linear.

## Highlights

- **Zero config editing** — Postfix/Dovecot read PostgreSQL directly; every change in the
  UI is live immediately
- **DNS Center** — Cloudflare-synced MX/SPF/DKIM/DMARC/MTA-STS, propagation + health
  checks, one-click repair
- **Real observability** — live mail flow, per-message tracing, queue management,
  structured log search (Loki), Prometheus metrics
- **Security first** — Rspamd + ClamAV, Fail2Ban, TOTP 2FA, RBAC, audit log, automatic TLS
- **API-first** — full REST API with OpenAPI spec, generated TypeScript SDK, WebSocket
  realtime events

## Repository layout

```
apps/web        Next.js 16 admin UI
apps/api        NestJS control plane (REST + WS + jobs)
packages/       shared types, generated SDK, design system
infra/          Docker Compose stack, service configs, deploy scripts
docs/phases/    architecture & design documents
```

See [`docs/phases/`](docs/phases/) for the full design: research, architecture, database,
API spec, design system, and roadmap.

## Development

```bash
pnpm install
pnpm dev          # web :3000, api :4000 (requires local compose stack)
```

## Deployment

One command from a clean Ubuntu host:

```bash
infra/scripts/bootstrap-server.sh   # once: Docker + hardening
infra/scripts/deploy.sh             # every release (also run by CI)
```

Secrets are provided via environment (`infra/compose/.env`) — never committed.

## License

AGPL-3.0. Commercial licensing planned for enterprise modules (SSO/SAML, LDAP sync,
clustering).
