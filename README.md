# JustMail

Self-hosted mail platform. The mail server you actually want to run.

**Status:** v1.0 alpha. See [docs/redesign/](docs/redesign/) for the design
plan and [docs/redesign/13-roadmap.md](docs/redesign/13-roadmap.md) for the
milestone schedule.

## What it is

- A modern **admin console** (`apps/admin`) for domains, mailboxes, aliases,
  DKIM, DNS Center, deliverability, security, webhooks, API keys, backups.
- A **webmail** (`apps/webmail`) that competes with Gmail on features and
  feels faster.
- A **landing site** (`apps/landing`) with versioned docs.
- An **API** (`apps/api`) with REST + WebSocket, RFC 9457 errors, OpenAPI
  generated from schemas, plugin-safe extension surface.
- A data plane built on Postfix, Dovecot, Rspamd, ClamAV — configured for
  deliverability out of the box (SPF, DKIM, DMARC, MTA-STS, TLS-RPT, BIMI,
  CAA, ARC).
- A **plugin system** and a **theme engine** so operators can extend
  everything without forking.

## Install

Ubuntu one-liner (24.04+):

```bash
curl -fsSL https://get.justmail.dev | sudo bash
```

Kubernetes:

```bash
helm repo add justmail https://charts.justmail.dev
helm install justmail justmail/justmail --values values.yaml
```

Docker Compose (single node):

```bash
git clone https://github.com/justmaildev/justmail
cd justmail
cp services/compose/.env.example services/compose/.env
docker compose -f services/compose/docker-compose.yml \
  --profile core --profile mail --profile app up -d
```

Full guide: [docs/redesign/11-installation.md](docs/redesign/11-installation.md).

## Repository layout

```
apps/
  admin/              Control-plane SPA (Next.js 16)
  webmail/            End-user webmail SPA (Next.js 16)
  landing/            Marketing + docs site (Next.js 16)
  api/                REST + WebSocket + workers (NestJS 11)
  legacy-admin/       v0 admin (archived; slated for removal after M6)

packages/
  contracts/          Zod schemas + event catalog (single source of truth)
  design-tokens/      Style Dictionary tokens (colors, type, spacing, motion)
  shared-ui/          Primitive components (Radix + Tailwind v4)
  shared-utils/       Fetch client, hooks, i18n, formatters
  theme-engine/       Token → CSS runtime with tenant scopes
  storage/            Object-storage adapters (Local, S3, R2, MinIO, B2, Azure, GCS)
  plugin-sdk/         Host + guest APIs for plugin authors
  mail-parser/        Hardened MIME parser
  openapi/            Zod → OpenAPI compile step
  eslint-config/      Shared lint rules

services/
  compose/            Single-node docker-compose stack
  docker/             Container image definitions
  helm/               Kubernetes chart
  terraform/          AWS / Hetzner / DO one-click
  mail/               Postfix, Dovecot, Rspamd, Vector, Traefik configs

tools/
  cli/                `justmail` operator CLI
  migrator/           DB migration runner + verifier

docs/
  redesign/           v1.0 architecture, requirements, security, roadmap
  runbooks/           Operational playbooks
  api/                Generated API reference

tests/
  e2e/                Playwright specs
  integration/        Testcontainers-backed integration
  perf/               k6 scripts
  security/           Fuzz + cross-tenant probes
```

## Development

```bash
pnpm install
pnpm dev              # brings up everything with hot reload
pnpm typecheck        # full workspace typecheck
pnpm test             # unit + integration
pnpm lint             # eslint across the workspace
```

## License

- Platform (apps + services + docs): **AGPL-3.0-only**.
- SDKs and plugin protocol (`packages/plugin-sdk`, `packages/contracts`,
  future `packages/sdk-*`): **Apache-2.0**.

See [`LICENSE`](LICENSE), [`LICENSE-APACHE`](LICENSE-APACHE), and each
package's `package.json` for the effective license.

## Security

Vulnerability disclosure: see [`SECURITY.md`](SECURITY.md).
