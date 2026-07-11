# JustMail — Release Readiness

**Version:** `1.0.0-alpha.1` · **Audit date:** 2026-07-11 · **Branch:** `main`

This is the milestone-9 release-readiness gate. It records verification evidence
for everything shipped through M2–M9, rates every known limitation by severity,
and states the go/no-go verdict. It is re-run and updated at each release boundary;
the final GA scoring pass lives in M10-10.

---

## Verdict

**Ship as `alpha` — no Critical or High blockers in the shipped scope.**

The platform typechecks clean across every workspace, the full test suite is
green, and every M2–M9 capability is implemented end-to-end (no placeholder
buttons, no dead endpoints, no "improve later" stubs in shipped surfaces).
Remaining work is **planned forward scope** (M10 design-grade polish, M11
portability, M12 packaging, M13 migration) — not defects against what ships now.
General availability is gated on M10–M13; alpha is appropriate today.

| Gate | Result |
|---|---|
| Critical issues (data-loss / RCE / auth bypass) | **0** |
| High issues (broken core flow / security gap) | **0** |
| Medium issues | 3 (tracked below) |
| Low / cosmetic | 2 (tracked below) |

---

## Verification evidence

All commands run from repo root on the audit date.

| Gate | Command | Result |
|---|---|---|
| Contracts build | `pnpm --filter @justmail/contracts build` | ✅ exit 0 (API consumes built dist) |
| Typecheck (all workspaces) | `pnpm -r typecheck` | ✅ api, admin, webmail, landing, shared-ui, shared-utils, theme-engine, cli — all Done |
| Unit / contract tests | `pnpm -r test` | ✅ **135 passed** — api 118, design-tokens 8, contracts 9 |
| Config fail-fast | zod-validated `config.ts` at boot | ✅ boot aborts on missing/invalid env |
| Migrations | forward-only, idempotent, auto-run at startup | ✅ 0001→0014, `schema_migrations` ledger |

**Not exercised in the sandbox** (require live infra; verified by unit-testing pure
helpers + typecheck, to be validated on the deploy target):

- `pg_dump` / `pg_restore` backup + restore round-trip (needs `postgresql-client-17`,
  now baked into the api/worker image; pure planning helpers covered by 11 tests).
- clamd `INSTREAM` scan, Dovecot IMAP session pool, Postfix send under load.

---

## Feature completeness by milestone

| Milestone | Scope | Status |
|---|---|---|
| **M2** | Rate limiting, credential TTL store, config-driven limits, security headers, generic errors, CI tests | ✅ done |
| **M3** | Contract unification, reply threading headers, spam/importance flags, preview + attachments, Bayes training | ✅ done |
| **M4** | Pooled IMAP session manager, realtime IDLE→WS, LIST-STATUS/CONDSTORE, Redis cache + ETag, virtualization | ✅ done |
| **M5** | Resumable chunked upload + dedup, streaming MIME assembly, Range/ETag download, clamd scan-on-send, thumbnails, org limits | ✅ done *(backlog reconciled — was stale `todo`, code is complete)* |
| **M6** | Threading, drafts, server search, undo/scheduled send, rich-text + signatures/templates, Sieve UI, confirm modals/shortcuts | ✅ done |
| **M7** | Contacts (CardDAV), Calendar (CalDAV), PWA + offline + web-push | ✅ done |
| **M8** | OIDC/SAML SSO, 2FA (TOTP + passkeys), LDAP/AD sync, SCIM, per-org quotas, retention/legal-hold + export | ✅ done |
| **M9** | WCAG-AA contrast audit, real backup engine + restore, operator docs + rendered OpenAPI, OSS hygiene, **this readiness gate** | ✅ done |
| M10 | Design-grade UI/UX, component redesign, responsive/dark/motion/a11y, config sweep, page scoring ≥8/10 | ▫ planned (GA gate) |
| M11 | Provider abstraction: storage/db/cache/search/DNS adapters, no-personalization audit, multi-arch | ▫ planned |
| M12 | Packaging: config artifacts, Helm/K8s, systemd, reverse-proxy examples, target validation | ▫ planned |
| M13 | Import/migration: IMAP/MBOX/PST, provider presets, calendars/contacts/aliases | ▫ planned |

