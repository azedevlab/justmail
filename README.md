<div align="center">

# JustMail — Self-Hosted Email Server & Webmail Platform

**Own your email.** A modern, open-source, self-hosted mail server with a
Gmail-class webmail, a full admin console, and deliverability configured out of
the box — Postfix, Dovecot, Rspamd, and ClamAV wired together and driven from
one API.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![SDK License: Apache 2.0](https://img.shields.io/badge/SDK-Apache_2.0-green.svg)](LICENSE-APACHE)
[![Made with TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Docker Compose](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ed.svg)](services/compose/docker-compose.yml)
[![Kubernetes Helm](https://img.shields.io/badge/Deploy-Helm-0f1689.svg)](services/helm/justmail)

**Self-hosted Gmail alternative · Docker mail server · Postfix + Dovecot + Rspamd · SPF/DKIM/DMARC automated · Multi-tenant**

</div>

---

## Why JustMail

Running your own mail server has always meant hand-editing Postfix maps, fighting
Dovecot index locks, and guessing at SPF/DKIM/DMARC until Gmail stops sending you
to spam. JustMail replaces that with a single control plane: create a domain in
the admin console and it provisions the mailboxes, generates DKIM keys, and
publishes every DNS record (SPF, DKIM, DMARC, MTA-STS, TLS-RPT, BIMI, CAA) to
your DNS provider — then verifies them green.

- 📬 **Gmail-class webmail** — fast search, threading, labels, filters/Sieve,
  drafts, scheduled send, contacts, and browser push notifications.
- 🛠️ **Full admin console** — domains, mailboxes, aliases, DKIM, DNS Center,
  deliverability dashboards, security, webhooks, API keys, and backups.
- 📈 **Deliverability by default** — SPF, DKIM, DMARC, MTA-STS, TLS-RPT, BIMI,
  CAA and ARC configured and monitored, with one-click DNS publishing.
- 🔒 **Secure by design** — per-tenant isolation, encrypted credential storage,
  passkeys/WebAuthn, OIDC/SAML SSO, SCIM provisioning, rate limiting, and
  ClamAV attachment scanning.
- 🧩 **Extensible** — a plugin SDK and a token-based theme engine so you extend
  the platform without forking.
- ☁️ **Runs anywhere** — Docker Compose on one box, or Helm on Kubernetes;
  pluggable object storage (Local, S3, Cloudflare R2, MinIO, Backblaze B2,
  Wasabi, DigitalOcean Spaces, Scaleway, Ceph, Azure Blob, GCS) and DNS
  providers (Cloudflare, deSEC, and more behind one interface).

## Quick start (Docker Compose)

Requirements: a Linux host (≥ 4 vCPU / 16 GB RAM), a domain you control, and
ports 25/80/443/465/587/993/995 open. Full details in the
[Installation Guide](INSTALL.md).

```bash
git clone https://github.com/azedevlab/justmail.git
cd justmail
cp services/compose/.env.example services/compose/.env
# Edit services/compose/.env: set your domain, DNS token, and secrets
#   generate secrets with:  openssl rand -hex 32

docker compose -f services/compose/docker-compose.yml \
  --profile core --profile certs --profile mail --profile app up -d
```

One-command install on Ubuntu 24.04+:

```bash
curl -fsSL https://raw.githubusercontent.com/azedevlab/justmail/main/scripts/install.sh | sudo bash
```

Kubernetes (Helm):

```bash
helm install justmail ./services/helm/justmail --values my-values.yaml
```

👉 **New here? Read the [Installation Guide](INSTALL.md) and the
[Wiki](https://github.com/azedevlab/justmail/wiki).**

## Architecture

```
        ┌────────────┐     ┌────────────┐     ┌────────────┐
        │  admin SPA │     │ webmail SPA│     │  landing   │   Next.js 16
        └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
              └──────────────────┼──────────────────┘
                          ┌──────▼──────┐
                          │     API     │  NestJS 11 · REST + WebSocket
                          │  + workers  │  RFC 9457 errors · OpenAPI
                          └──────┬──────┘
              ┌──────────────────┼──────────────────┐
        ┌─────▼─────┐     ┌──────▼─────┐      ┌──────▼──────┐
        │ Postgres  │     │   Redis    │      │   Storage   │  S3/R2/MinIO/…
        └───────────┘     └────────────┘      └─────────────┘
                          ┌──────▼──────────────────────────┐
                          │  Postfix · Dovecot · Rspamd ·    │  mail data plane
                          │  ClamAV · Traefik · certd        │
                          └──────────────────────────────────┘
```

The control-plane API and the mail data plane share PostgreSQL views, so the
mail servers read their lookup tables straight from the database — no
host-specific config to hand-maintain. See [docs/architecture.md](docs/architecture.md)
and [docs/multi-node.md](docs/multi-node.md) for the scale-out design.

## Repository layout

```
apps/
  admin/        Control-plane console (Next.js 16)
  webmail/      End-user webmail (Next.js 16)
  landing/      Marketing + docs site (Next.js 16)
  api/          REST + WebSocket + workers (NestJS 11)

packages/
  contracts/    Zod schemas + event catalog (single source of truth)
  design-tokens/ Style Dictionary tokens (color, type, spacing, motion)
  shared-ui/    Primitive components (Radix + Tailwind v4)
  shared-utils/ Fetch client, hooks, i18n, formatters
  theme-engine/ Token → CSS runtime with tenant scopes
  storage/      Object-storage adapters (Local, S3, R2, MinIO, B2, Azure, GCS, …)
  plugin-sdk/   Host + guest APIs for plugin authors
  mail-parser/  Hardened MIME parser
  openapi/      Zod → OpenAPI compile step
  eslint-config/ Shared lint rules

services/
  compose/      Single-node docker-compose stack
  docker/       Container image definitions
  helm/         Kubernetes chart
  terraform/    Cloud provisioning
  mail/         Postfix, Dovecot, Rspamd, Vector, Traefik configs

tools/
  cli/          `justmail` operator CLI
  migrator/     DB migration runner + verifier

docs/           Architecture, deployment, runbooks, API reference
tests/          e2e (Playwright), integration (Testcontainers), perf (k6), security
```

## Development

```bash
pnpm install
pnpm dev          # brings up everything with hot reload
pnpm typecheck    # full workspace typecheck
pnpm test         # unit + integration
pnpm lint         # eslint across the workspace
```

Requires Node 22+ and pnpm 10+. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- 📖 [Installation Guide](INSTALL.md)
- 🧭 [Wiki](https://github.com/azedevlab/justmail/wiki) — install, configuration, architecture, FAQ
- 🏗️ [Architecture](docs/architecture.md) · [Multi-node scale-out](docs/multi-node.md)
- 🗄️ [Distributed mail storage](docs/deployment/shared-storage.md)
- 🩺 [Operational runbooks](docs/runbooks/)

## License

- Platform (apps + services + docs): **AGPL-3.0-only** — see [`LICENSE`](LICENSE).
- SDKs and plugin protocol (`packages/plugin-sdk`, `packages/contracts`):
  **Apache-2.0** — see [`LICENSE-APACHE`](LICENSE-APACHE).

Each package's `package.json` declares its effective license.

## Security

Found a vulnerability? Please follow the coordinated disclosure process in
[`SECURITY.md`](SECURITY.md). Do not open a public issue for security reports.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and
our [Code of Conduct](CODE_OF_CONDUCT.md).
