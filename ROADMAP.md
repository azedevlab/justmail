# JustMail — Master Roadmap

Derived from `AUDIT.md` (2026-07-10, baseline `b9d5de8`). Milestones are strictly
ordered; each leaves the platform deployable. Task-level breakdown lives in `BACKLOG.md`.

Complexity: S (<1 day) · M (1–3 days) · L (1–2 weeks) · XL (multi-week)

---

## M2 — Harden the base (security + config + tests scaffold)

**Goal:** no critical audit finding remains exploitable; hardcoded values eliminated;
CI can catch regressions.
**Complexity:** L · **Dependencies:** none — this blocks everything else.

- Rate limiting (Redis-backed) on auth/unlock/send + global default (C-1)
- Webmail credential rows: TTL column + delete-on-logout + sweep job (C-3)
- Mail-host/ports + all §6/§7 limits into `config.ts` (env, zod-validated)
- Scope 32 MB body parser to the send route; restore small global default (C-4 partial)
- Security headers (nosniff everywhere; CSP for admin/webmail; attachment MIME allowlist
  + forced nosniff/inline rules)
- Fixed error string on unlock failure (no IMAP internals echo)
- Test scaffold: vitest wired in CI for api + packages; first contract round-trip tests
- **DB changes:** `webmail_credentials` table (or TTL'd settings sweep) · **Infra:** none
- **Acceptance:** brute-forcing unlock returns 429 within N attempts; `grep`-audit for
  hardcoded hosts/limits returns clean; CI fails on test failure.

## M3 — Contract unification

**Goal:** `@justmail/contracts` is the single source of truth; API imports it; every
declared field is honored or removed.
**Complexity:** M · **Dependencies:** M2 (tests exist to lock behavior).

- API uses contract `ComposeRequest`/`FlagAction`/`Folder`/`Message`/`MessageSummary`
- Implement or delete: `send_at`, `in_reply_to`/`references` (implement — sets threading
  headers on send), spam/importance flag actions (implement via IMAP keywords + rspamd
  fuzzy/learn), `preview` + `has_attachments` in list (BODYSTRUCTURE + snippet fetch)
- Contract tests: zod parse of real API fixtures for every endpoint
- **Acceptance:** no zod schema defined inside `apps/api` that duplicates a contract.

## M4 — IMAP session layer + realtime (the big one)

**Goal:** kill per-request IMAP logins; new mail appears without refresh.
**Complexity:** XL · **Dependencies:** M2 (config), M3 (contracts stable).

- `ImapSessionManager`: pooled ImapFlow client per unlocked (session, mailbox), LRU +
  TTL eviction, health-checked, reused across requests
- IDLE per open mailbox → publish `mail:new`/`mail:flags` over the existing WS gateway
- Folder counts via `LIST-STATUS` (one round trip); CONDSTORE/QRESYNC for delta sync
- Redis-cached folder list + message-list snapshots; ETag on message/attachment fetch
- Frontend: WS subscription updates the list live; drop the manual refresh dependency;
  message-list virtualization (react-virtual)
- **DB:** none · **Infra:** ensure Dovecot `mail_max_userip_connections` sane, IDLE ok
- **Acceptance:** flag toggle < 30 ms server time (warm client); a message delivered
  externally appears in the open folder within 2 s with no user action; 50-concurrent
  soak holds connection count flat.

## M5 — Storage-backed attachments + streaming + AV

**Goal:** attachments flow through `@justmail/storage`, stream end-to-end, are virus
scanned, and previewable safely.
**Complexity:** L · **Dependencies:** M2, M4 (session layer for MIME assembly).

- Compose uploads: tus → storage adapter (content-hash dedup) → `attachment_ids`
- Send assembles MIME server-side from stored blobs, streaming (no base64-in-JSON)
- Read/download: stream from IMAP → HTTP with Range support + ETag; no full buffer
- clamd INSTREAM scan on send; reject infected with a clear error
- Thumbnail service (sharp) for images; signed, short-TTL URLs; `nosniff` + safe MIME
- Org-configurable limits (size/count/types) surfaced in admin Settings
- **DB:** `attachments` blob-index table (org, hash, size, refcount) · **Infra:** storage
  bucket wiring documented for each backend
- **Acceptance:** 100 MB attachment sends with flat API memory; EICAR is rejected; image
  preview renders from a signed URL; no attachment path buffers a whole file.

## M6 — Core webmail product parity

**Goal:** threading, drafts, search, undo/scheduled send, rich compose — a client a
person would choose.
**Complexity:** XL · **Dependencies:** M3, M4, M5.

- Conversation threading (server-side grouping by References/Message-ID + subject)
- Drafts: autosave to `\Drafts`, restore, discard; Draft contract already exists
- Server-side search (Dovecot SEARCH first; Meilisearch/dovecot-fts later) + operators
- Undo send (deferred queue window) + scheduled send (BullMQ delayed job)
- Rich-text compose (sanitized HTML), signatures, templates (contracts exist)
- Sieve rules/filters UI via managesieve; labels/folders management
- Designed delete/confirm modals replacing native `confirm()`; `?` shortcut sheet;
  compose focus trap + Esc; keyboard-operable list resizer
- **DB:** drafts metadata, signatures, templates, sieve rules tables · **Infra:**
  managesieve exposed; optional Meilisearch service
- **Acceptance:** feature matrix (AUDIT §5) flips to ✅ for threading, search, drafts,
  undo/scheduled send, signatures, filters, spam action.

## M7 — Contacts, calendar, PWA

**Goal:** surface the Radicale CalDAV/CardDAV that already runs; installable app.
**Complexity:** L · **Dependencies:** M6.

- Contacts UI (CardDAV) + compose autocomplete/chips
- Calendar UI (CalDAV) read + basic event CRUD
- PWA manifest, service worker, offline read cache, web-push new-mail notifications
- **Acceptance:** add a contact → it autocompletes in compose; view a calendar month;
  install to home screen; receive a push on new mail with app closed.

## M8 — Enterprise: SSO, LDAP, 2FA, quotas, retention

**Goal:** clear the "enterprise" bar honestly.
**Complexity:** XL · **Dependencies:** M2 (auth hardening).

- OIDC + SAML SSO; passkeys/TOTP 2FA; session management UI
- LDAP/AD sync: OpenLDAP, AD, FreeIPA, Azure AD DS; LDAPS/StartTLS; nested groups;
  attribute mapping; auto-provision/deactivate; SCIM
- Per-org quotas (Dovecot quota) surfaced + enforced; retention/legal-hold; mailbox
  export (takeout); admin impersonation with consent + audit
- **DB:** identity-provider config, ldap mappings, quota + retention policy tables
- **Acceptance:** log in via an external IdP; an AD group change deactivates a user;
  a quota is enforced and shown; a retention policy expires mail on schedule.

## M9 — A11y, docs, OSS hygiene, release readiness

**Goal:** WCAG AA, publishable docs, GitHub-trending-grade repo.
**Complexity:** L · **Dependencies:** feature set stable (M6+).

- axe in CI; contrast token pass; focus/keyboard audit fixes; VoiceOver pass
- Quickstart, backup/restore, upgrade, troubleshooting, rendered OpenAPI, architecture
  diagram; README rewrite with screenshots + comparison table
- Issue/PR templates, CODEOWNERS, dependabot, CodeQL, CoC, discussions, labels, release
  notes automation
- Backups: real scheduler + restore flow + last-run status in admin
- **Acceptance:** `RELEASE_READINESS.md` shows no Critical/High; a stranger reaches a
  working inbox from the README in under 15 minutes.

## M10 — Final polish: UI/UX, functionality, design system, a11y (release-grade)

**Goal:** treat the app as if it ships publicly tomorrow. Every page, route, component,
dialog, form, table, and interaction is reviewed and brought to a premium, handcrafted
bar (Apple / Linear / Vercel / Stripe / Proton). No placeholder actions, no TODO
functionality, no admin-template feel. Every value configurable; nothing hardcoded.
**Complexity:** XL · **Dependencies:** feature set stable (M5–M8); runs continuously,
gated last. Overlaps and absorbs M6-7 (designed modals/shortcuts) and M9-1 (a11y).

- **Design tokens:** complete semantic color palette — light (pure/off white, background,
  surface, elevated, sidebar, card, input, hover, border, divider, muted/primary/secondary
  text, accent, primary-blue, success, warning, danger, info) and OLED-first dark (proper
  neutral elevation, not inverted). Typography scale, spacing, radius, shadow, and motion
  durations as reusable tokens. Zero hardcoded colors/values in either app.
- **Component redesign pass:** buttons (default/ghost/icon/split/dropdown × hover/pressed/
  focus/disabled/loading/success/danger), inputs (spacing/placeholder/validation/error/
  focus/password-visibility/autocomplete), tables (modern, virtualized, sortable,
  searchable, sticky headers, hover, bulk actions, expandable rows), cards, dropdowns,
  dialogs/drawers/modals, tooltips, toasts, context menus.
- **Functionality audit (per surface):** walk every page in webmail + admin; click every
  button/icon/dropdown; open every dialog; submit every form; exercise search/filter/
  pagination/upload/download/attachment/shortcut/context-menu; verify empty/loading/error/
  success states; fix every dead, placeholder, or TODO action so every visible control
  performs a real action.
- **Responsive pass:** desktop, laptop, tablet, phone, ultra-wide — nothing overflows or
  breaks.
- **Dark-mode pass:** premium neutral tones, correct contrast/elevation/shadows/borders/
  hover/text — designed, not inverted.
- **Motion pass:** subtle, fast, natural transitions (hover, page, dialog, sidebar, toast);
  remove gratuitous animation.
- **Accessibility pass:** keyboard nav, focus order + rings, ARIA labels, screen-reader,
  color contrast, accessible forms/dialogs (feeds M9-1 axe gate).
- **Config sweep:** grep the whole codebase for hardcoded values (upload/attachment/SMTP/
  IMAP limits, timeouts, retries, storage paths, ports, worker counts, colors, fonts,
  spacing, animation durations) → config/tokens.
- **Enterprise feature-parity gap analysis** vs Gmail, Outlook, Proton, Fastmail, Apple
  Mail, Mailcow, Exchange, Google Workspace → produce a gap list, file tasks, implement.
- **Self-review gate:** for every surface ask "would Apple/Vercel/Linear/Stripe ship
  this?" Iterate until yes. Score each page 1–10 in `RELEASE_READINESS.md`.
- **Acceptance:** every page scores ≥ 8/10; no placeholder/dead control remains; a
  `grep`-audit for hardcoded colors/limits is clean; axe passes; the experience reads as a
  premium commercial product, not an admin template.

## M11 — Portability & provider abstraction (deploy-anywhere)

**Goal:** the core codebase runs unchanged from a Raspberry Pi to an HA Kubernetes cluster
with external DB/Redis/object-storage. Every external dependency is a swappable adapter
behind an interface; nothing is coupled to one provider, OS, or topology.
**Complexity:** XL · **Dependencies:** M2 (typed config), M5 (storage adapters exist).

- **Adapters behind interfaces** for: object storage (S3/R2/MinIO/B2/Azure Blob/GCS/Ceph/
  Wasabi/DO Spaces/Scaleway/local — extend existing `@justmail/storage`), database
  (Postgres remote/HA/Patroni/read-replicas/PgBouncer), cache (standalone/Sentinel/Cluster/
  Valkey/remote/TLS/auth/auto-reconnect), search (PG FTS/OpenSearch/Elasticsearch/
  Meilisearch/Typesense), auth (local/LDAP/OIDC/SAML/passkeys — see M8), DNS
  (Cloudflare/Route53/Google/Azure/DO/Hetzner/Namecheap/GoDaddy/Porkbun/manual, as
  plugins), notifications, monitoring, logging. No tight coupling anywhere.
- **HA topologies:** support remote/replicated Postgres + PgBouncer, Redis Sentinel/Cluster,
  distributed/networked mail storage (NFS/SMB/CephFS/ZFS) — all via config, no code change.
- **Storage migration:** admin can migrate attachments between providers with no downtime;
  storage + DB + cache health monitoring.
- **Config system:** strongly-typed, validated at startup, fail-fast with meaningful errors;
  sources = env / config file / admin UI / secrets manager / CLI / API; auto-generate sample
  config. (Extends `config.ts`.)
- **No-personalization audit:** zero hardcoded domains, hostnames, IPs, ports, paths, emails,
  company/brand names, secrets, API keys, maintainer/GitHub identifiers — all placeholders/
  templates/config. Repo reusable by anyone with no edits.
- **Multi-arch:** ARM64 + AMD64 images.
- **Acceptance:** a fresh clone deploys on (a) single VM, (b) Docker Compose, (c) Kubernetes
  with external managed Postgres/Redis/S3 — each by config only; a `grep`-audit for personal/
  hardcoded values is clean; swapping storage provider is a config change.

## M12 — Packaging & deployment targets

**Goal:** first-class artifacts for every common deployment shape.
**Complexity:** L · **Dependencies:** M11.

- Generate & maintain: `.env.example`, `config.example.yaml`, `docker-compose.{example,
  production,dev,cluster}.yml`, Helm chart (`values.yaml`) + Kubernetes manifests, systemd
  unit files, reverse-proxy examples (Nginx, Traefik, Caddy, HAProxy, Apache).
- Deployment targets validated: single/multi VM, Docker, Compose, K8s/Helm, LXC/Proxmox,
  bare metal, major clouds (AWS/Azure/GCP/Oracle/DO/Hetzner/OVH/Linode/Vultr/Scaleway),
  self-hosted/NAS.
- **Acceptance:** each artifact boots a working stack; docs point to the right one per target.

## M13 — Migration & import from other providers

**Goal:** organizations can move in from existing mail platforms.
**Complexity:** XL · **Dependencies:** M6 (mailbox/folder model), M8 (identity).

- Importers for Google Workspace, Microsoft 365/Exchange, Fastmail, Zoho, Proton, Mailcow,
  iRedMail, Zimbra, cPanel/Plesk: users, mailboxes (IMAP/MBOX/PST as applicable), calendars,
  contacts, aliases.
- **Acceptance:** a test import from at least one IMAP source reproduces folders + messages
  + aliases into a new org.

> **Docs (extends M9):** full OSS doc suite — README, CONTRIBUTING, SECURITY, SUPPORT,
> CODE_OF_CONDUCT, ARCHITECTURE, INSTALL, DEPLOYMENT, CONFIGURATION, MIGRATION, UPGRADE,
> BACKUP, RESTORE, HIGH_AVAILABILITY, KUBERNETES, DOCKER, API, SDK, CLI, THEMES, PLUGINS,
> FAQ, TROUBLESHOOTING — plus install/upgrade/DR/scaling/monitoring/hardening/tuning guides.
> **API parity (extends M9/M6):** everything in the UI is reachable via REST; ship OpenAPI,
> SDK, CLI, webhooks, WS events, API versioning.

---

## Sequencing rationale

M2 first because every other milestone builds on a base that today is brute-forceable and
untested. M3 before M4 so the session layer is built against honest contracts. M4 is the
keystone — realtime and performance unlock the entire product. M5–M7 are the webmail
product. M8 is orthogonal (enterprise identity) and can parallelize after M2 if a second
track opens. M9 is continuous but gated as the release checklist. M10 is the final
release-grade polish/review pass — it runs continuously alongside feature work but is
gated last, when there are real surfaces to hold to the premium bar.
