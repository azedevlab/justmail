# API specification

Two protocols. REST for request/response mutations and read paths;
WebSocket for realtime subscriptions and streaming events.

## Versioning

- URL-prefixed: `/v1/…`. Breaking changes ship as `/v2/…` and both live
  side-by-side for one minor release before v1 is retired.
- Response envelopes never change shape inside a version — only additive
  fields.

## Base URL layout

```
/healthz                            # liveness (no auth)
/metrics                            # prometheus (auth via internal firewall)
/openapi.json                       # generated spec
/openapi.yaml                       # generated spec
/.well-known/mta-sts.txt            # per-hosted-domain policy
/v1/…                               # public API
/v1/ws                              # websocket
/v1/stream                          # SSE fallback for WS
/v1/internal/…                      # internal-only (X-Ingest-Token guard)
```

## Authentication

Three modes, negotiated per request:

1. **Session cookie** — `jm_session`, HttpOnly/Secure/SameSite=Lax, host-locked.
   Refreshed by `POST /v1/auth/touch` from the client every 5 min.
2. **Bearer API key** — `Authorization: Bearer jm_…`. Uniform principal
   shape; org derived from the key.
3. **Signed WS ticket** — client calls `POST /v1/auth/ws-ticket` and gets a
   short-lived JWT; passes it as `?ticket=` on WS handshake.

`SessionGuard` is uniform for cookie and bearer; the resulting `principal`
carries `{ userId, orgId?, sessionId, kind, scopes[] }`.

## Errors

RFC 9457 `application/problem+json` on every non-2xx:

```json
{
  "type": "https://justmail.dev/errors/mailbox-not-found",
  "title": "Mailbox not found",
  "status": 404,
  "detail": "No mailbox with id … in org …",
  "instance": "/v1/orgs/abc/mailboxes/xyz",
  "trace_id": "01H…",
  "errors": [
    { "path": "local_part", "message": "invalid character" }
  ]
}
```

- `trace_id` correlates with server logs.
- `errors[]` populated on 400s from Zod validation.

## Idempotency

- `Idempotency-Key: <uuid>` on any POST/PUT/PATCH that has side effects.
- Server stores `(org_id, key, response_hash)` for 24 h and returns the
  cached response on replay.
- Missing key on a "dangerous" mutation (send mail, delete mailbox) → 400.

## Pagination

- Cursor-based: `?cursor=…&limit=50` (limit clamped 1-200).
- Response envelope: `{ items: [...], next_cursor?: "…" }`.
- Total counts only where affordable; otherwise a separate `/count` sibling.

## Sorting and filtering

- Sort: `?sort=field` or `?sort=-field` for descending.
- Filter: `?filter=<field>:<op>:<value>` repeatable. Ops: `eq`, `neq`, `lt`,
  `gt`, `lte`, `gte`, `like`, `in`. All validated with Zod.

## Rate limiting

- Every response carries `RateLimit-Limit`, `RateLimit-Remaining`,
  `RateLimit-Reset` (draft-9 headers).
- 429 emits `Retry-After` in seconds.

## Endpoint catalog (excerpt — full list generated from Nest controllers)

### Auth
- `GET  /v1/auth/status`
- `POST /v1/auth/bootstrap`
- `POST /v1/auth/login` (with optional TOTP or Passkey challenge)
- `POST /v1/auth/passkey/register`
- `POST /v1/auth/passkey/authenticate`
- `POST /v1/auth/logout`
- `POST /v1/auth/touch`
- `POST /v1/auth/ws-ticket`
- `GET  /v1/auth/me`
- `GET  /v1/auth/sessions`
- `DELETE /v1/auth/sessions/:id`
- `POST /v1/auth/2fa/setup`
- `POST /v1/auth/2fa/verify`
- `POST /v1/auth/2fa/disable`
- `POST /v1/auth/2fa/recovery/generate`
- `POST /v1/auth/2fa/recovery/use`

### Orgs & members
- `GET  /v1/orgs`
- `POST /v1/orgs`
- `GET  /v1/orgs/:orgId`
- `PATCH /v1/orgs/:orgId`
- `DELETE /v1/orgs/:orgId`
- `GET  /v1/orgs/:orgId/members`
- `POST /v1/orgs/:orgId/members` (add existing user)
- `PATCH /v1/orgs/:orgId/members/:userId`
- `DELETE /v1/orgs/:orgId/members/:userId`
- `GET  /v1/orgs/:orgId/teams`
- `POST /v1/orgs/:orgId/teams`
- `PATCH /v1/orgs/:orgId/teams/:teamId`
- `DELETE /v1/orgs/:orgId/teams/:teamId`

### Invites
- `GET  /v1/orgs/:orgId/invites`
- `POST /v1/orgs/:orgId/invites`
- `DELETE /v1/orgs/:orgId/invites/:id`
- `GET  /v1/invites/:token` (public)
- `POST /v1/invites/:token/accept` (public)

