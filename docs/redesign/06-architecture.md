# Software architecture

## Repository layout

```
justmail/
├─ apps/
│  ├─ admin/            # SPA — control plane (Next.js 16)
│  ├─ webmail/          # SPA — end-user mail client (Next.js 16)
│  ├─ landing/          # SSG — marketing + docs (Next.js 16)
│  └─ api/              # NestJS 11 — HTTP + WebSocket + workers
├─ packages/
│  ├─ contracts/        # zod schemas, event types, WS protocol
│  ├─ design-tokens/    # style dictionary source + build
│  ├─ shared-ui/        # Radix + Tailwind v4 primitive components
│  ├─ shared-utils/     # fetch client, hooks, i18n, date, format
│  ├─ theme-engine/     # token→CSS runtime, org+domain cascade
│  ├─ plugin-sdk/       # host + guest APIs, manifest schema
│  ├─ storage/          # PutObject/GetStream adapters
│  ├─ mail-parser/      # mailparser wrapper + fuzz tests
│  ├─ openapi/          # zod→openapi compile step
│  └─ eslint-config/    # shared linting rules
├─ services/
│  ├─ compose/          # single-node docker-compose
│  ├─ helm/             # HA Kubernetes chart
│  ├─ terraform/        # AWS + Hetzner + DO one-click
│  ├─ postfix/          # config templates
│  ├─ dovecot/          # config templates
│  ├─ rspamd/           # config templates
│  ├─ traefik/          # dynamic config
│  └─ vector/           # log shipping
├─ docs/                # markdown (rendered by landing app)
├─ scripts/             # installer, backup, restore, cli
├─ tests/e2e/           # playwright specs across all apps
└─ tools/
   ├─ cli/              # `justmail` binary (Node 22)
   └─ migrator/         # migration runner + verifier
```

**Why this shape**

- `apps/` are user-facing surfaces. Splitting admin and webmail lets them
  ship independently and reduces bundle bleed.
- `packages/` are library code. Only names starting with `@justmail/…` are
  public; anything under `packages/_internal/…` is repo-private.
- `services/` hold infra-as-code, not application code. This keeps the
  runtime configuration under version control without polluting apps.
- `tools/` are batteries-included operator scripts published as a single
  `justmail` CLI.

## Runtime topology (single-node)

```
                                    ┌─────────────┐
                                    │   Traefik   │
                                    └──────┬──────┘
                                           │
             ┌───────┬───────────┬─────────┼──────────┬─────────────┐
             │       │           │         │          │             │
       ┌─────▼─┐ ┌───▼───┐ ┌─────▼──┐ ┌────▼───┐ ┌────▼───┐ ┌───────▼─────┐
       │landing│ │ admin │ │webmail │ │  api   │ │caldav  │ │ mta-sts     │
       └───────┘ └───┬───┘ └───┬────┘ └───┬────┘ └────────┘ └─────────────┘
                     │         │          │
                     └─────────┴─▲────────┘
                                 │
                       ┌─────────┴─────────┐
                       │  api (WebSocket)  │
                       └─────────┬─────────┘
                                 │
        ┌─────────────┬──────────┼──────────┬──────────────────┐
        │             │          │          │                  │
   ┌────▼────┐  ┌─────▼──┐  ┌────▼───┐ ┌────▼─────┐ ┌──────────▼──┐
   │Postgres │  │ Redis  │  │ Storage│ │ Postfix  │ │  Rspamd     │
   │  (PG17) │  │(BullMQ)│  │adapter │ │ Dovecot  │ │  ClamAV     │
   └─────────┘  └────────┘  └───┬────┘ └──────────┘ └─────────────┘
                                │
                    ┌───────────┴────────────┐
                    │ local / S3 / R2 / MinIO│
                    │ / B2 / Azure / GCS     │
                    └────────────────────────┘
```

For HA, replace boxes with pools as described in `10-deployment.md`.

## Service boundaries

### `apps/api`

