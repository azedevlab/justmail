# JustMail — Independent Engineering Audit

Date: 2026-07-10 · Baseline: commit `b9d5de8` · Auditors: independent review board (architecture, backend, frontend, design, UX, security, mail infra, DevOps, a11y, QA)

This report assumes nothing in the codebase is correct until proven. Scores are calibrated
against Google Workspace, Exchange, Proton, and Fastmail — not against hobby projects.

---

## 1. Executive summary

JustMail has a **genuinely good platform skeleton** (control plane, compose stack,
observability, DNS automation) wearing a **prototype-grade webmail** and shipping with
**near-zero automated verification**. The admin console is presentable. The mail core
(postfix/dovecot/rspamd reading Postgres views) is a sound, differentiated design.
Everything at the edges — webmail data path, testing, rate limiting, configuration
discipline, open-source hygiene — is below the bar for the stated ambition.

**The single worst architectural decision in the codebase:** the webmail opens a brand-new
TCP + TLS + IMAP LOGIN to Dovecot **for every HTTP request** — every folder list, message
open, flag toggle, and attachment byte. No pooling, no IDLE, no cache. This is a design
that works in a demo and collapses with 50 concurrent users. Gmail-class webmail is
impossible on this data path. It must be replaced, not patched.

**The single worst security finding:** `POST /unlock` verifies mailbox passwords against
Dovecot with **no rate limiting anywhere in the API**. It is an unthrottled password
oracle for every mailbox on the platform, reachable with any org-member session.

### Scorecard

| Area | Score | One-line verdict |
|---|---|---|
| Architecture | 6/10 | Control plane sound; webmail data path fundamentally wrong |
| Backend | 5/10 | Clean Nest patterns, but no rate limits, no pooling, contract drift |
| Frontend | 5/10 | Two decent apps; webmail is one 1,000-line file, no virtualization |
| UI (visual) | 7/10 | Meridian is genuinely good; consistency holes remain |
| UX (product) | 4/10 | No threading, drafts, undo send, search, or real-time — table stakes missing |
| Performance | 3/10 | Per-request IMAP logins, full-MIME re-parse per click, no caching layer |
| Accessibility | 4/10 | Sporadic aria labels; no focus traps, no keyboard resize, untested |
| Security | 5/10 | Good crypto hygiene (argon2id, hashed tokens) undone by missing throttles |
| Documentation | 5/10 | Good internal phase docs; thin user-facing install/ops docs |
| Open-source readiness | 3/10 | No issue templates, CODEOWNERS, dependabot, code of conduct |
| Enterprise readiness | 2/10 | No SSO, no LDAP, no SCIM, no retention policies, no quotas UI |
| Production readiness | 5/10 | Runs, deploys, observes — but untested and unthrottled |
| **Overall** | **4.5/10** | Strong bones, prototype organs |

---

## 2. Critical issues (fix before anything else)

| ID | Severity | Finding |
|---|---|---|
| C-1 | **Critical** | **No rate limiting on any endpoint.** `grep` finds no Throttler/limiter in the API. `POST …/webmail/mailboxes/:id/unlock` performs a live IMAP login with an attacker-supplied password → unthrottled brute-force oracle against every mailbox. Login, invite-accept, and ws-ticket endpoints equally unthrottled. |
| C-2 | **Critical** | **New IMAP connection per HTTP request** (`webmail.service.ts` `withImap`: connect → op → logout). Every flag toggle costs TCP+TLS+LOGIN. Dovecot penalizes this (auth cache churn, `mail_max_userip_connections`), latency is 150–400 ms floor per action, and it makes IDLE/push impossible. Needs a per-unlocked-mailbox pooled connection manager (or an IMAP proxy layer). |
| C-3 | **High** | **Sealed mailbox passwords accumulate forever.** Unlock writes `webmail.session:{sessionId}.{mailboxId}` rows into `settings` with no TTL, no cleanup on session expiry, no cascade on logout. Compromise of DB + `ENCRYPTION_KEY` yields plaintext mailbox passwords for every user who ever unlocked. Needs TTL, sweep job, and delete-on-logout. |
| C-4 | **High** | **Attachment/send path is memory-hostile.** Send: base64 in JSON, 32 MB global body limit (applies to *every* endpoint — DoS amplifier), full decode in RAM. Read: full MIME downloaded and re-parsed per message open, per thumbnail, per download — a 20 MB message costs 3× 20 MB transfers to view one attachment. The `@justmail/storage` abstraction (7 backends!) and tus.io endpoint already exist and are **completely unused by webmail**. |
| C-5 | **High** | **Zero unit tests. One Playwright spec. Empty integration/security test dirs.** For a mail platform (data-loss risk domain), this is disqualifying. No CI gate can protect correctness today. |
| C-6 | **High** | **Remote content loads unconditionally in the HTML viewer.** Tracking pixels fire on message open — a privacy regression vs. every 2024-era client. No image proxy, no "load remote content?" gate, no server-side sanitization (defense relies solely on iframe sandbox). |
| C-7 | **High** | **Contract drift is systemic.** API defines its own `SendRequest`/`FlagAction` zod instead of importing `@justmail/contracts`. Contract `FlagAction` has 8 values, API accepts 4. `MessageSummary` promises `preview`, `has_attachments`, `thread_id` — API returns none of them; the frontend types are lies. `ComposeRequest.send_at`, `in_reply_to`, `references`, `attachment_ids` are accepted by contract and **silently ignored** by the API. |

