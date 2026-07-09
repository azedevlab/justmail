# Implementation roadmap — v1.0

The v0 code stays on the branch `v0` for reference; v1 development lands on
`main`. Every milestone below is a shippable, dogfoodable slice — no
"almost working" states cross a milestone boundary.

## M1 — Foundation (weeks 1–4)

Goal: **the new monorepo boots end-to-end with zero regressions vs v0's
mail plane**.

- Set up the new monorepo skeleton: `apps/{admin,webmail,landing,api}`,
  `packages/{contracts,design-tokens,shared-ui,shared-utils,storage,
  theme-engine,plugin-sdk,mail-parser,openapi,eslint-config}`.
- Wire Turborepo, pnpm workspaces, changesets.
- Port `apps/api` from v0 with a hard cleanup pass: modules follow the
  `module/controller/service/repo/events` shape; every mutation uses the
  Nest `EventBus` wrapper.
- Move Zod schemas out of the API into `packages/contracts`.
- Generate OpenAPI at build time from Nest metadata + Zod.
- Bring Postfix/Dovecot/Rspamd/ClamAV configs across as-is; keep the
  data-plane views working.
- Migrate `apps/web` (v0) → v0-only `apps/legacy-admin` for reference.

Exit criteria:

- `pnpm dev` boots everything.
- v0 mail-plane tests still pass against the v1 API.
- OpenAPI diff between v0 and v1 = 0 for shared endpoints.

## M2 — Design system & app shells (weeks 5–8)

Goal: **beautiful, accessible primitives + admin/webmail/landing shells**.

- `packages/design-tokens`: Style Dictionary emits Tailwind theme and CSS
  vars for light/dark/high-contrast.
- `packages/shared-ui`: implement every primitive in the catalog; Storybook
  live with a11y annotations and interaction tests.
- `apps/admin`: layout shell, sidebar, command palette (`⌘K`), global
  search (`/`), notifications inbox, undo toast, breadcrumbs.
- `apps/webmail`: three-pane shell, folder tree, message list, thread
  reader, composer stub.
- `apps/landing`: hero, features, docs router (MDX), changelog, download.
- `packages/theme-engine`: token→CSS runtime with `:root` /
  `[data-org]` / `[data-domain]` cascade.

Exit criteria:

- Storybook covers every primitive with a11y clean.
- Lighthouse budgets green.
- axe scan zero critical on shell screens.

## M3 — Identity, tenancy, RBAC (weeks 9–11)

Goal: **production-ready auth**.

- Passkey/WebAuthn (register + authenticate + step-up).
- Recovery codes, session device fingerprint, session revoke UX.
- SSO providers (OIDC first, SAML second) with JIT provisioning.
- Teams (sub-tenant) tier + policy engine.
- RLS on every tenant-scoped table.
- Bearer key scopes as first-class rows; scope enforcement middleware.
- Invites with in-platform email delivery.

Exit criteria:

- Passkey login smoke test in CI.
- Cross-tenant integration test = 100% blocked.
- Audit log entry on every write path.

## M4 — Domains, DNS, DKIM, deliverability (weeks 12–14)

Goal: **first-class deliverability**.

- DNS provider adapter interface (Cloudflare, Route53, deSEC, Gandi).
- Automatic yearly DKIM rotation worker.
- DMARC XML parser + drilldowns; forensic (RUF) reports opt-in.
- DANE (TLSA) support in DNS Center.
- ARC seal for forwarded mail.
- IP-warmup enforcement via postfix policy service.
- FBL ingestion (Google, Microsoft, Yahoo — plumbing only in v1.0).
- Deliverability dashboard with reputation trend.

Exit criteria:

- Weekly mail-tester regression ≥ 9.5/10 in CI.
- One-click repair round-trips DNS without operator involvement.

## M5 — Storage & attachments (weeks 15–17)

Goal: **enterprise-grade attachments**.

- `packages/storage`: local, S3, R2, MinIO, Backblaze, Azure, GCS.
- Content-addressed dedup per org.
- tus.io resumable chunked upload.
- ClamAV virus-scan pipeline with quarantine.
- Thumbnail worker (image via sharp, PDF via poppler) in sandbox.
- Signed URLs, CDN passthrough.

Exit criteria:

- Cross-tenant attachment fetch = 403 in integration tests.
- 200 MB upload survives a network drop.

