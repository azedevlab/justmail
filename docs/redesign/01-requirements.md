# Requirements

## Vision

JustMail is a self-hosted mail hosting platform for teams and small ISPs. It
combines a mail-server data plane (SMTP/IMAP/Submission/Sieve) with a control
plane (web admin, REST API, plugins) that treats mail as a first-class product
surface — closer in feel to Vercel, Linear, and Stripe than to Postfixadmin or
iRedMail.

## Target users

| Persona | Needs | Priority |
|---|---|---|
| Platform operator | Bootstrap, upgrade, back up, audit; sleep at night | P0 |
| Org admin | Add domains + mailboxes, manage team, wire integrations | P0 |
| Mailbox user | Read + send mail from any device, without pain | P0 |
| Developer | Programmatic access, webhooks, SDKs | P1 |
| Compliance officer | Retention, audit trails, DMARC, exports | P1 |
| Plugin author | Extend admin, webmail, mail flow, storage | P2 |

## Functional requirements

### Control plane
- Multi-tenant orgs with owner/admin/member/viewer RBAC and last-owner guard.
- Domains: CRUD, verification, one-click DNS repair against a pluggable
  provider (Cloudflare first; Route53, Gandi, deSEC as plugins).
- Mailboxes: CRUD, quota, forwarding, autoresponder, suspend, password reset,
  CSV import/export, catch-all per domain, aliases with multi-target.
- Deliverability: SPF/DKIM/DMARC/MTA-STS/TLS-RPT/BIMI/CAA seeding + drift
  detection, DMARC aggregate report ingestion, DNSBL monitoring.
- Security: fail2ban integration, country-block, per-org rate limits, IP
  warmup schedule, mailbox 2FA, sub-org policies.
- Observability: dashboard, mail_events search, queue view with per-message
  trace, WS realtime channel.
- API surface: REST /v1 for every mutation, WebSocket for streaming events,
  webhook subscriptions with HMAC signatures.
- Automation: scheduled backups (pg + maildir + attachments) to any supported
  object store, restore plan, disaster recovery.
- Extension: plugin manifests, permission scopes, sandboxed UI slots + server
  hooks; theme engine for branding per org and per domain.

### Data plane
- Postfix (MTA), Dovecot (MDA + IMAP), Rspamd (spam), ClamAV (AV).
- Reads mailbox/alias/auth surface from Postgres SQL views (SELECT-only role).
- DKIM signing via the shared `dkim-keys` volume, keys rotated from the API.
- Attachments do **not** live in Postgres; they live in an object-storage
  abstraction (see `docs/redesign/06-architecture.md` and `08-database.md`).
- Sieve rules stored per mailbox in the DB, materialised to disk as
  `~/sieve/managesieve.sieve` on change.

### Webmail
- Standalone SPA (not the admin app) at its own hostname.
- Conversation view, threaded reader, keyboard-first navigation.
- TipTap composer with markdown / HTML / plaintext toggle, inline images,
  drag-and-drop attachments, resumable chunked upload.
- Snooze, star, pin, undo send, scheduled send, templates, multi-signature,
  aliases, multi-account (multiple mailboxes in one session), rules UI.
- Server-driven filters (Sieve); local rules for UI-only preferences.
- Full-text search backed by Dovecot FTS + a dedicated index worker.
- Contacts, calendar, tasks, notes (calendar via CalDAV sidecar; contacts via
  CardDAV; tasks + notes v1 in the DB, v2 promoted to CalDAV VTODO).
- PWA: manifest, offline shell, background sync, Web Push notifications,
  install prompt.

### Landing
- Marketing site at the root domain: features, docs, changelog, pricing (for
  paid support), download, GitHub link.
- Renders public docs from `docs/` at build time.

### Storage
- Attachment storage adapter: local, S3, R2, MinIO, Backblaze, Azure Blob, GCS.
- Content-addressed dedup (sha256), streaming upload, streaming download.
- Signed URLs with expiry; CDN passthrough headers.
- Virus scan on upload via ClamAV, quarantine on hit.
- Thumbnail worker (image + PDF preview) with a common preview API.

### Multi-domain
- Every domain can carry its own branding (logo, primary/accent, font, favicon).
- Login page inherits domain branding when accessed via a domain-scoped alias
  (e.g. `mail.customer.com`).
- Per-domain SMTP and per-domain outbound policy (direct vs smarthost).
- Per-domain admin subset (delegated administration).

### Plugins
- Plugin = signed npm-style package + `manifest.json` declaring:
  slots (`admin:sidebar`, `webmail:toolbar`, `mail:pre-queue`, ...),
  permissions (which routes / DB tables / storage keys it can touch),
  UI bundle (React 19 lazy-loaded), server bundle (Node ESM, sandboxed).
- Plugin store / registry is v1.1; v1.0 ships the runtime and a first-party
  plugin repo.

### Themes
- Theme = JSON token set + optional CSS. Apply globally, per org, per domain.
- Editable in-app; export/import.

## Non-functional requirements

- **Performance**: p99 API mutation < 250 ms; webmail INBOX list < 400 ms
  server-time for 10 000-message mailboxes; SMTP inbound accept < 50 ms.
- **Scalability**: single node handles 10k mailboxes / 1M msgs/day; cluster
  handles 100k / 20M with linear scale-out.
- **Availability**: 99.9% control plane, 99.99% mail plane (mail plane can
  survive control plane outages via cached views).
- **Security**: passes OWASP ASVS L2 audit; no OWASP Top 10 unresolved.
- **Accessibility**: WCAG 2.2 AA on every rendered screen.
- **Localisation**: en (source), fr, de, es, pt, ru, tr, ar (RTL), zh at v1.0.
- **Compatibility**: Latest 2 versions of Chrome/Firefox/Safari/Edge; iOS 17+,
  Android 12+.
- **Operability**: single-command install (`justmail install`), single-command
  upgrade (`justmail upgrade`), zero-downtime rolling deploys in HA.

## Compliance surfaces (design for; certification is out of scope)

- GDPR: DPA export, per-user data delete, retention schedule per mailbox.
- SOC 2 type-2 ready: audit-log immutability, change-management via PRs.
- HIPAA-shaped: encryption at rest (opt-in), BAA-friendly audit trail.

## Explicit non-requirements

- Anti-spam training UI (Rspamd learns automatically; no expose).
- Native ActiveSync (EAS) protocol server. IMAP + CalDAV is enough for v1.0.
- End-to-end encrypted mail (PGP/S/MIME composer). Plugin, not core.
- Chat / Matrix / XMPP. Out of scope entirely.