- Nest modules mirror v0's structure but with mandatory patterns:
  - Every domain module ships `module.ts`, `controller.ts`, `service.ts`,
    `repo.ts` (pure SQL), and `events.ts` (WS/webhook publisher).
  - No cross-module SQL. Modules talk to each other through `service.ts`.
  - Workers live under `apps/api/src/workers/` and start via `worker.ts`
    which shares the same NestApplicationContext as the HTTP process.
- HTTP entrypoints: REST `/v1/…`, health `/healthz`, metrics `/metrics`,
  MTA-STS `/.well-known/mta-sts.txt`, OpenAPI `/openapi.json`.
- WebSocket entrypoint: `/v1/ws`, ticket-authenticated (short-lived signed
  ticket handed to the client via REST, avoids leaking cookies to logs).
- Idempotency: header `Idempotency-Key` recorded per `(org_id, key)` in
  Redis; replays return the cached response for 24 h.
- Error contract: RFC 9457 `application/problem+json` — always. Field errors
  populate `.errors[]`.

### `apps/admin`

- App Router, React Server Components for the read paths, Client Components
  only where interactivity or realtime is required.
- Data layer: TanStack Query v5 with a shared client factory in
  `packages/shared-utils`.
- Auth: same session cookie, refreshed via a silent `POST /v1/auth/touch`
  every ~5 min.
- Routes structured as `/orgs/:orgId/(section)` with a persistent shell.

### `apps/webmail`

- Same stack as admin but a completely different information architecture:
  three-pane by default, split view optional, thread view for touch.
- Message cache in IndexedDB via `idb-keyval`; background sync worker
  fetches deltas via the WS `webmail:mailbox:<id>` topic.
- Composer in TipTap 3; hardcoded set of plugins (list, link, code, image,
  markdown, HTML mode, mention).

### `apps/landing`

- Static generation for marketing pages. MDX for docs, with a directory
  structure that mirrors `docs/`.
- Docs router: `/docs/[version]/[...slug]`. Version defaults to `latest`.
- Search: Pagefind or DocSearch (self-hosted).

## Data flow — three canonical paths

### 1. Inbound mail

```
Public MTA → Postfix (postscreen + mynetworks) → Rspamd → ClamAV → LMTP → Dovecot
                                                                       │
                                                              Vector tails logs
                                                                       │
                                                              api /ingest/events
                                                                       │
                                                              mail_events + WS
```

Every hop is a Vector transform: postfix, rspamd, dovecot logs are parsed
into structured events. mail_events rows carry the queue id, sender/recipient,
spam score, tls version, dsn, delay.

### 2. Sending mail (webmail)

```
Webmail composer → POST /v1/webmail/mailboxes/:id/send
                 → BullMQ "outbound" queue
                 → Worker: SMTP submission to Postfix on :587
                 → Postfix → outbound to internet
                 → Vector → mail_events (event=postfix.smtp.sent)
                 → api emits event → WS webmail channel
```

Undo Send holds the message in Redis for a user-configurable 5–30 s before
handing to Postfix.

### 3. Mutation via API

```
Client → REST /v1/orgs/:orgId/mailboxes
       → NestGuard (session/bearer) → Zod pipe
       → Service → Repo (transaction) → Postgres
       → EventBus.publish(mailbox.created)
       → { WS + webhook + audit_log } fan-out
       → Response
```

The `EventBus` is a tiny in-process publisher wrapping Postgres LISTEN/NOTIFY.
Every published event carries `{ org_id, type, entity, meta, at }` and is
persisted in `events` for replay.

## Contracts and code generation

- `packages/contracts` is the single source of truth for shapes.
  - Zod schemas live here (`CreateMailboxRequest`, `Mailbox`, etc.).
  - Types are `z.infer<typeof …>` — never hand-written.
  - Event types are a discriminated union tagged by `type`.
- `packages/openapi` reads Nest controller metadata + Zod schemas at build
  time and emits `openapi.json`. No hand-authored spec exists.