### Domains & DNS
- `GET  /v1/orgs/:orgId/domains`
- `POST /v1/orgs/:orgId/domains`
- `GET  /v1/orgs/:orgId/domains/:id`
- `PATCH /v1/orgs/:orgId/domains/:id`
- `DELETE /v1/orgs/:orgId/domains/:id`
- `POST /v1/orgs/:orgId/domains/:id/verify`
- `GET  /v1/orgs/:orgId/domains/:id/dns`
- `POST /v1/orgs/:orgId/domains/:id/dns/sync`
- `POST /v1/orgs/:orgId/domains/:id/dns/check`
- `GET  /v1/orgs/:orgId/domains/:id/dkim`
- `POST /v1/orgs/:orgId/domains/:id/dkim`
- `POST /v1/orgs/:orgId/domains/:id/dkim/:keyId/activate`
- `POST /v1/orgs/:orgId/domains/:id/dkim/:keyId/retire`

### Mailboxes & aliases
- `GET  /v1/orgs/:orgId/mailboxes`
- `GET  /v1/orgs/:orgId/mailboxes.csv`
- `POST /v1/orgs/:orgId/mailboxes.csv:import`
- `GET  /v1/orgs/:orgId/domains/:domainId/mailboxes`
- `POST /v1/orgs/:orgId/domains/:domainId/mailboxes`
- `GET  /v1/orgs/:orgId/mailboxes/:id`
- `PATCH /v1/orgs/:orgId/mailboxes/:id`
- `PUT  /v1/orgs/:orgId/mailboxes/:id/password`
- `DELETE /v1/orgs/:orgId/mailboxes/:id`
- `GET  /v1/orgs/:orgId/aliases`
- `POST /v1/orgs/:orgId/domains/:domainId/aliases`
- `PATCH /v1/orgs/:orgId/aliases/:id`
- `DELETE /v1/orgs/:orgId/aliases/:id`

### Storage & attachments
- `POST /v1/orgs/:orgId/uploads` (tus.io Creation)
- `PATCH /v1/orgs/:orgId/uploads/:id` (tus.io PATCH)
- `HEAD /v1/orgs/:orgId/uploads/:id` (tus.io HEAD)
- `POST /v1/orgs/:orgId/uploads/:id:finalise`
- `GET  /v1/orgs/:orgId/attachments/:id` (metadata)
- `GET  /v1/orgs/:orgId/attachments/:id/download` (redirect to signed URL)
- `GET  /v1/orgs/:orgId/attachments/:id/preview` (redirect to signed URL)

### Webmail
- `POST /v1/webmail/mailboxes/:mailboxId/unlock`
- `POST /v1/webmail/mailboxes/:mailboxId/lock`
- `GET  /v1/webmail/mailboxes/:mailboxId/folders`
- `GET  /v1/webmail/mailboxes/:mailboxId/folders/:folder/messages` (cursor)
- `GET  /v1/webmail/mailboxes/:mailboxId/folders/:folder/messages/:uid`
- `POST /v1/webmail/mailboxes/:mailboxId/folders/:folder/messages/:uid/flags`
- `POST /v1/webmail/mailboxes/:mailboxId/folders/:folder/messages/:uid/move`
- `POST /v1/webmail/mailboxes/:mailboxId/folders/:folder/messages/:uid/delete`
- `POST /v1/webmail/mailboxes/:mailboxId/folders/:folder/messages/:uid/snooze`
- `POST /v1/webmail/mailboxes/:mailboxId/send` (immediate)
- `POST /v1/webmail/mailboxes/:mailboxId/send/schedule` (returns outbox id)
- `POST /v1/webmail/mailboxes/:mailboxId/send/:outboxId/cancel`
- `GET  /v1/webmail/mailboxes/:mailboxId/drafts`
- `POST /v1/webmail/mailboxes/:mailboxId/drafts`
- `PATCH /v1/webmail/mailboxes/:mailboxId/drafts/:id`
- `DELETE /v1/webmail/mailboxes/:mailboxId/drafts/:id`
- `GET  /v1/webmail/mailboxes/:mailboxId/search?q=…&cursor=…`

### Rules (Sieve)
- `GET  /v1/webmail/mailboxes/:mailboxId/rules`
- `POST /v1/webmail/mailboxes/:mailboxId/rules`
- `PATCH /v1/webmail/mailboxes/:mailboxId/rules/:id`
- `DELETE /v1/webmail/mailboxes/:mailboxId/rules/:id`

### Observability
- `GET  /v1/orgs/:orgId/dashboard`
- `GET  /v1/orgs/:orgId/events?type=…&q=…`
- `GET  /v1/orgs/:orgId/audit?…`
- `GET  /v1/orgs/:orgId/queue`
- `GET  /v1/orgs/:orgId/queue/deferred`
- `GET  /v1/orgs/:orgId/queue/trace/:queueId`
- `POST /v1/orgs/:orgId/queue/:queueId/requeue`
- `DELETE /v1/orgs/:orgId/queue/:queueId`

