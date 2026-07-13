# Architecture

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

## Control plane

- **API (NestJS 11):** REST + WebSocket, RFC 9457 problem responses, OpenAPI
  generated from Zod schemas, background workers (BullMQ on Redis).
- **Admin / webmail / landing (Next.js 16):** thin SPAs over the API.
- **Contracts (`packages/contracts`):** Zod schemas + event catalog are the
  single source of truth shared by API and frontends.

## Mail data plane

Postfix (MTA), Dovecot (IMAP/POP/LMTP/Sieve), Rspamd (spam), and ClamAV
(antivirus). The key idea: **the mail servers read their lookup tables from
PostgreSQL views**, so there is no host-specific mail config to hand-maintain —
create a mailbox in the console and Dovecot/Postfix see it immediately.

- **Traefik** terminates HTTPS for the web/API hosts.
- **certd** issues and renews certificates (ACME, DNS-01) for the mail host and
  the web hosts.

## Reconciler pattern

The control plane writes desired state to Postgres; the data plane reconciles to
it. DNS publishing follows the same idea: expected records are matched against
what the provider holds *by identity* (scheme/host), the matching record is
updated, unrelated records are left untouched, and stale same-kind duplicates
are removed.

## Data & storage

- **PostgreSQL** — control-plane state and the mail-plane views.
- **Redis** — queues (BullMQ), rate limits, realtime fan-out.
- **Object storage** — attachments and backups via `@justmail/storage` adapters.
- **Maildir** — one per user; on shared filesystems, tune Dovecot via
  `MAIL_STORAGE_BACKEND` and pin users with a Dovecot Director.

See [architecture.md](https://github.com/azedevlab/justmail/blob/main/docs/architecture.md)
and [multi-node.md](https://github.com/azedevlab/justmail/blob/main/docs/multi-node.md).