## M6 — Webmail: read + compose + actions (weeks 18–22)

Goal: **feature-parity with a modern webmail read pane**.

- Conversation view with virtualisation.
- TipTap composer with markdown/HTML toggle, autosave, drag-drop
  attachments (via storage), inline images.
- Snooze, star, pin, labels/categories.
- Schedule send + undo send (server-side hold).
- Templates, signatures, aliases, multi-account.
- Rules UI → Sieve compiler; managesieve for storage.
- Server FTS (Dovecot Xapian) with saved searches.
- HTML email XSS defence: iframe sandbox + remote-image proxy.

Exit criteria:

- Playwright regression suite green: inbox, compose, send, receive,
  search, snooze, undo.
- HTML XSS corpus = 0 escapes.

## M7 — PWA, notifications, realtime (weeks 23–25)

Goal: **feels like an app, not a website**.

- Manifest + install prompt across all three surfaces.
- Service worker: shell cache, background sync, offline compose queue.
- Web Push (VAPID) + subscription management UI.
- WebSocket subscription API with topic authorization.
- Optimistic updates end-to-end.

Exit criteria:

- Lighthouse PWA score 100 on all three apps.
- WS fuzz test passes.

## M8 — Observability, queue, security surfaces (weeks 26–28)

Goal: **operators love it**.

- Grafana dashboards shipped in-repo.
- Alerting rules + runbooks.
- Queue view with delete / requeue / hold via postfix admin socket.
- Blocked IP UX + geo blocks + reputation panel.
- Security score v2 with actionable checklist.
- OpenTelemetry tracing across api ↔ workers ↔ webhooks.

Exit criteria:

- Every runbook has an integration test that reproduces the failure and
  the runbook resolves it.

## M9 — Backups, DR, migration (weeks 29–31)

Goal: **safe to run in production**.

- Restore UI + CLI.
- Backup verification worker (weekly restore-to-scratch).
- Encryption at rest (per-org key derived from master).
- Migration adapters: iRedMail, Mailcow, Postfixadmin.
- `justmail user-data --export/--delete` for GDPR.
- Immutable audit log (Merkle daily root).

Exit criteria:

- Restore drill green for 4 consecutive weeks.
- Migration adapter round-trips a real iRedMail snapshot.

## M10 — Plugins & themes (weeks 32–34)

Goal: **ecosystem enabled**.

- Plugin manifest, permission scopes, sandbox loader (server + client).
- First-party plugins (Slack notifier, S3 report exporter, MetaMail
  integration) as reference.
- Theme editor in-app, presets, per-domain themes.
- Marketplace UI stub (registry lands in v1.1).

Exit criteria:

- A community can build and ship a plugin using only public docs.

## M11 — Landing, docs, launch prep (weeks 35–36)

Goal: **shippable open-source project**.

- Landing site polished, screenshots, testimonial slots.
- Docs versioned + searchable; every runbook + doc listed above published.
- CHANGELOG + release automation.
- Homebrew + Docker Hub + GHCR release channels.
- CVE assigner registration; `SECURITY.md`.
- Public roadmap board.

Exit criteria:

- External auditor pen test complete; findings triaged and either fixed
  or documented with mitigation.
- Beta operators (≥ 10 external) have run for two weeks with no P1.

## v1.1 — post-launch (roadmap only)

- Multi-region deployment reference.
- Sharded Postgres (Citus) support.
- Native mobile PWA push channels.
- Marketplace registry + plugin publisher CLI.
- LDAP/AD sync + RBAC provisioning.
- E2E encrypted composer (PGP + S/MIME) as a plugin.
- Meilisearch integration for cross-mailbox + doc search.
- BIMI Verified Mark Certificate broker.

## Cross-cutting workstreams (run continuously)

- Docs: every feature ships with docs.
- Tests: every feature ships with unit + integration + e2e.
- Accessibility: every UI change ships with axe + keyboard verification.
- Security: SBOM + trivy + audit on every PR.
- Perf: budgets enforced on every PR touching bundles.

## Stop-line for v1.0

v1.0 does not GA until:

- All 11 milestones exit-criteria met.
- SOC-2-shaped audit log verified.
- WCAG 2.2 AA verified on every shipped screen.
- 30-day production soak on the JustMail hosted preview with 0 P1
  incidents.
- Two independent operators have completed the Path A install without
  human help.