---

## 3. Architecture review

**Good, keep:**
- Postfix/Dovecot reading Postgres **views** with a SELECT-only role — the "no config file
  edits" mechanism is the platform's best idea and a real differentiator vs. Mailcow.
- pnpm + Turborepo monorepo with `contracts`, `design-tokens`, `shared-ui`, `mail-parser`
  as packages — correct shape.
- Traefik-only edge, compose profiles, Vector→Loki→Grafana observability, fail2ban,
  ClamAV present. WS gateway with short-lived HMAC tickets is a correct pattern.
- Session tokens random-256-bit, stored **hashed** (sha256), argon2id for passwords with
  a constant dummy hash to blunt user-enumeration timing. Cookie flags correct
  (httpOnly, secure-in-prod, sameSite=lax).

**Wrong, replace:**
- **Webmail-over-stateless-IMAP** (C-2). The webmail tier must own a connection/session
  layer: per-unlocked-mailbox pooled ImapFlow client with IDLE → WS push to the browser,
  LRU-evicted, TTL-bound. Everything else in the webmail roadmap depends on this.
- **`settings` table as a KV dumping ground** — sealed credentials, org settings, and
  platform config share one table with string-prefixed keys. Credentials belong in their
  own table with `expires_at` and an index, or in Redis with native TTL.
- **`(config as unknown as {…}).JM_ADMIN_HOST` casts in `main.ts`** — the env vars are
  *in* the schema; the casts are dead weight that hide typos from the compiler.
- **Worker/queue underuse** — BullMQ exists, yet Sent-folder append, DMARC parsing, and
  notification fan-out run inline in request handlers with `catch → log.warn`.
- **No repository layer** — services issue raw SQL inline. Acceptable now; will not
  survive multi-node or read-replica routing (DATABASE_READONLY_URL is configured and
  apparently never used).

---

## 4. Backend review (endpoint-by-endpoint highlights)

- `GET folders` — issues one IMAP `STATUS` per folder, serially. 20 folders = 20 round
  trips per sidebar render. Use `LIST-STATUS` extension (Dovecot supports it) or batch.
- `GET messages` — reads `client.mailbox.exists` via a type-cast hack; fetches newest N
  by sequence; **no pagination cursor**, no CONDSTORE/QRESYNC delta sync, no preview
  text, no `has_attachments` (contract promises both). Client silently caps at 100.
- `GET message/:uid` — downloads + parses **entire** raw MIME; inlines cid images as
  base64 data URIs into a JSON payload (a 1.9 MB image becomes ~2.6 MB of JSON string).
  No ETag/If-None-Match despite messages being immutable by UID.
- `POST send` — no `In-Reply-To`/`References` headers set on replies → **breaks threading
  for every other client**; ignores `send_at` (scheduled send) and drafts; smarthost DSN
  handling unverified. Sent-append failure is fire-and-forget.
