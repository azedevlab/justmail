# Phase 5 — API specification

Base URL: `https://api.<host>/v1`. JSON only. OpenAPI 3.1 generated from NestJS
decorators + zod schemas (`@justmail/types`), published at `/v1/openapi.json` and
rendered in the Developer Portal. TypeScript SDK (`@justmail/sdk`) generated in CI.

## 1. Conventions

- **Auth:** session cookie (UI) or `Authorization: Bearer jm_live_…` (API keys, scoped).
- **Tenancy:** org resolved from the authenticated principal; admin routes take explicit
  IDs. All IDs are UUIDs.
- **Pagination:** cursor-based — `?limit=50&cursor=…` → `{ data, next_cursor }`.
- **Filtering:** documented per-list, e.g. `?status=active&search=ali`.
- **Errors:** RFC 9457 problem+json: `{ type, title, status, detail, errors? }`
  (`errors` = zod field issues).
- **Mutations:** every write emits an `audit_logs` row and a WS event.
- **Idempotency:** `Idempotency-Key` header honored on all POSTs.
- **Rate limits:** per key/session, `RateLimit-*` headers.

## 2. REST resources

### Auth & identity
```
POST   /auth/login                    email+password (+ totp_code)
POST   /auth/logout
GET    /auth/me
POST   /auth/2fa/setup | /2fa/verify | /2fa/disable
GET    /auth/sessions                 list active sessions
DELETE /auth/sessions/:id             revoke
```

### Organizations, members, API keys
```
GET/POST          /orgs               (bootstrap: first user creates org)
GET/PATCH/DELETE  /orgs/:id
GET/POST          /orgs/:id/members   invite (role), list
PATCH/DELETE      /orgs/:id/members/:userId
GET/POST          /api-keys           create returns full key ONCE
DELETE            /api-keys/:id       revoke
GET               /audit-logs         ?actor=&action=&target=&from=&to=
```

### Domains
```
GET/POST          /domains
GET/PATCH/DELETE  /domains/:id        PATCH: catch_all, limits, outbound_mode
POST   /domains/:id/verify            trigger verification check
GET    /domains/:id/health            aggregated health (rdns, mx, dnssec, blocklists, cert)
GET    /domains/:id/setup             full setup state machine for onboarding wizard
POST   /domains/:id/dkim              generate new key {algorithm}
POST   /domains/:id/dkim/:keyId/activate | /retire
```

### DNS Center
```
GET    /domains/:id/dns               all records: desired + observed + check_status
POST   /domains/:id/dns/sync          push all managed records to Cloudflare
POST   /domains/:id/dns/repair        one-click: fix drifted/missing managed records
POST   /domains/:id/dns/check         force propagation re-check
GET/POST/PATCH/DELETE /domains/:id/dns/records[/:recordId]   custom records
```

### Mailboxes & aliases
```
GET/POST          /domains/:id/mailboxes
GET/PATCH/DELETE  /mailboxes/:id      PATCH: name, quota, flags, forwarding, autoresponder
POST   /mailboxes/:id/password        set/reset (returns nothing; optional email notify)
POST   /mailboxes/:id/suspend | /activate
GET    /mailboxes/:id/usage           quota, last login, per-folder sizes
POST   /domains/:id/mailboxes/import  CSV multipart → job id
GET    /domains/:id/mailboxes/export  CSV stream
GET/POST          /domains/:id/aliases
PATCH/DELETE      /aliases/:id
```

### Mail queue
```
GET    /queue                         ?state=deferred&search= (live from postqueue -j)
GET    /queue/stats                   counts + trend (queue_snapshots)
POST   /queue/:queueId/retry | /hold | /release | /delete
POST   /queue/actions                 bulk {ids[], action}
```

### Logs & tracing
```
GET    /events                        ?direction=&event=&domain=&search=&from=&to= (mail_events)
GET    /events/trace/:queueId         full lifecycle of one message (chain of events)
GET    /logs/query                    proxied scoped Loki query (raw log search)
```

### Certificates, security, backups
```
GET/POST /certificates                POST {domains[], kind} → ACME order job
POST     /certificates/:id/renew
GET      /security/overview           score + threat dashboard data
GET/POST/DELETE /security/blocked-ips
GET/PATCH /security/fail2ban          jail states, unban
GET/POST  /backups                    POST {kind} → job; GET list
POST      /backups/:id/restore        (guarded: requires re-auth)
GET/PATCH /settings                   smarthost, limits, branding, notifications
```

### Metrics (dashboard)
```
GET    /metrics/overview              cards: cpu, ram, disk, queue, flow rate, spam %, tls %
GET    /metrics/series?name=&range=   Prometheus range-query proxy (allow-listed queries)
GET    /system/containers             compose service states + versions
```

## 3. WebSocket — `wss://api.<host>/v1/ws`

Auth: same session/key. Client subscribes to channels; server pushes typed events
(zod-validated, shared via `@justmail/types`).

| Channel | Events |
|---|---|
| `metrics` | `metrics.tick` (5s: cpu/ram/disk/queue/flow) |
| `mail` | `mail.event` (each parsed mail_event — powers live flow) |
| `queue` | `queue.changed` |
| `dns` | `dns.check.updated`, `dns.sync.completed` |
| `jobs` | `job.progress` (imports, backups, cert orders) |
| `security` | `security.ip_blocked`, `security.threat` |

Envelope: `{ channel, event, data, ts }`. UI reaction: TanStack Query invalidation +
optimistic live widgets.

## 4. Jobs contract

Long-running POSTs return `202 { job_id }`; progress via `GET /jobs/:id` and `jobs` WS
channel. Used by: DNS sync, imports, backups, cert orders, health checks.

## 5. Versioning & compatibility

- Path-versioned (`/v1`). Additive changes only within a version.
- SDK generated per release; OpenAPI diff checked in CI (breaking-change gate).
- Webhooks (M2): org-configurable endpoints, HMAC-signed, event types mirror WS events.
