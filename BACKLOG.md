# JustMail — Backlog

Ordered by milestone (`ROADMAP.md`), then priority. Status: `todo` · `in-progress` ·
`blocked` · `done`. Effort: S/M/L. No task exceeds one logical feature.

Priority: P0 (security/data-loss) · P1 (core) · P2 (product) · P3 (polish).

---

## M2 — Harden the base

| ID | P | Task | Files | Effort | Deps | Status |
|---|---|---|---|---|---|---|
| M2-1 | P0 | Redis-backed `ThrottlerGuard` global default + strict override on `unlock`, `login`, `invite accept`, `ws-ticket`, `send` | `apps/api/src/app.module.ts`, new `common/throttler.*`, auth+webmail controllers | M | Redis | done |
| M2-2 | P0 | Webmail credential store with TTL; delete on logout/lock; periodic sweep of expired rows | `webmail.service.ts`, new migration, `auth` logout hook, worker sweep job | M | — | done |
| M2-3 | P0 | Move mail host/ports + all attachment/list limits into `config.ts` (zod, env-defaulted) | `apps/api/src/config.ts`, `webmail.service.ts`, `main.ts` | S | — | done |
| M2-4 | P0 | Scope 32 MB body limit to send route only; restore ≤2 MB global | `main.ts`, webmail controller | S | — | done |
| M2-5 | P0 | Security headers: `nosniff` on all API responses; attachment `Content-Type` allowlist + forced `nosniff`; `inline` only for image/pdf/text | `main.ts`, webmail controller | S | — | done |
| M2-6 | P1 | CSP + security headers for admin & webmail (Next config) | both apps `next.config` | S | — | done |
| M2-7 | P0 | Fixed generic error on unlock failure (stop echoing IMAP internals) | `webmail.service.ts` | S | — | done |
| M2-8 | P1 | Vitest in CI for `apps/api` + packages; wire `turbo test`; fail CI on failure | root, `apps/api`, CI yml | M | — | done |
| M2-9 | P1 | First contract round-trip tests (webmail send/flag/folder shapes) | `apps/api/**/*.spec.ts` | M | M2-8 | done |

## M3 — Contract unification

| ID | P | Task | Files | Effort | Deps | Status |
|---|---|---|---|---|---|---|
| M3-1 | P1 | API imports contract `ComposeRequest`/`FlagAction`; delete duplicate zod | `webmail.service.ts`, controller | M | M2-9 | done |
| M3-2 | P1 | Set `In-Reply-To`/`References` on send; wire reply threading headers from client | `webmail.service.ts`, contracts, webmail page | M | M3-1 | done |
| M3-3 | P1 | Implement spam/not-spam/importance flag actions (spam→Junk move, `$Important` keyword) | `webmail.service.ts` | M | M3-1 | done |
| M3-4 | P1 | Populate `preview` + `has_attachments` in message list (BODYSTRUCTURE + snippet) | `webmail.service.ts` | M | — | done |
| M3-5 | P2 | Remove or implement `attachment_ids`/`send_at` stubs (implement in M5/M6, delete-guard until then) | contracts, service | S | — | done |
| M3-6 | P2 | Server-side rspamd Bayes training on Junk moves via Dovecot IMAPSieve + rspamd controller worker | `services/mail/dovecot`, `services/mail/rspamd` | M | M3-3 | done |

## M4 — IMAP session layer + realtime

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M4-1 | P1 | `ImapSessionManager` (pooled client per session+mailbox, LRU+TTL, health check) | L | M2-2 | done |
| M4-2 | P1 | Route all webmail ops through the manager; remove per-request connect/logout | M | M4-1 | done |
| M4-3 | P1 | IDLE → WS publish (`mail:new`, `mail:flags`); client subscription | L | M4-2 | done |
| M4-4 | P2 | `LIST-STATUS` folder counts; CONDSTORE delta sync | M | M4-2 | done |
| M4-5 | P2 | Redis cache: folder list + message snapshots; ETag on message/attachment | M | M4-2 | done |
| M4-6 | P2 | Message-list virtualization | M | M4-3 | done |

## M5 — Storage-backed attachments

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M5-1 | P1 | Compose upload via tus → storage adapter (content-hash dedup) | L | M4-1 | done |
| M5-2 | P1 | Server-side streaming MIME assembly on send from `attachment_ids` | M | M5-1 | done |
| M5-3 | P1 | Streaming download + Range + ETag (no full buffer) | M | M4-5 | done |
| M5-4 | P0 | clamd INSTREAM scan on send; reject infected | M | M5-2 | done |
| M5-5 | P2 | Thumbnail service (sharp) + signed short-TTL URLs | M | M5-1 | done |
| M5-6 | P2 | Org-configurable attachment limits in admin Settings | S | M2-3 | done |

