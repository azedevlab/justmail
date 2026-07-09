# Security review

## Threat model

Adversaries, in order of concern:

1. **Public internet** — SMTP flood, credential stuffing, mass scans.
2. **Malicious tenant admin** — attempting cross-org access.
3. **Compromised mailbox** — pivots to attachment exfil or webhook abuse.
4. **Compromised plugin** — RCE on server or XSS on client.
5. **Passive network observer** — TLS everywhere is the answer.
6. **Compromised operator (insider)** — audit trail, MFA, key custody.
7. **Physical host access** — encrypted storage, secret manager (v1.1).

## Controls — cross-cutting

- **TLS**: LetsEncrypt for edge (Cloudflare DNS-01), certd-managed certs on
  mail ports. Minimum TLS 1.2 for legacy MTA compat; 1.3 for HTTPS and
  Submission. HSTS with 1-year `max-age`, preload eligible on the marketing
  site; not on tenant subdomains where TLS bootstrap needs flexibility.
- **Content Security Policy** on admin + webmail:
  `default-src 'self'; script-src 'self'; connect-src 'self' wss:; frame-src blob: data:; frame-ancestors 'none';`.
  Webmail iframe body renders with `sandbox=""` (no allow-scripts, no allow-same-origin).
- **Cookies**: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, host-locked in
  prod (`Domain=<host>`). CSRF: enforced by `SameSite=Lax` + custom header
  requirement on mutations; sensitive mutations additionally require a
  short-lived signed token.
- **CORS**: strict allowlist — the API accepts only the admin and webmail
  origins per env.
- **Rate limits**: token bucket per IP + per user + per API key, keys layered
  in Redis. Auth endpoints get tighter buckets.

## Authentication

- Session cookies for browser; Bearer API keys (`jm_…`) for programmatic.
- Password hashing: `argon2id(m=64Mi, t=3, p=4)`, `DUMMY_HASH` fallback for
  timing-safe user enumeration defence.
- 2FA: TOTP (RFC 6238) with AES-256-GCM sealed seeds. WebAuthn / Passkey
  added in v1.0 (both authentication and step-up).
- SSO: OIDC + SAML providers registered per org. Just-in-time provisioning
  gated by claim mapping.
- Recovery codes: 10 × 20-char codes hashed with `argon2id`, printed once.

## Authorization

- Layered checks: guard → policy → row-level constraint.
  - Guard verifies session/bearer, sets `principal`.
  - Policy (`orgs.requireRole`) enforces org membership + rank.
  - Row-level: every query filters by `org_id` (SQL) or bucket prefix (storage).
- Postgres RLS (Row Level Security) enabled on every tenant-scoped table in
  v1.0 as belt-and-braces for the query layer. Policies drive off a session
  variable set by the connection pool.
- Data-plane role (`mailplane`): SELECT only on the `mail_*` views. No table
  privileges, ever.

## Data protection

- **At rest**: opt-in disk encryption via LUKS on the box; PG cluster on a
  dedicated encrypted volume when in Kubernetes.
- **In flight**: TLS 1.2+ enforced by config; downgrade attacks blocked at
  the edge.
- **Secrets**: master `ENCRYPTION_KEY` seals TOTP seeds, webhook secrets,
  webmail unlock passwords, SSO provider secrets. HSM / KMS integration is
  v1.1.
- **PII minimisation**: audit rows exclude message bodies and passwords. IP
  addresses are indexed but purged after 180 days per default retention.

## Mail-plane specifics

- **Inbound**: postscreen, rspamd, greylisting on suspect senders, ClamAV
  gate before LMTP.
- **Outbound**: DKIM signing required on every submission; ARC seal for
  forwarded mail; per-org rate limit + IP-warmup daily cap.
- **BIMI / VMC**: DNS entry seeded; VMC upload path guarded to admin only.
- **DANE (TLSA)**: DNS Center support in v1.0 for outbound TLS enforcement
  where the recipient publishes TLSA.

## Webmail specifics

- HTML rendered in a same-origin-null iframe with `sandbox=""`. Body must
  pass a MIME sanity check (nesting depth, part count, size ceiling).
- Remote images blocked by default; user opts in per sender.
- Link tracking disabled unless the user explicitly enables it.
- Attachment execution is off (`Content-Disposition: attachment` forced on
  application/* MIME types); previews are rendered by the sandboxed worker
  pool and served as PNG/PDF, not the raw file.

## API surface hardening

- Every mutation carries an idempotency key when it's dangerous (e.g. sending
  mail, deleting a mailbox). The server dedupes on `(org_id, key)` within a
  24 h window.
- Input validation happens at the boundary with Zod. Un-validated input never
  reaches the domain layer.
- Response headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options:
  DENY` for admin/webmail root; `Referrer-Policy: strict-origin-when-cross-origin`.

## Plugin sandbox

- Server bundle runs in a worker thread with:
  - A capability-based FS shim (only `plugin://` paths writable).
  - No `net.connect`; outbound HTTP goes through a proxy that enforces
    per-plugin allowlists.
  - CPU and memory quotas per plugin.
- Client bundle mounts inside an iframe with a strict CSP; interacts with the
  host via a typed postMessage protocol.
- Signing: manifest + bundle SHAs are signed by the publisher; a
  first-party marketplace verifies signatures.

## Backup security

- Backups encrypted with a per-org key derived from the master key.
- Encryption uses AES-256-GCM chunked; every chunk carries an auth tag.
- Object-lock (WORM) on providers that support it; retention set by the
  backup schedule row.
- Restore requires a passphrase entered at CLI, never stored server-side.

## Audit logging

- Every mutation writes an `audit_logs` row: actor, action, target, meta, ip.
- Log rows are append-only (no update/delete SQL grants for the app role).
- Cryptographic chain: v1.1 adds a per-day Merkle root anchored to a
  transparency log for tamper evidence.

## Disaster recovery

- Nightly backups, weekly restore drill.
- Runbooks: postgres primary loss, redis loss, storage-provider outage,
  cloudflare outage, mail-plane compromise.
- RTO: 4 h for single-node, 30 min for cluster tier.
- RPO: 1 h (last hourly WAL archive) for single-node, 5 min for cluster.

## Security testing

- SAST: `semgrep` custom rules for cross-tenant footguns.
- DAST: OWASP ZAP nightly against a review environment.
- Dependency: `pnpm audit`, Renovate, `trivy image` on every image.
- Fuzzing: `cargo-fuzz`-style tests on the mime parser and the WS protocol.
- Pen test: v1.0 release-gate contracted with an external firm.

## Vulnerability disclosure

- `SECURITY.md` at the repo root: PGP-signed email address, GitHub advisory
  intake, 90-day disclosure window.
- CVE assigner request submitted before v1.0 GA.
