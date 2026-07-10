# Changelog

All notable changes to this project are recorded here. This project
follows [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Monorepo skeleton for v1.0: `apps/{admin,webmail,landing,api}` and
  `packages/{contracts,design-tokens,shared-ui,shared-utils,theme-engine,
  storage,plugin-sdk,mail-parser,openapi,eslint-config}`.
- `docs/redesign/` planning suite (requirements, gap analysis, risk,
  scalability, security, architecture, UI/UX, database, API, deployment,
  installation, testing, roadmap).
- License split: AGPL-3.0 for the platform, Apache-2.0 for SDKs and
  contract packages.
- `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.

### Changed
- Squashed the pre-v1.0 development history into a single baseline commit.

### Deprecated
- `apps/legacy-admin` (the v0 single-app UI). Scheduled for removal after
  the v1 admin ships (M2).
- `packages/legacy-types`. Replaced by `packages/contracts`.
