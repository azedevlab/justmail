# Testing strategy

## Test pyramid

- **Unit** (fast, many): pure functions, Zod validators, formatters,
  parsers, adapters (with fakes). Target 80% line + 70% branch coverage
  on `packages/*` and services within `apps/api`.
- **Integration**: Nest modules against real Postgres + Redis in
  Testcontainers. Verify SQL, RLS, transactions, queues.
- **Contract**: OpenAPI conformance — every controller's Zod schema
  matches the generated spec; SDK examples type-check.
- **E2E**: Playwright drives admin + webmail against a full compose stack.
- **Performance**: k6 for the API and WebSocket; Lighthouse CI for web
  bundles.
- **Accessibility**: axe-core in Playwright and CI; per-screen budget.
- **Security**: SAST (semgrep), DAST (ZAP), dependency (npm audit,
  Renovate), container (trivy), MIME fuzzer, WS fuzzer.
- **Load / soak**: 24 h soak in staging; smtp-source floods on the mail
  plane; k6 sustained load on the API and WS.

## Tooling

| Layer | Runner | Notes |
|---|---|---|
| Unit | Vitest | Coverage via c8, threshold gates in CI |
| Integration | Vitest + Testcontainers | PG 17, Redis 7 |
| Contract | Vitest | Feeds generated OpenAPI into a validator |
| E2E | Playwright | Headed local, sharded in CI |
| Perf (API) | k6 | grafana-k6 output to Loki |
| Perf (Web) | Lighthouse CI | budgets committed |
| A11y | axe-core + pa11y | budgets per screen |
| Security | semgrep, ZAP, trivy | ZAP baseline scan nightly |
| Load | smtp-source, k6 | soak in staging |

## Directory layout

```
tests/
├─ unit/                       (co-located next to source: *.test.ts)
├─ integration/
│  ├─ auth.test.ts
│  ├─ orgs.test.ts
│  ├─ mailboxes.test.ts
│  ├─ dkim.test.ts
│  └─ storage/
│     ├─ s3.test.ts
│     └─ local.test.ts
├─ e2e/
│  ├─ admin/
│  ├─ webmail/
│  └─ shared/
├─ perf/
│  ├─ api-mutation.k6.js
│  └─ ws-broadcast.k6.js
├─ security/
│  ├─ mime-fuzz.test.ts
│  └─ ws-fuzz.test.ts
└─ load/
   ├─ smtp-flood.sh
   └─ mailbox-seed.ts
```

## CI matrix

- Job A: `pnpm lint` + `pnpm typecheck` + `pnpm build`. Blocks other jobs
  from starting on failure.
- Job B: unit tests, per package, in parallel.
- Job C: integration tests, sharded 4-way with Testcontainers.
- Job D: contract tests + OpenAPI diff (blocks if `openapi.json` diverges
  from generated).
- Job E: e2e tests, sharded 4-way, running against a compose stack built
  from the current SHA.
- Job F: axe + Lighthouse budgets against a preview URL.
- Job G: semgrep + trivy + npm audit.
- Job H (nightly): k6 perf, ZAP DAST, smtp-source soak, DKIM/SPF live
  test against mail-tester.

Merges to `main` require all jobs green.

## Coverage gates

- 80% line, 70% branch on `packages/*` and `apps/api/src`.
- 60% line on `apps/admin` and `apps/webmail` (many React screens are
  visual — e2e provides safety).
- No coverage gate on `apps/landing` (static content).
- Coverage report published to the preview URL and PR comment.

## Fixture strategy

- **Deterministic**: seeds fixed per test run; `faker.seed(TEST_SEED)`.
- **Snapshot policy**: only for stable, human-inspectable output (e.g.
  DNS record content, MIME builder output). Never for HTML/CSS rendered
  from styles that can change per token.
- **Data volumes**: `mailbox-seed.ts` produces 10k, 100k, 1M mailbox
  fixtures for performance tests.

## Performance budgets

Admin app bundle:
- Initial JS transferred < 200 KB (gzipped).
- First Contentful Paint < 1 s on Fast 3G.
- Time to Interactive < 2.5 s on Fast 3G.
- Cumulative Layout Shift < 0.1.

Webmail app bundle:
- Initial JS < 220 KB gzipped.
- LCP < 1.5 s on Fast 3G.
- p95 message-open latency < 300 ms on a 10k mailbox.

API budgets (p95):
- Health: 50 ms.
- Read mutation: 100 ms.
- Write mutation: 250 ms.
- Search: 500 ms.
- WS event publish → client: 100 ms.

Mail plane (measured over 24h soak):
- SMTP accept: p95 < 100 ms.
- IMAP INBOX SELECT: p95 < 250 ms on 10k msgs.
- LMTP delivery: p95 < 200 ms.
- Rspamd score compute: p95 < 400 ms.

## Accessibility budget

- axe: zero critical, zero serious. Moderate/minor tracked in issues.
- Keyboard: every action reachable, verified by Playwright macros.
- Screen reader smoke: manual per release across NVDA/VoiceOver/JAWS.
- Contrast: enforced by design tokens (build-time check against WCAG AA).

## Security tests

- MIME fuzz: seed corpus + generated deep-nested, malformed messages.
- WS protocol fuzz: random ops + malformed payloads, assert no panic.
- Cross-tenant attack: try to read another org's mailbox/attachment with
  every principal type, assert 403/404.
- Path traversal on storage: try `..`, absolute paths, URL-encoded
  variants.
- Session fixation: verify session id rotates on privilege change.
- CSRF: mutation with wrong Origin/no header, assert 403.
- HTML email XSS: corpus of ~200 crafted messages, assert none escape.

## Deliverability tests

- Weekly automated send to `check-auth@verifier.port25.com`; parse the
  reply; alert on regression.
- mail-tester.com run nightly against staging.
- DNSBL check across the same list configured in the app.

## Load tests

- k6 API: linear ramp to 5k RPS on `POST /v1/webhooks/replay` with
  Idempotency-Key. Fail run if p95 > 300 ms or error > 1%.
- k6 WS: 40k concurrent sockets subscribing + receiving 10 events/sec/each.
- SMTP: `smtp-source -s 200 -l 10240` for 30 min; assert no queue
  overflow, no rejects that shouldn't be.

## Flake budget

- Any test flaking > 1% is quarantined within 24 h; a fix is triaged
  within a week or the test is deleted.
- CI reruns are permitted once for known-flaky suites (only e2e), never
  for unit/integration.

## Manual QA checklist (release-gate)

- Full install on a fresh Ubuntu VM (Path A) and Compose (Path B).
- Backup + restore drill using the CI-produced backup.
- Send-and-receive across all supported edge routes (STARTTLS, direct,
  smarthost).
- 2FA + Passkey login flow.
- Screen-reader walkthrough on admin dashboard and webmail INBOX.
