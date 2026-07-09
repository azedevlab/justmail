# Risk analysis

Ranked by expected loss (impact × likelihood). Each risk lists the mitigation
that must be in place before v1.0 GA.

## R1 — Deliverability regression breaks the product's reason to exist

**Impact:** Catastrophic. If self-hosted JustMail lands in Gmail spam, users
uninstall and the project dies.

**Likelihood:** High. Novel senders + shared /24s hit reputation floors.

**Mitigations:**
- SPF/DKIM/DMARC/MTA-STS/TLS-RPT/BIMI/CAA seeded and drift-checked.
- ARC seal for forwarded mail.
- IP warmup schedule enforced by the postfix policy service (not just settings).
- DMARC aggregate + forensic report ingestion with UI drilldowns.
- DNSBL monitoring with active alerts + automated postmaster escalation.
- Feedback-loop (FBL) ingestion for the big 3 (Google, Microsoft, Yahoo).
- E2E deliverability tests against mail-tester.com in CI weekly.

## R2 — Postgres migration corruption during upgrade

**Impact:** Data loss + downtime. Worst realistic operational outcome.

**Likelihood:** Medium. Additive schema is safe, but partition rewrites,
type changes, and enum growth are known landmines.

**Mitigations:**
- All migrations are additive; destructive migrations gated behind a backup
  verification step (`justmail upgrade --pre-backup-verified`).
- `migrate up` runs inside a per-file transaction where possible; non-tx
  operations (CONCURRENTLY, REINDEX) live in their own explicit file.
- Every release ships with a `restore-drill.sh` that pipes the latest backup
  into a scratch container.
- Ledger table (`schema_migrations`) checksum matches file hash — refuses to
  apply if the file was edited after landing.

## R3 — Attachment storage misconfiguration exposes tenant data

**Impact:** Catastrophic. Cross-tenant read = platform-ending incident.

**Likelihood:** Medium. Bucket policies, signed URLs, and dedup all interact.

**Mitigations:**
- Object keys prefixed by `org/<id>/…` and enforced by adapter middleware.
- Signed URLs are org-scoped and time-bounded (max 15 min for downloads).
- Content-addressed dedup only within an org (no cross-org key sharing).
- Bucket policy templates for each provider ship in the installer.
- Integration test that tries a cross-tenant fetch and asserts 403.

## R4 — RCE via mail parsing or attachment preview

**Impact:** Full compromise of the worker or preview service.

**Likelihood:** Medium. mailparser, sharp, poppler, ClamAV all have CVE history.

**Mitigations:**
- Preview / OCR / thumbnail workers run in a hardened sandbox (gVisor or
  seccomp+userns; no network egress for the sandbox pool).
- MIME parsing wrapped by a defensive layer that rejects nested-part depth > 8
  and mime-part count > 1000.
- Renovate + `trivy image` on every image built by CI.
- SBOMs (SPDX + CycloneDX) attached to every release.

## R5 — Denial of service via mailbomb / SMTP flood

**Impact:** Regional outage; mail queue unrecoverable in the worst case.

**Likelihood:** High. Any public MTA sees this hourly.

**Mitigations:**
- Postscreen + rspamd rate limits per remote client.
- Traefik + fail2ban at the edge for HTTPS.
- Per-org and per-mailbox rate limits (settings row consumed by a policy service).
- Queue-depth alarms with automatic tempfail on new deliveries.

## R6 — Cross-tenant leakage in shared caches

**Impact:** High. Session, dashboard, or search-index leakage would be devastating.

**Likelihood:** Medium. Redis, TanStack Query, service workers all have footguns.

**Mitigations:**
- Redis keys namespaced `org:<id>:…`, enforced by a helper that refuses global keys.
- TanStack Query cache scoped by org id in the query key.
- Service worker cache versioned by org id (evicted on org switch).
- Search index uses org-scoped Meilisearch keys (or Elastic filter aliases).

## R7 — Plugin system as a supply-chain attack vector

**Impact:** High. Malicious plugin = code execution in worker + credential theft.

**Likelihood:** Medium once we open the ecosystem.

**Mitigations:**
- Plugin manifest is signed with the publisher's key.
- Plugin bundle sandboxed on the server (worker_thread with cap-based fs +
  net) and on the client (iframe with strict CSP + postMessage protocol).
- Explicit permission acceptance per plugin, per install.
- First-party plugin repo audited; third-party plugins carry an "unverified"
  badge until reviewed.

## R8 — Cloudflare / DNS provider outage

**Impact:** Medium. New certs can't be issued; DNS Center repairs stall.

**Likelihood:** Low but non-zero.

**Mitigations:**
- Multiple ACME resolvers (Let's Encrypt + ZeroSSL) with priority.
- DNS provider adapter interface — customers can switch to another provider
  without a redeploy.
- Cached "last known good" DNS state in the DB so audits still render.

## R9 — Backup rot

**Impact:** Catastrophic if discovered during a restore.

**Likelihood:** Medium — silent bit rot on cheap object stores is real.

**Mitigations:**
- Every backup carries a sha256 + size header written into the DB.
- Weekly restore-drill worker: fetch, verify, restore to scratch, compare row
  counts against production, report to Grafana.
- Object-lock (WORM) supported on providers that offer it.

## R10 — WebSocket abuse

**Impact:** Medium. A malicious client can hold thousands of sockets and starve
the pool.

**Likelihood:** Medium.

**Mitigations:**
- Per-user socket limit (default 4); per-org limit tuned.
- Server-side keep-alive with idle-close after 60s of silence.
- Rate limit for subscribe/emit; ban on abuse (populates `blocked_ips`).

## R11 — Cross-org WebSocket subscription

**Impact:** High. Wrong subscription = live spying on another tenant.

**Likelihood:** Low if guarded, catastrophic if missed.

**Mitigations:**
- Subscription topic is derived server-side from the session; clients cannot
  request arbitrary topics.
- Every published event is filtered by principal.orgId before flush.
- Fuzz test on the WS protocol.

## R12 — HTML email XSS via webmail rendering

**Impact:** High. Session hijack, mailbox theft.

**Likelihood:** High for any real user base.

**Mitigations:**
- Body rendered inside a null-origin iframe with `sandbox=""` (no allow-scripts).
- All external images proxied through a fetcher that strips cookies + tracks
  pixel bypass; user must opt in to image loading per sender.
- CSP: `default-src 'none'; img-src blob: data: https:` at the iframe.

## R13 — Cost blowout on object storage from thumbnail generation

**Impact:** Medium. Runaway spend, not data loss.

**Likelihood:** Medium.

**Mitigations:**
- Thumbnails opt-in per org; lazy-generated on first view.
- Per-org thumbnail budget (rows / GB / month).
- Automatic pruning of thumbnails older than N days for unopened messages.

## R14 — Regulatory export request (GDPR / SAR) that can't be honoured

**Impact:** Legal. Fines and reputational damage.

**Likelihood:** Certain over time.

**Mitigations:**
- Every table with user-linked data has an owner column indexed.
- `justmail user-data --export/--delete <user>` implemented as a first-class
  CLI backed by a documented DB traversal.
- Retention policies per domain enforced by a purger worker.

## R15 — Contributor overwhelmed by monolithic setup

**Impact:** Long-term. Community stalls, ecosystem never forms.

**Likelihood:** High if we don't invest.

**Mitigations:**
- `pnpm dev` starts the whole stack in dev containers with hot reload.
- A minimal path — "add a route + a screen" — documented in `docs/developer/`
  as the first contribution.
- Codespaces / Dev Container / GitPod config in-repo.
- Storybook for `shared-ui`; hosted at the docs site.