- `attachments/:idx` — index-based against a re-parse: correct given no storage, but
  `Content-Disposition: attachment` always (no `inline` option for previewable types),
  no Range support, no `X-Content-Type-Options: nosniff` header, MIME passed through
  from sender-controlled input (`Content-Type: text/html` attachment served verbatim —
  mitigated only by fetch-to-blob on our client; direct URL open is a stored-XSS-adjacent
  hazard). **Must force nosniff + sanitize/allowlist response MIME.**
- Global `32mb` JSON body limit (C-4): scope large bodies to the send route only.
- `tls: { rejectUnauthorized: false }` on internal IMAP/SMTP — tolerable inside one
  compose network, indefensible the day multi-node ships. Should pin the internal CA.
- Audit log writes are good and consistent across webmail actions. Keep.

---

## 5. Webmail vs. the field (feature matrix)

| Capability | Gmail | Fastmail | Proton | **JustMail** |
|---|---|---|---|---|
| Conversation threading | ✅ | ✅ | ✅ | ❌ none (no References on send either) |
| Server-side search | ✅ | ✅ | ✅ | ❌ client-side filter of loaded 100 |
| Drafts (auto-save) | ✅ | ✅ | ✅ | ❌ contract exists, nothing wired |
| Undo send | ✅ | ✅ | ✅ | ❌ |
| Scheduled send | ✅ | ✅ | ✅ | ❌ `send_at` accepted and ignored |
| Signatures / templates | ✅ | ✅ | ✅ | ❌ contracts exist, no API, no UI |
| Sieve rules / filters | n/a | ✅ | ✅ | ❌ contract exists; Dovecot has managesieve |
| Snooze | ✅ | ✅ | ❌ | ❌ (button correctly removed; feature absent) |
| Spam / not-spam action | ✅ | ✅ | ✅ | ❌ contract has it, API rejects it |
| New-mail push (IDLE→WS) | ✅ | ✅ | ✅ | ❌ manual refresh button |
| Remote-image blocking | ✅ | ✅ | ✅ | ❌ (C-6) |
| Attachment drag-drop | ✅ | ✅ | ✅ | ❌ picker only |
| Rich text compose | ✅ | ✅ | ✅ | ❌ plain text only |
| Contacts / autocomplete | ✅ | ✅ | ✅ | ❌ (Radicale runs; no CardDAV UI) |
| Calendar UI | ✅ | ✅ | ✅ | ❌ (Radicale runs; no UI) |
| PWA / offline | ✅ | ✅ | ✅ | ❌ |
| Keyboard shortcuts | ✅ full | ✅ full | ✅ | ⚠️ 3 hotkeys (c, s, #) |
| Multiple accounts | ✅ | ✅ | ✅ | ⚠️ mailbox switcher via `/`, no unified inbox |
| Print message | ✅ | ✅ | ✅ | ❌ |
| List virtualization | ✅ | ✅ | ✅ | ❌ full DOM render |

What shipped this week (attachments view/send, HTML viewer, reply/forward, archive) moved
the webmail from "demo" to "minimal client." The distance to "competitive client" is the
entire table above.

---

## 6. Attachments deep-dive

- **Hardcoded:** 15 MB total cap (duplicated in service *and* frontend), 16-file cap,
  2 MB cid-inline cap, 5 MB thumbnail cap (frontend), 20 MB zod string max, 32 MB body
  limit. None configurable, all magic numbers, two of them can drift apart. → Move to
  org-level settings with env defaults.
- **No streaming anywhere.** Read path buffers whole messages; write path buffers whole
  base64 strings. `ImapFlow.download` returns a stream — it is buffered immediately.
- **No virus scan on webmail send.** ClamAV runs for the milter path; a compose-attached
  EICAR sails out. Route send attachments through clamd (INSTREAM) before SMTP submit.
- **Storage abstraction unused** (C-4). Correct target design: compose uploads go
  tus → `@justmail/storage` (dedup by content hash already exists per docs) → send
  references `attachment_ids` (already in the contract!) → MIME assembled server-side,
  streaming. The current base64-in-JSON path was the expedient choice and is the wrong one.
- **No signed URLs, no Range requests, no thumbnail service** (sharp is even in
  `onlyBuiltDependencies` — installed, unused for this).

---

## 7. Hardcoded-value inventory (must become config)

`webmail.service.ts`: `IMAP_HOST="dovecot"`, `IMAP_PORT=993`, `SMTP_HOST="postfix"`,
`SMTP_PORT=587` — **the mail platform's own service discovery is hardcoded**, not in the
(otherwise well-done, zod-validated) `config.ts`. Also: all limits in §6; message list
`limit ≤ 200`; admin bell poll `60_000`; queue poll `15_000/30_000`; webmail list width
bounds `280/560` + localStorage key; session TTL is configurable (good); IMAP auth
`rejectUnauthorized:false`. Frontend tokens (colors/fonts/spacing) correctly live in
`@justmail/design-tokens` — that part is right.

---

## 8. Security review

Beyond C-1/C-3/C-6 and the MIME-passthrough issue in §4:

- **CSRF**: JSON-only + sameSite=lax + CORS allowlist → acceptable. Verify no endpoint
  ever accepts form-encoded bodies (body parser is disabled globally then re-enabled for
  json/raw — good discipline).
- **No security headers on API responses** (nosniff, frame-ancestors). Next.js apps'
  CSP not verified — assume absent. Add helmet-equivalent + CSP for both apps.
- **Secrets discipline is good**: nothing sensitive found in repo; deploy secrets
  server-side; GH token pattern documented. Keep.
- **`ForbiddenException` on wrong mailbox password echoes raw IMAP error text**
  (`detail: err.message.slice(0,200)`) — leaks server internals; return a fixed string.
- **Docker**: images/tags pinned (good); container user/caps/read-only-fs not audited
  per-service — several third-party images run default-root. Add `no-new-privileges`,
  read-only where possible.
- **fail2ban** present for the mail ports — but nothing feeds it API-layer auth failures.
- Session fixation/rotation: token is regenerated per login (good); no session rotation
  on privilege change (minor).

---

## 9. Performance review

- **Latency floor**: every webmail action ≥ TLS handshake + IMAP LOGIN + SELECT (C-2).
- **N+1**: folder STATUS loop (§4); org-role check + settings lookup + IMAP login run
  serially on *every* webmail request — the creds row should be cached in-process/Redis
  for the session lifetime.
- **No HTTP caching**: messages are immutable per (mailboxId, folder, uid) — trivially
  ETag-able; attachments likewise. Zero cache headers today.
- **Frontend**: message list renders all rows (no virtualization); the mailbox page is a
  single ~1,000-line client component — compose, viewer, unlock, attachments all in one
  bundle chunk; no `React.lazy` split; Avatar/thumbnail fetches aren't deduped across
  renders (objectURLs re-fetched on remount).
- **Redis is provisioned and idle** for the webmail path. It should hold: creds cache,
  folder counts, message-list snapshots, rate-limit counters.
- Postgres query plans/indexes not exercised enough to judge — flagging **absence of any
  slow-query logging/pg_stat_statements dashboards** as the actionable gap.

---

## 10. UI/UX per-page scores (Apple bar; 10 = ship in Cupertino)

| Page | Score | Notes |
|---|---|---|
| Admin overview | 7 | Solid hierarchy; stat cards good; lacks time-range control and drill-ins |
| Domains | 7 | DNS Center is the product's hero flow; verification states clear |
| Mailboxes | 6.5 | Good table + filter; no bulk actions, no quota column, no pagination UI |
| Aliases | 6.5 | Functional, clear; multi-target input is raw text, needs chips |
| Queue | 6 | Live stats good; deferred table lacks retry/hold/delete actions (read-only ops page) |
| Deliverability | 5.5 | Placeholder-grade data density; DMARC reports absent (parser is a stub) |
| Security | 6 | IP rules fine; no 2FA management, no session list, no password policy |
| Backups | 4 | A path input and a button; no schedule, no restore flow, no last-run status — **not a backup product** |
| Audit log | 6 | Complete but no filters, no export, no retention indicator |
| Webhooks | 6 | CRUD fine; no delivery log/retry visibility |
| API keys | 6.5 | Scopes visible; no last-used, no expiry |
| Team | 6.5 | Invites work; roles limited to fixed set; no SSO/SCIM hooks |
| Settings | 4 | A raw KV table presented to humans — needs typed, grouped settings UI |
| Plugins / Themes | 6 | Honest, well-designed "coming soon" — acceptable only because labeled |
| Login | 7 | Clean, focused |
| **Webmail shell** | 6.5 | 3-pane + resizable list + palette-quality chrome is right; density good |
| Webmail read pane | 5.5 | Viewer solid now; no threading, no header details disclosure, native `confirm()` for delete is jarring |
| Compose | 5.5 | Draggable/minimizable panel is nice; plain-text only, no drafts, no To-field chips/autocomplete |
| Unlock screen | 6 | Clear copy; no "why am I entering a second password?" affordance beyond one line |

**Cross-cutting UI debts**: native `confirm()` dialogs (webmail delete) vs. designed
modals elsewhere — inconsistent; toast-only error surfaces for mutations that deserve
inline recovery; empty states good in admin, thinner in webmail; dark mode preserved but
not re-audited after Meridian (several `rgb(10_132_255/…)` literals bypass theme vars —
regression risk in `.theme-dark`); reduced-motion honored (good).

---

## 11. Accessibility

- Focus **not trapped** in ComposePanel (role=dialog, non-modal, Esc doesn't close it).
- List-resize separator: `role=separator` but **no keyboard operability**
  (no tabindex, no arrow-key handling, no `aria-valuenow`).
- Hotkeys lack an in-app reference sheet (`?` overlay is table stakes).
- Icon-only buttons are labeled (good discipline overall), Tooltip-wrapping-Dropdown in
  the admin header produces nested interactive semantics — verify with VoiceOver.
- Color contrast: neutral-700-on-bg and 11px labels likely fail WCAG AA at small sizes —
  needs a token-level contrast pass for both themes.
- No automated a11y checks (axe) in CI. No skip-links. iframe viewer needs
  `aria-describedby` context.

---

## 12. Testing & QA — the emperor has no clothes

- **0 unit tests** across all apps and packages (`find … -name "*.spec.ts" | wc -l → 0`
  outside one Playwright file).
- `tests/integration` and `tests/security` are **empty directories with READMEs**.
- No CI-enforced coverage, no contract tests (drift in C-7 is the direct consequence),
  no IMAP/SMTP integration harness (greenmail/dovecot-in-CI), no visual regression,
  no axe audit, no load test for the queue/webmail paths.
- Minimum credible bar: contract round-trip tests, webmail service tests against a
  dockerized dovecot, Playwright flows (unlock→read→reply→send→sent-copy), axe smoke.

---

## 13. Documentation & open source

- `docs/` phases/runbooks/multi-node are genuinely useful internal docs. **Missing:**
  quickstart (docker compose up path for a stranger), backup/restore guide, upgrade
  guide, API reference publishing (openapi package exists — render it), architecture
  diagram, troubleshooting matrix.
- `.github`: workflows only. **Missing:** issue templates, PR template, CODEOWNERS,
  dependabot/renovate, CodeQL config (security.yml exists — verify scope), discussions
  templates, `CODE_OF_CONDUCT.md`, release notes automation, labels taxonomy.
- README is 117 lines — needs the standard OSS anatomy: badges, screenshot, 5-minute
  quickstart, feature matrix, comparison table, hosted-demo link, support policy.

---

## 14. Enterprise gaps

No SSO (OIDC/SAML), no LDAP/AD (no code paths at all — not started), no SCIM
provisioning, no 2FA/passkeys, no per-org quotas surfaced, no retention/legal-hold,
no export (mailbox takeout), no admin impersonation with consent trail, no multi-region
story beyond the multi-node doc. Each is a roadmap item, none is started. Claiming
"enterprise" today would be false advertising; the honest label is
**"small-team self-hosted, single-node"**.

---

## 15. Verdict

Kill list (replace, don't defend): per-request IMAP connections; base64-JSON attachment
send; settings-table credential cache; client-side-only search; API-local zod contracts;
native `confirm()`; unthrottled auth endpoints.

Keep list: Postgres-views mail core; token pipeline + Meridian; contracts package (as
the *only* source of truth); observability stack; audit logging; WS ticket auth.

The platform earns its ambition only after: (1) rate limiting everywhere, (2) a real
IMAP session layer with push, (3) storage-backed attachments, (4) contract unification,
(5) a test suite that would catch any of the above regressing. That is the spine of the
roadmap in `ROADMAP.md`.