## M6 — Webmail product parity

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M6-1 | P1 | Conversation threading (server grouping + threaded read view) | L | M3-2 | done |
| M6-2 | P1 | Drafts: autosave/restore/discard to `\Drafts` | M | M4-2 | done |
| M6-3 | P1 | Server-side search + operators (Dovecot SEARCH) | L | M4-2 | done |
| M6-4 | P2 | Undo send (window) + scheduled send (delayed job) | M | M5-2 | done |
| M6-5 | P2 | Rich-text compose (sanitized) + signatures + templates | L | M6-2 | done |
| M6-6 | P2 | Sieve rules/filters UI (managesieve) | L | — | done |
| M6-7 | P2 | Designed confirm modals; `?` shortcut sheet; compose focus trap; keyboard resizer | M | — | done |

## M7 — Contacts, calendar, PWA

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M7-1 | P2 | Contacts UI (CardDAV) + compose autocomplete/chips | L | M6-5 | done |
| M7-2 | P2 | Calendar UI (CalDAV) read + basic CRUD | L | — | done |
| M7-3 | P2 | PWA manifest + service worker + offline read + web-push | L | M4-3 | done |

## M8 — Enterprise

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M8-1 | P1 | OIDC + SAML SSO | XL | M2-1 | done |
| M8-2 | P1 | 2FA (TOTP + passkeys) + session management UI | L | M2-1 | done |
| M8-3 | P1 | LDAP/AD sync (OpenLDAP/AD/FreeIPA/AzureADDS), LDAPS, nested groups, attr mapping, provision/deactivate | XL | — | done |
| M8-4 | P2 | SCIM provisioning | L | M8-3 | done |
| M8-5 | P2 | Per-org quotas (Dovecot) surfaced + enforced | M | — | done |
| M8-6 | P2 | Retention/legal-hold + mailbox export | L | — | done |

## M9 — A11y, docs, OSS, release

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M9-1 | P1 | Contrast token pass (WCAG AA audit test in CI). Keyboard/VoiceOver + live axe run fold into M10-7 (rebuilds the UI it would test) | M | — | done |
| M9-2 | P1 | Real backup scheduler + restore flow + last-run status | L | — | done |
| M9-3 | P2 | Docs: quickstart, backup/restore, upgrade, troubleshooting, rendered OpenAPI, arch diagram | M | — | done |
| M9-4 | P2 | OSS hygiene: issue/PR templates, CODEOWNERS, dependabot, CodeQL, CoC, labels, release notes | M | — | done |
| M9-5 | P1 | `RELEASE_READINESS.md` final audit; iterate until no Critical/High | M | all | done |

## M10 — Final polish: UI/UX, functionality, design system, a11y (release-grade)

Treat as if shipping publicly tomorrow. No page is "done" until reviewed. No placeholder
buttons, no TODO functionality, no admin-template feel. Premium, handcrafted bar
(Apple/Linear/Vercel/Stripe/Proton). Absorbs M6-7 and M9-1.

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M10-1 | P1 | Design tokens: full semantic color palette (light + OLED dark), type scale, spacing, radius, shadow, motion durations; zero hardcoded colors/values in both apps | L | — | done |
| M10-2 | P1 | Component redesign pass: buttons (all states), inputs (validation/focus/password/autocomplete), tables (virtualized/sortable/sticky/bulk/expandable), cards, dropdowns, dialogs/drawers/modals, tooltips, toasts, context menus | XL | M10-1 | todo |
| M10-3 | P1 | Functionality audit per surface (webmail + admin): every page/button/icon/dropdown/dialog/form/search/filter/pagination/upload/download/shortcut/context-menu + empty/loading/error/success states; fix every dead/placeholder/TODO action | XL | — | todo |
| M10-4 | P1 | Responsive pass: desktop/laptop/tablet/phone/ultra-wide; no overflow or breakage | L | M10-2 | todo |
| M10-5 | P1 | Dark-mode pass: premium neutral tones, correct contrast/elevation/shadows/borders/hover/text (designed, not inverted) | M | M10-1 | todo |
| M10-6 | P2 | Motion pass: subtle/fast/natural transitions (hover/page/dialog/sidebar/toast); remove gratuitous animation | M | M10-2 | todo |
| M10-7 | P1 | Accessibility pass: keyboard nav, focus order + rings, ARIA, screen-reader, contrast, accessible forms/dialogs (feeds M9-1) | L | M10-2 | todo |
| M10-8 | P1 | Config sweep: grep whole codebase for hardcoded values (limits, timeouts, retries, ports, worker counts, storage paths, colors, fonts, spacing, animation durations) → config/tokens | M | M10-1 | todo |
| M10-9 | P2 | Enterprise feature-parity gap analysis vs Gmail/Outlook/Proton/Fastmail/Apple Mail/Mailcow/Exchange/Workspace → gap list → file + implement tasks | L | — | todo |
| M10-10 | P1 | Self-review gate: score every page 1–10 in `RELEASE_READINESS.md` ("would Apple/Vercel/Linear/Stripe ship this?"); iterate until every surface ≥ 8/10 | M | M10-2..8 | todo |

