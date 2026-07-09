# Gap analysis — v0 vs v1

Legend: **✓** shipped, **~** partial, **✗** missing, **⨯** must redesign.

## Monorepo structure

| Requirement | v0 | v1 target | Action |
|---|---|---|---|
| apps/admin | ~ (mixed with webmail) | separate SPA | Split from `apps/web` |
| apps/webmail | ~ (basic pane) | separate SPA | New app; import shared-ui |
| apps/landing | ✗ | separate SPA | New app; static SSG |
| apps/api | ✓ | keep, harden | Refactor for plugin surface |
| packages/shared-types | ✓ | keep | Rename to `@justmail/contracts` |
| packages/shared-ui | ✗ | required | New; Radix + Tailwind + tokens |
| packages/shared-utils | ✗ | required | Zod helpers, fetch client, hooks |
| packages/design-tokens | ✗ | required | Style Dictionary output |
| packages/plugin-sdk | ✗ | required | Runtime + types for plugins |
| packages/theme-engine | ✗ | required | Token→CSS runtime |
| packages/storage | ✗ | required | Object-storage adapters |
| packages/mail-parser | ✗ | required | mailparser wrapper + tests |
| packages/openapi | ✗ | required | tRPC-style compile-time OpenAPI |

## Data plane

| Item | v0 | Gap |
|---|---|---|
| Postfix + Dovecot + Rspamd + ClamAV | ✓ | tighten postfix policy hooks |
| SQL views for authz | ✓ | add warmup + geo blocks to views |
| DKIM key rotation | ~ | worker for automatic yearly rotation |
| Sieve rules | ✗ | manage-sieve, DB-backed, UI editor |
| Attachments | ⨯ (rely on maildir only) | Object-store abstraction + dedup |
| Full-text search | ✗ | Dovecot FTS + xapian OR Meilisearch |
| Queue management (delete/flush/hold) | ✗ | postfix control plane worker |
| Bounce classification | ~ (parser exists) | classify DSN → typed events |
| ARC seal | ✗ | Rspamd ARC + key mgmt |
| DANE (TLSA) | ✗ | DNS Center support |

## Control plane

| Module | v0 | Gap |
|---|---|---|
| Auth | ✓ | Add SSO (OIDC, SAML) provider registry |
| 2FA (TOTP) | ✓ | Add WebAuthn / Passkey; recovery codes |
| Sessions | ✓ | Add device fingerprint, session revoke UX |
| Orgs / RBAC | ✓ | Add sub-org (team) tier; policy engine |
| Invites | ✓ | Add email delivery via internal SMTP |
| API keys | ✓ | Add scopes as first-class DB rows |
| Webhooks | ✓ | Add event catalog, replay UI |
| Backups | ~ (script + schedule) | Restore UI, checksum, encryption |
| DMARC | ~ (ingest) | XML parser + IP reputation |
| DNSBL | ~ (worker) | UI + org-scoped whitelists |
| Country block | ~ (settings) | Enforce via postfix policy service |
| IP warmup | ~ (settings) | Enforce per-day caps via policy |
| Search / logs | ~ (event list) | Query DSL, saved filters |
| Realtime | ✗ | WS channel for events/queue/webmail |
| Command palette | ✗ | Global; ⌘K everywhere |
| Notifications | ✗ | Toast + inbox + Web Push |
| Retention | ✗ | Per-domain policies + purger worker |

## Webmail

Everything below is new; v0 has a three-pane read/compose stub only.

| Feature | Status | Notes |
|---|---|---|
| Conversation view | ✗ | Group by References/Message-ID; virtualised |
| Rich composer (TipTap) | ✗ | markdown / HTML toggle, autosave drafts |
| Attachment upload | ~ | move off nodemailer, use storage adapter + chunked |
| Snooze | ✗ | Deferred queue + worker returns to Inbox |
| Schedule send | ✗ | Deferred outbox + BullMQ |
| Undo send | ✗ | Client hold + server-side 30s delay |
| Templates | ✗ | DB table, keyboard-launched |
| Signatures | ✗ | Per identity, per mailbox |
| Multi-account | ✗ | Multiple mailboxes in one session |
| Filters (Sieve) | ✗ | Visual builder → sieve compiler |
| Categories/labels | ✗ | IMAP keywords + UI |
| Search | ✗ | Server-side FTS, operators, saved searches |
| Contacts / calendar / tasks / notes | ✗ | Contacts + calendar via *DAV sidecar |
| Split view / thread view | ✗ | Layout switcher, persistent |
| Read receipts | ✗ | MDN handling opt-in |
| Push notifications | ✗ | Web Push + VAPID |
| Offline | ~ (SW cache shell) | IndexedDB message cache + Background Sync |

