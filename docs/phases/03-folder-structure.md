# Phase 3 — Folder structure

Monorepo: **pnpm workspaces + Turborepo**. TypeScript everywhere. One repo = API, UI,
shared packages, infrastructure, and docs — atomic changes across the whole platform.

```
JustMail/
├── apps/
│   ├── web/                      # Next.js 16 admin UI (App Router, RSC)
│   │   ├── src/
│   │   │   ├── app/              # routes: (auth)/, (dashboard)/domains, /mailboxes, ...
│   │   │   ├── components/       # app-specific composites (screens, panels)
│   │   │   ├── hooks/            # TanStack Query hooks (wrap @justmail/sdk)
│   │   │   ├── lib/              # ws client, query client, utils
│   │   │   └── styles/           # tailwind v4 entry + theme tokens
│   │   └── public/
│   └── api/                      # NestJS control plane
│       ├── src/
│       │   ├── modules/          # auth/ orgs/ domains/ dns/ mailboxes/ aliases/
│       │   │                     # queue/ events/ metrics/ certs/ security/
│       │   │                     # backups/ settings/ audit/ realtime/
│       │   ├── jobs/             # BullMQ processors (dns.reconcile, cert.renew, ...)
│       │   ├── providers/        # cloudflare/, acme/, postfix/, dovecot/, rspamd/
│       │   ├── db/               # migrations/ (SQL), seed/
│       │   └── common/           # guards, interceptors, rbac, pagination, errors
│       └── test/                 # e2e: real SMTP/IMAP round-trips against compose stack
├── packages/
│   ├── ui/                       # design system: shadcn/ui base + JustMail components
│   │   └── src/{components,tokens,icons}
│   ├── types/                    # shared domain types + zod schemas (single source)
│   └── sdk/                      # TS API client generated from OpenAPI (openapi-ts)
├── infra/
│   ├── compose/
│   │   ├── docker-compose.yml            # full production stack
│   │   ├── docker-compose.dev.yml        # local dev overrides (hot reload, mapped ports)
│   │   └── .env.example                  # every env var documented, no secrets
│   ├── services/                 # golden config templates (rendered once, state in PG)
│   │   ├── postfix/              # main.cf, master.cf, pgsql/*.cf lookup maps
│   │   ├── dovecot/              # dovecot.conf, dovecot-sql.conf.ext
│   │   ├── rspamd/               # local.d/*: dkim_signing, milter, ratelimit, antivirus
│   │   ├── traefik/              # static + dynamic config
│   │   ├── vector/               # vector.toml (log parse/fan-out)
│   │   ├── prometheus/           # prometheus.yml + alert rules
│   │   ├── grafana/              # provisioned datasources + dashboards
│   │   ├── loki/
│   │   └── fail2ban/             # jails for dovecot/postfix/api
│   ├── docker/                   # Dockerfiles for postfix, dovecot, certd, api, web
│   └── scripts/
│       ├── bootstrap-server.sh   # fresh Ubuntu → hardened Docker host
│       ├── deploy.sh             # one-command deploy (used by CI and humans)
│       └── backup.sh
├── docs/
│   ├── phases/                   # these planning documents (01–10)
│   ├── runbooks/                 # ops: restore, cert issues, queue floods, IP delisting
│   └── api/                      # generated OpenAPI artifacts
├── .github/workflows/            # ci.yml (lint+test+build), deploy.yml (SSH deploy)
├── package.json                  # workspace root (scripts: dev, build, lint, test)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Rules

1. **`packages/types` is the contract.** Zod schemas defined once; API validates with
   them, web infers from them, SDK re-exports them. No duplicated interfaces.
2. **`infra/services/*` are templates, not state.** Runtime truth lives in PostgreSQL
   (D1/D5). Templates change only when the *shape* of the stack changes.
3. **Apps never import from each other** — only via `packages/*`.
4. **Migrations are plain SQL** in `apps/api/src/db/migrations`, run by the API on boot
   (advisory-locked). The pgsql views consumed by Postfix/Dovecot live in migrations too.
5. **Everything deployable from a clean clone:** `pnpm i && pnpm build` then
   `infra/scripts/deploy.sh` — no undocumented steps.
