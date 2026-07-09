# Phase 1 — Research

## 1. The problem space

Self-hosted mail in 2026 is a two-sided failure:

- **The mail stacks are good, the products are bad.** Postfix, Dovecot and Rspamd are
  battle-tested and run most of the internet's independent mail. But every product built
  on them (Mailcow, Mailu, iRedMail, Poste.io) ships an admin UI that feels like 2012:
  server-rendered tables, no realtime, no API-first design, config edits still required
  for anything non-trivial.
- **The good UX is proprietary.** Google Workspace and Microsoft 365 admin consoles,
  Fastmail's settings, Proton's onboarding — none of it exists in self-hostable form.

**JustMail's thesis:** the mail data plane is a commodity; the product is the
*control plane* — provisioning, DNS, deliverability, observability, and security —
delivered with the UX quality of Vercel/Stripe/Linear.

## 2. Competitive landscape

| Product | Stack | Strengths | Weaknesses we exploit |
|---|---|---|---|
| **Mailcow** | Postfix/Dovecot/Rspamd/SOGo, Docker, MySQL | Complete, active community, good Rspamd integration | PHP admin UI, no design system, weak API, no DNS automation, single-tenant mindset |
| **Mailu** | Postfix/Dovecot/Rspamd, Docker, Flask | Simple, lightweight | Minimal admin features, basic UI, limited observability |
| **iRedMail** | Postfix/Dovecot/Amavis or Rspamd | Mature | Installer-script model (not container-native), paid admin panel (iRedAdmin-Pro), dated UX |
| **Poste.io** | Haraka/Dovecot, single container | Easiest setup | Closed-source core, single-container = poor isolation, freemium wall |
| **Stalwart** | All-in-one Rust server (JMAP/IMAP/SMTP) | Modern codebase, JMAP-native, built-in web admin | Young ecosystem, monolith data plane, admin UI is functional not premium; less operational track record than Postfix |
| **Modoboa** | Postfix/Dovecot, Django | Decent admin panel | Aging UI, weak realtime/monitoring |
| **Google Workspace / M365** | Proprietary | The UX + deliverability benchmark | Not self-hostable, per-seat pricing, data sovereignty |

### What we copy from each

- **Mailcow** → the proven data-plane composition (Postfix + Dovecot + Rspamd + ClamAV,
  SQL lookup maps, per-service containers).
- **Google Admin** → domain-centric onboarding: add domain → guided DNS verification →
  green checkmarks per record.
- **Vercel** → the deploy/health mental model: every domain has a status, every change is
  observable, DNS "just works" via provider API.
- **Stripe** → data-dense dashboards that stay readable; excellent tables; API-first with
  generated SDK and a real developer portal.
- **Linear** → command palette, keyboard-first navigation, speed as a feature.
- **Fastmail/Proton** → mail UX details for the later webmail milestone (conversation
  threading, undo send, scheduled send).

## 3. Deliverability — the non-negotiables

A mail platform lives or dies by deliverability. These must be first-class product
features, not documentation:

| Requirement | What it is | JustMail feature |
|---|---|---|
| **PTR / FCrDNS** | Reverse DNS matching HELO name | Setup checklist item; health checker validates forward-confirmed rDNS |
| **SPF** | TXT authorizing sending IPs | Auto-created via Cloudflare API |
| **DKIM** | Cryptographic signing (Rspamd) | Keys auto-generated per domain, published via API, one-click rotation |
| **DMARC** | Policy + reporting | Auto-created; aggregate (rua) report ingestion → dashboard |
| **MTA-STS + TLS-RPT** | Enforced inbound TLS + reporting | Auto-hosted policy file + DNS records |
| **DANE/TLSA** | DNSSEC-bound cert pinning | Supported when DNSSEC available; health checker validates |
| **BIMI** | Brand logo in inboxes | Record generation (VMC optional) |
| **IP warmup** | Gradual volume ramp for new IPs | Outbound rate shaping + warmup schedule (later milestone) |
| **Blocklist monitoring** | Spamhaus/Barracuda listings | Scheduled DNSBL checks → alerts |

**AWS-specific constraints (our target server):**
- Outbound port 25 blocked by default → account-level removal request required (form:
  "Request to remove email sending limitations"), including Elastic IP + rDNS assignment.
- EC2 IP reputation is mediocre out of the box → warmup + monitoring matter more.
- PTR is managed by AWS (via the same form), *not* Cloudflare — the DNS Center must
  treat PTR as "external, verified" rather than "managed".

## 4. Technical insights that drive the architecture

1. **SQL lookup maps eliminate config editing.** Postfix (`pgsql:` maps) and Dovecot
   (SQL auth/userdb) can query PostgreSQL directly. Creating a mailbox = one DB insert,
   effective immediately, zero reloads. This single decision delivers the "never edit a
   config file" requirement.
2. **Rspamd replaces OpenDKIM + OpenDMARC + policyd.** It handles DKIM signing/verify,
   DMARC evaluation, rate limiting, greylisting, and antivirus glue (ClamAV) with a
   built-in HTTP API — one integration point instead of four daemons. (Decision recorded:
   Rspamd-only.)
3. **Postfix logs are the event source of truth.** Parsing the Postfix/Dovecot log stream
   (via a log shipper) into structured events gives us: live mail flow, per-message
   tracing, bounce tracking, and queue analytics — without patching the MTA.
4. **Desired-state reconciliation beats imperative config.** The API writes desired state
   to Postgres; a reconciler ensures DNS (Cloudflare), DKIM keys, certs, and container
   config match. Same model as Kubernetes/Vercel; enables "one-click DNS repair" and drift
   detection for free.
5. **JMAP is not worth data-plane risk today.** IMAP/SMTP + our own REST/WS API covers
   the admin platform and future webmail. Revisit JMAP (or Stalwart as an alternative
   backend) post-M3.
6. **Multi-tenancy from day one, single-node first.** Schema is org-scoped from the first
   migration (orgs → domains → mailboxes); scaling to multiple MTA nodes later is a
   deployment concern, not a schema rewrite.

## 5. Open-source / commercial split (working assumption)

- **Open core:** everything in Milestones 1–3 (mail stack, admin, DNS, monitoring, webmail).
- **Commercial candidates:** SSO/SAML, LDAP/AD sync, multi-node clustering, advanced
  compliance (archiving/eDiscovery), white-label branding, hosted control plane.

## 6. Risks

| Risk | Mitigation |
|---|---|
| AWS port-25 request denied/slow | Platform fully testable receive-side + via submission relay; SES smarthost fallback switchable in Settings |
| Deliverability of fresh EC2 IP | Warmup tooling, blocklist monitor, DMARC report ingestion from day one |
| Scope explosion (spec is ~6 products) | Strict milestone gates (Phase 9); M1 = core platform only |
| Data-plane containers (Postfix/Dovecot) misconfiguration | Golden config templates, integration tests with real SMTP/IMAP sessions in CI |
