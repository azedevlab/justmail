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
| M3-6 | P2 | Server-side rspamd Bayes training on Junk moves via Dovecot IMAPSieve + rspamd controller worker | `services/mail/dovecot`, `services/mail/rspamd` | M | M3-3 | todo |

## M4 — IMAP session layer + realtime

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M4-1 | P1 | `ImapSessionManager` (pooled client per session+mailbox, LRU+TTL, health check) | L | M2-2 | todo |
| M4-2 | P1 | Route all webmail ops through the manager; remove per-request connect/logout | M | M4-1 | todo |
| M4-3 | P1 | IDLE → WS publish (`mail:new`, `mail:flags`); client subscription | L | M4-2 | todo |
| M4-4 | P2 | `LIST-STATUS` folder counts; CONDSTORE delta sync | M | M4-2 | todo |
| M4-5 | P2 | Redis cache: folder list + message snapshots; ETag on message/attachment | M | M4-2 | todo |
| M4-6 | P2 | Message-list virtualization | M | M4-3 | todo |

## M5 — Storage-backed attachments

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M5-1 | P1 | Compose upload via tus → storage adapter (content-hash dedup) | L | M4-1 | todo |
| M5-2 | P1 | Server-side streaming MIME assembly on send from `attachment_ids` | M | M5-1 | todo |
| M5-3 | P1 | Streaming download + Range + ETag (no full buffer) | M | M4-5 | todo |
| M5-4 | P0 | clamd INSTREAM scan on send; reject infected | M | M5-2 | todo |
| M5-5 | P2 | Thumbnail service (sharp) + signed short-TTL URLs | M | M5-1 | todo |
| M5-6 | P2 | Org-configurable attachment limits in admin Settings | S | M2-3 | todo |

## M6 — Webmail product parity

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M6-1 | P1 | Conversation threading (server grouping + threaded read view) | L | M3-2 | todo |
| M6-2 | P1 | Drafts: autosave/restore/discard to `\Drafts` | M | M4-2 | todo |
| M6-3 | P1 | Server-side search + operators (Dovecot SEARCH) | L | M4-2 | todo |
| M6-4 | P2 | Undo send (window) + scheduled send (delayed job) | M | M5-2 | todo |
| M6-5 | P2 | Rich-text compose (sanitized) + signatures + templates | L | M6-2 | todo |
| M6-6 | P2 | Sieve rules/filters UI (managesieve) | L | — | todo |
| M6-7 | P2 | Designed confirm modals; `?` shortcut sheet; compose focus trap; keyboard resizer | M | — | todo |

## M7 — Contacts, calendar, PWA

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M7-1 | P2 | Contacts UI (CardDAV) + compose autocomplete/chips | L | M6-5 | todo |
| M7-2 | P2 | Calendar UI (CalDAV) read + basic CRUD | L | — | todo |
| M7-3 | P2 | PWA manifest + service worker + offline read + web-push | L | M4-3 | todo |

## M8 — Enterprise

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M8-1 | P1 | OIDC + SAML SSO | XL | M2-1 | todo |
| M8-2 | P1 | 2FA (TOTP + passkeys) + session management UI | L | M2-1 | todo |
| M8-3 | P1 | LDAP/AD sync (OpenLDAP/AD/FreeIPA/AzureADDS), LDAPS, nested groups, attr mapping, provision/deactivate | XL | — | todo |
| M8-4 | P2 | SCIM provisioning | L | M8-3 | todo |
| M8-5 | P2 | Per-org quotas (Dovecot) surfaced + enforced | M | — | todo |
| M8-6 | P2 | Retention/legal-hold + mailbox export | L | — | todo |

## M9 — A11y, docs, OSS, release

| ID | P | Task | Effort | Deps | Status |
|---|---|---|---|---|---|
| M9-1 | P1 | axe in CI + contrast token pass + keyboard/VoiceOver fixes | M | — | todo |
| M9-2 | P1 | Real backup scheduler + restore flow + last-run status | L | — | todo |
| M9-3 | P2 | Docs: quickstart, backup/restore, upgrade, troubleshooting, rendered OpenAPI, arch diagram | M | — | todo |
| M9-4 | P2 | OSS hygiene: issue/PR templates, CODEOWNERS, dependabot, CodeQL, CoC, labels, release notes | M | — | todo |
| M9-5 | P1 | `RELEASE_READINESS.md` final audit; iterate until no Critical/High | M | all | todo |