## M11 — Portability & provider abstraction (deploy-anywhere)

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M11-1 | P1 | Strongly-typed config system: sources (env/file/admin-UI/secrets/CLI/API), zod-validated at startup, fail-fast with meaningful errors, auto-generate sample config | M | — | todo |
| M11-2 | P1 | Object-storage adapter completeness: extend `@justmail/storage` to R2/MinIO/B2/Ceph/Wasabi/DO Spaces/Scaleway; capability probe + health check | L | M5-1 | todo |
| M11-3 | P1 | Database adapter: remote/HA Postgres, read-replicas, PgBouncer, connection-pool + failover config; no code coupling | M | — | todo |
| M11-4 | P1 | Cache adapter: standalone/Sentinel/Cluster/Valkey/remote, TLS + auth + auto-reconnect | M | — | todo |
| M11-5 | P2 | Search adapter interface: PG FTS default, pluggable OpenSearch/Elasticsearch/Meilisearch/Typesense | L | M6-3 | todo |
| M11-6 | P2 | DNS provider plugins: Cloudflare/Route53/Google/Azure/DO/Hetzner/Namecheap/GoDaddy/Porkbun/manual behind one interface | L | — | todo |
| M11-7 | P1 | Distributed mail storage support (NFS/SMB/CephFS/ZFS) via config; document Dovecot index/lock constraints | M | — | todo |
| M11-8 | P2 | Admin storage-migration tool: move attachments between providers with no downtime + progress/health | M | M11-2 | todo |
| M11-9 | P0 | No-personalization audit: grep out every hardcoded domain/host/IP/port/path/email/brand/secret/maintainer id → placeholders/config; repo reusable with zero edits | M | M11-1 | done |
| M11-10 | P1 | Multi-arch (ARM64 + AMD64) image builds in CI | S | — | todo |

## M12 — Packaging & deployment targets

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M12-1 | P1 | Generate & maintain config artifacts: `.env.example`, `config.example.yaml`, compose variants (example/production/dev/cluster) | M | M11-1 | todo |
| M12-2 | P1 | Helm chart (`values.yaml`) + Kubernetes manifests | L | M11-1 | todo |
| M12-3 | P2 | systemd unit files + bare-metal install guide | S | M11-1 | todo |
| M12-4 | P1 | Reverse-proxy examples: Nginx, Traefik, Caddy, HAProxy, Apache | S | — | todo |
| M12-5 | P2 | Validate deployment targets: single/multi VM, Docker, Compose, K8s/Helm, LXC/Proxmox, bare metal, major clouds, NAS | L | M12-1..4 | todo |

## M13 — Migration & import from other providers

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M13-1 | P1 | Generic IMAP importer (folders + messages + flags) with resumable progress | L | M6-1 | todo |
| M13-2 | P2 | MBOX + PST import path | L | M13-1 | todo |
| M13-3 | P2 | Provider presets: Google Workspace, Microsoft 365/Exchange, Fastmail, Zoho, Proton, Mailcow, iRedMail, Zimbra, cPanel/Plesk | XL | M13-1 | todo |
| M13-4 | P2 | Import calendars + contacts + aliases | L | M7-1, M7-2 | todo |

## Cross-cutting (extends M9)

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| X-1 | P1 | Full OSS docs suite (README, CONTRIBUTING, SECURITY, ARCHITECTURE, INSTALL, DEPLOYMENT, CONFIGURATION, MIGRATION, UPGRADE, BACKUP/RESTORE, HA, KUBERNETES, DOCKER, API, SDK, CLI, THEMES, PLUGINS, FAQ, TROUBLESHOOTING) | L | — | todo |
| X-2 | P1 | REST API parity for every UI action + OpenAPI, SDK, CLI, webhooks, WS events, API versioning | XL | — | todo |