---

## Security posture

- **AuthN/AuthZ:** session guard + `@Principal()`; org-scoped RBAC (`owner>admin>member>viewer`)
  enforced via `OrgsService.requireRole`; destructive ops (backup restore) gated to `owner`.
- **Rate limiting:** Redis-backed global throttler + strict overrides on unlock/login/invite/ws-ticket/send.
- **Credentials:** webmail IMAP creds stored with TTL, wiped on logout/lock, swept by worker; no plaintext at rest beyond TTL window.
- **Attachments:** clamd scan-on-send, infected rejected; download forces `nosniff`, `Content-Type` allowlist, `attachment` disposition.
- **Headers:** `nosniff` on all API responses; CSP on admin + webmail.
- **Audit trail:** fire-and-forget `AuditService.log` on privileged actions (backup run/restore, etc.).
- **Secrets:** none committed; config via env, zod-validated, fail-fast. CodeQL (`security-and-quality`) + Dependabot wired.
- **No personalization in shipped code paths:** hardcoded-value sweep is formalized in M10-8 / M11-9; no domains/IPs/emails baked into application logic today.

---

## Operational readiness

- **Backups:** per-org scheduler (daily/weekly/monthly), pg_dump `-Fc` to provider-abstract storage with SHA-256 checksum, retention pruning, run-now, checksum-verified owner-gated restore, run history in admin UI.
- **Docs:** `docs/operations/{quickstart,backup-restore,upgrade,troubleshooting}.md`, `docs/architecture.md` (mermaid), rendered API reference at `/v1/docs` (Scalar) + `/v1/openapi.json`.
- **Observability:** Vector→Loki, Prometheus + node-exporter + cadvisor + Grafana, fail2ban in compose.
- **Release automation:** tag-driven multi-image build (provenance + SBOM), label sync, categorized release notes, prerelease flag for `-` tags.
- **Deploy:** rsync repo → `/opt/justmail/app` + `scripts/deploy.sh`; compose profiles (core/certs/mail/obs/sec/app).

---

## Risk register

No item is Critical or High. Tracked forward under the noted milestone.

| # | Sev | Item | Mitigation / owner |
|---|---|---|---|
| R1 | Medium | Backup/restore round-trip unexercised in sandbox | `postgresql-client-17` baked into image; validate on first M9 deploy (healthz + manual restore drill) |
| R2 | Medium | UI is functional but pre-design-grade; page scoring not yet ≥8/10 | M10 (design system, redesign, a11y, scoring gate M10-10) |
| R3 | Medium | Provider portability partial (storage adapter solid; db/cache/search/DNS not yet pluggable) | M11 |
| R4 | Low | `next lint` broken under Next 16; typecheck is the correctness gate | Revisit when Next lint stabilizes (M10-8) |
| R5 | Low | mail/attachment volume-level backup is a snapshot concern, not in pg_dump path | Documented in `backup-restore.md`; revisit in M11-7 (distributed mail storage) |

---

## Go / no-go checklist

- [x] Typecheck clean across all workspaces
- [x] Full test suite green (135 tests)
- [x] Every shipped surface implemented (no placeholders / dead actions in M2–M9)
- [x] Config zod-validated, fail-fast, no committed secrets
- [x] Migrations forward-only + idempotent (0001→0014)
- [x] Security headers, RBAC, rate limiting, AV scan-on-send in place
- [x] Backups + restore path implemented; docs published
- [x] OSS hygiene (templates, CODEOWNERS, CodeQL, Dependabot, release automation)
- [ ] Design-grade polish + page scoring ≥8/10 — **M10 (GA gate)**
- [ ] Provider portability + no-personalization audit — **M11**

**Decision:** proceed with `1.0.0-alpha.1`. Re-audit at the M10 boundary before promoting past alpha.
