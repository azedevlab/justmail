# JustMail v1.0 — redesign

This directory is the pre-implementation plan for the v1.0 open-source target.
Everything already shipped (see `docs/phases/` and the current `main` branch)
is treated as v0 — a working spike that proves the mail plane and the control
plane can co-exist behind a single UI. It stays in the repo but is not the
architecture we're going to open-source; the docs below describe what
replaces it.

## Read order

| # | File | What it answers |
|---|---|---|
| 1 | `01-requirements.md` | What the platform must do, non-goals, target users |
| 2 | `02-gap-analysis.md` | v0 vs v1: what's ready, what's missing, what needs to be redesigned |
| 3 | `03-risk-analysis.md` | The things most likely to break the project, ranked |
| 4 | `04-scalability.md` | Capacity model, sharding, HA topology |
| 5 | `05-security.md` | Threat model, mitigations, must-have controls |
| 6 | `06-architecture.md` | Monorepo layout, services, contracts, data flow |
| 7 | `07-uiux.md` | Design system, screens, states, interactions |
| 8 | `08-database.md` | Schema, indexes, partitions, migrations |
| 9 | `09-api.md` | REST + WebSocket contract, auth, errors, pagination |
| 10 | `10-deployment.md` | Compose (single-node), Helm/K8s (HA), edge topology |
| 11 | `11-installation.md` | Ubuntu installer, prerequisites, SSL, DNS, firewall |
| 12 | `12-testing.md` | Unit / integration / e2e / perf / a11y / security / load |
| 13 | `13-roadmap.md` | Milestone breakdown and stop-line for v1.0 |

## Prime directive

If in doubt during implementation, favour: **scalability > modularity > security > DX > velocity**.
Never trade the first three for the last two.

## Non-goals for v1.0

- Feature parity with Google Workspace (calendar, drive, docs). Calendar is a
  sidecar; the rest is out of scope.
- Being a mailing-list manager. Sympa/Mailman integration is a plugin, not core.
- Being an ISP mail provider. The tenancy model is orgs, not "billions of
  end users on one shared postfix."
- On-device mobile clients. PWA yes, native apps no.

## Non-negotiables

- Zero manual config-file edits for daily operations.
- Every write path has an audit log entry.
- Every user-facing screen has loading / empty / error / offline states.
- Migrations are additive; destructive changes require a backup gate.
- API is versioned (`/v1`, `/v2`); no breaking change without a new prefix.
- No secrets in the repo, in the graph, in tests, or in test fixtures.

## Licensing intent

- AGPL-3.0 for the platform (control plane + webmail + admin).
- Apache-2.0 for the SDKs and plugin protocol (so third-party ecosystems are
  BSD-friendly).
- No AI-tool attribution in commits, `AUTHORS`, `CONTRIBUTORS`, `LICENSE`, or
  release notes. Human placeholders only where a name is required.