### Security & delivery
- `GET  /v1/orgs/:orgId/security/score`
- `GET  /v1/orgs/:orgId/security/blocked-ips`
- `POST /v1/orgs/:orgId/security/blocked-ips`
- `DELETE /v1/orgs/:orgId/security/blocked-ips/:id`
- `GET  /v1/orgs/:orgId/security/country-block`
- `PUT  /v1/orgs/:orgId/security/country-block`
- `GET  /v1/orgs/:orgId/security/ip-warmup`
- `PUT  /v1/orgs/:orgId/security/ip-warmup`
- `GET  /v1/orgs/:orgId/deliverability/dmarc`
- `GET  /v1/orgs/:orgId/deliverability/reputation`

### Backups
- `GET  /v1/orgs/:orgId/backups`
- `GET  /v1/orgs/:orgId/backups/schedule`
- `PUT  /v1/orgs/:orgId/backups/schedule`
- `POST /v1/orgs/:orgId/backups:run`
- `POST /v1/orgs/:orgId/backups/:id:restore`

### API keys / webhooks
- `GET  /v1/orgs/:orgId/api-keys`
- `POST /v1/orgs/:orgId/api-keys`
- `DELETE /v1/orgs/:orgId/api-keys/:id`
- `GET  /v1/orgs/:orgId/webhooks`
- `POST /v1/orgs/:orgId/webhooks`
- `DELETE /v1/orgs/:orgId/webhooks/:id`
- `GET  /v1/orgs/:orgId/webhooks/:id/deliveries`
- `POST /v1/orgs/:orgId/webhooks/:id/deliveries/:deliveryId:replay`

### Plugins / themes / settings
- `GET  /v1/orgs/:orgId/plugins`
- `POST /v1/orgs/:orgId/plugins:install`
- `PATCH /v1/orgs/:orgId/plugins/:id`
- `POST /v1/orgs/:orgId/plugins/:id:uninstall`
- `GET  /v1/orgs/:orgId/themes`
- `POST /v1/orgs/:orgId/themes`
- `PATCH /v1/orgs/:orgId/themes/:id`
- `POST /v1/orgs/:orgId/themes/:id:apply`
- `GET  /v1/orgs/:orgId/settings?prefix=…`
- `PUT  /v1/orgs/:orgId/settings/:key`

### Notifications
- `GET  /v1/notifications`
- `POST /v1/notifications/:id:mark-read`
- `POST /v1/notifications/read-all`
- `POST /v1/notifications/web-push/subscribe`
- `DELETE /v1/notifications/web-push/subscribe/:id`

## WebSocket protocol (`/v1/ws`)

- Handshake with `?ticket=<jwt>`.
- Ping/pong every 20 s; server closes idle > 60 s.
- Subprotocol: `justmail.v1`. JSON messages.

Client → Server:
```json
{ "op": "subscribe", "topic": "org:<uuid>:events" }
{ "op": "unsubscribe", "topic": "…" }
{ "op": "ping", "at": 1712345678 }
```

Server → Client:
```json
{ "op": "hello", "session_id": "…", "server_time": "…" }
{ "op": "event", "topic": "org:<uuid>:events",
  "type": "mailbox.created", "data": { … }, "at": "…" }
{ "op": "backoff", "seconds": 30 }
{ "op": "error", "problem": { … } }
```

Server-authoritative topics only. Subscribing to a topic not owned by the
session's principal is silently ignored.

## Event catalog (published on WS + delivered to webhooks)

- `auth.login`, `auth.logout`, `auth.2fa.enabled`
- `org.member.added`, `org.member.removed`, `org.member.role_changed`
- `domain.created`, `domain.verified`, `domain.dns_synced`
- `dkim.generated`, `dkim.activated`, `dkim.retired`
- `mailbox.created`, `mailbox.updated`, `mailbox.suspended`, `mailbox.deleted`
- `mailbox.password_set`
- `alias.created`, `alias.updated`, `alias.deleted`
- `mail.received`, `mail.rejected`, `mail.deferred`, `mail.sent`, `mail.bounced`
- `queue.snapshot`
- `security.ip.blocked`, `security.ip.unblocked`
- `webhook.delivered`, `webhook.failed`
- `backup.started`, `backup.completed`, `backup.failed`
- `notification.created`
- `plugin.installed`, `plugin.uninstalled`
- Custom `plugin:<name>:<event>` reserved namespace

Each event has a stable Zod schema in `packages/contracts/events`.

## Internal endpoints (X-Ingest-Token)

- `POST /v1/internal/events/ingest` — vector log ingest
- `POST /v1/internal/dmarc/ingest` — parsed DMARC report
- `GET  /v1/internal/caldav/auth` — Radicale auth callback
- `GET  /v1/internal/policy/mail` — postfix policy service snapshot

## SDKs

- TypeScript SDK generated from OpenAPI; ships in `packages/sdk-ts`.
- Python & Go generators stubbed for v1.1.
- Every SDK carries a fetch adapter (default browser fetch; runtime-agnostic
  via a small interface) and typed events.

## Backward compatibility rules

- Never remove a field within a version.
- Rename → add new field, deprecate old field with a `Sunset:` header.
- Enum growth is a breaking change; add new values only in v(N+1).
- Removed endpoints return `410 Gone` with the migration URL.