## Landing

| Item | v0 | Gap |
|---|---|---|
| Public marketing | ✗ | Full site: hero, features, screenshots, pricing |
| Docs render | ~ (raw md) | MDX + docs search + versioning |
| Blog / changelog | ✗ | RSS + Atom |
| Contact form | ✗ | Backed by internal mail |

## Storage (attachments, thumbnails, backups)

| Item | v0 | Gap |
|---|---|---|
| Adapter interface | ✗ | `PutObject`, `GetStream`, `HeadObject`, `Delete`, `Sign` |
| Local FS | ✗ | dev + smallest tier |
| S3 / R2 / MinIO / B2 / Azure / GCS | ✗ | one client per provider |
| Content-addressed dedup | ✗ | key = `sha256(payload)`; reference count |
| Streaming upload/download | ✗ | multipart, resumable, tus.io wire format |
| Signed URLs | ✗ | provider-agnostic wrapper |
| Virus scan | ~ (ClamAV runs) | tie into upload pipeline, quarantine key |
| Thumbnail worker | ✗ | sharp for images, poppler for PDF |
| CDN | ✗ | signed CDN URL support |

## Multi-domain branding

| Item | v0 | Gap |
|---|---|---|
| Per-domain admin | ~ | via org, not per-domain policy tier |
| Per-domain login page | ✗ | subdomain-aware admin |
| Per-domain theme | ✗ | theme engine + assets in storage |
| Per-domain SMTP policy | ~ (outbound_mode) | expand to relayhosts + rate limits |
| Per-domain DKIM/DMARC | ✓ | keep |

## Plugin system

Everything is missing:
- Manifest schema (`justmail.plugin.json`).
- Runtime loader (server + client bundles).
- Permission scopes tied to API RBAC.
- UI slot registry (React portals with props contract).
- Marketplace UI (v1.1).

## Theme engine

Everything is missing:
- Design token schema (Style Dictionary).
- Runtime CSS generator (root scope + org scope + domain scope cascade).
- In-app editor.

## Testing

| Kind | v0 | Gap |
|---|---|---|
| Unit | ✗ | vitest, all packages, coverage gate 80% |
| Integration | ✗ | testcontainers-node against PG + Redis |
| E2E | ~ (`smoke.sh`) | Playwright across admin + webmail + api |
| Load | ✗ | k6 for API, smtp-source for SMTP |
| Performance | ✗ | Lighthouse CI budget |
| Accessibility | ✗ | axe-core in Playwright, per-screen budget |
| Security | ✗ | ZAP scan, npm audit, trivy on images |

## DevOps

| Item | v0 | Gap |
|---|---|---|
| Compose (single node) | ✓ | tighten resource limits, healthchecks |
| Helm chart | ✗ | K8s deployment for HA |
| Terraform module | ✗ | one-click AWS/DO/Hetzner |
| Installer script | ✗ | `curl … | bash` on Ubuntu 24.04+ |
| Blue/green upgrade | ✗ | migrate up, swap, migrate-down script |
| Backup verification | ✗ | restore-to-scratch cronjob |

## Docs

v0 has phase docs and an M4 multi-node design. v1 needs the full set listed in
the requirements (architecture, DB, API, WS, auth/z, mail flow, queue, spam,
monitoring, deploy, security, backup, DR, upgrade, migration, developer,
contributing, plugin dev, theme dev, i18n) — every one rendered on the landing
site and versioned per release.

## What to keep as-is from v0

- Postfix/Dovecot/Rspamd/ClamAV compose services and configs — proven working.
- DKIM key generation, DNS record seeding, verify flow — reuse the logic.
- Auth, orgs, invites, API keys, webhooks modules — port to v1 API skeleton.
- Vector → parsed mail_events pipeline — keep the parser, expand events.
- `docs/multi-node.md` — becomes the base of `10-deployment.md`.

## What to redesign

- **Single web app doing both admin and webmail.** Split into two apps that
  share only tokens, primitives, and contracts.
- **Ad-hoc CSS in globals.css.** Replace with a token-driven design system
  compiled at build time.
- **Attachments left implicit.** First-class storage adapter and metadata.
- **Session-cookie-only auth surface.** Add SSO providers and Passkey.
- **OpenAPI hand-authored.** Generate from schemas so it can't drift.