- SDKs: v1.0 ships a first-party TypeScript SDK generated from OpenAPI;
  Python and Go generators are stubbed out for v1.1.

## State management

- Server state: TanStack Query. Query keys tagged by `orgId` so switching
  orgs invalidates cleanly.
- URL state: next/navigation for filters, sort, pagination.
- Local UI state: Zustand where React state gets heavy (composer, layout).
- Global toasts, notifications, command palette: a single Zustand store
  hydrated at boot.

## Realtime

- WebSocket per user session; multiplexes topic subscriptions.
- Topics: `org:<id>:events`, `webmail:mailbox:<id>`, `queue:snapshot`,
  `notifications:user:<id>`.
- Server-side authorization on `subscribe`; unauthorized topics silently
  ignored (never leak existence).
- Fallback: SSE endpoint (`/v1/stream`) for environments that block WS.

## Storage abstraction

```
interface StorageAdapter {
  putObject(key: string, body: ReadableStream, meta: PutMeta): Promise<Etag>;
  getStream(key: string, range?: Range): Promise<ReadableStream>;
  headObject(key: string): Promise<HeadResult>;
  deleteObject(key: string): Promise<void>;
  signUrl(key: string, method: "GET" | "PUT", ttlSec: number): Promise<string>;
  copyObject(from: string, to: string): Promise<void>;
  listPrefix(prefix: string, cursor?: string): AsyncIterable<Entry>;
}
```

Adapters: `LocalAdapter`, `S3Adapter`, `R2Adapter`, `MinioAdapter`,
`BackblazeAdapter`, `AzureAdapter`, `GcsAdapter`. Chosen at boot via a
factory keyed off the `STORAGE_KIND` env; per-org overrides come from a
settings row (`storage.default = "s3"` etc.).

## Attachment lifecycle

1. Client opens a chunked upload (tus.io).
2. Server returns an upload id + signed slot in the storage adapter.
3. Client streams chunks directly (no proxy) with resumable state.
4. On completion the storage adapter emits `object.finalised`.
5. Virus scan worker fetches the stream, sends to ClamAV.
6. If clean: mark `ready`, generate thumbnail (worker), emit
   `attachment.ready`.
7. Message compose references the attachment by id; on send, MIME builder
   inlines by content or by URL depending on message size.

## Plugin runtime

- Manifest (`justmail.plugin.json`): name, version, permissions[], slots[],
  server entry, client entry, signing key id.
- Loader boots enabled plugins from `plugins/<name>/<version>/` at startup.
- Server:
  - Worker thread per plugin (v1.0 keeps it simple; v1.1 explores V8
    isolates for lower overhead).
  - Capabilities injected via a typed `PluginHost` object. Plugins never
    import from `apps/api`.
- Client:
  - Iframe with `sandbox="allow-scripts"`, hard-coded CSP.
  - Communication via postMessage with a typed protocol from `plugin-sdk`.
  - Slot registry auto-mounts plugin components in the right host slots
    (React portals under the hood).

## Configuration

- 12-factor: everything driven by environment variables.
- One schema (`packages/contracts/env.ts`) drives runtime validation on
  every process at boot; boot fails loudly.
- Secrets: never in the repo. Local dev uses `.env.local` gitignored; prod
  uses whatever the operator prefers (env, docker secrets, AWS SM, GCP SM,
  Vault). Provided helpers wrap each.

## Language / runtime choices

- Node 22 for everything runtime.
- TypeScript 5.9 strict + `noUncheckedIndexedAccess`.
- pnpm 10 with workspaces; Turborepo pipelines.
- Vitest for unit; Playwright for e2e; Testcontainers for integration.

## Non-Node components

- Postfix, Dovecot, Rspamd, ClamAV, Vector, Traefik, Loki, Prometheus,
  Grafana, Radicale, PgBouncer, HAProxy.
- All run as containers. Custom configs live under `services/`.
