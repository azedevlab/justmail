# Contributing to JustMail

Thanks for your interest. This project is only useful because people like
you file issues, review PRs, and ship code.

## Ground rules

- **Read** [`docs/redesign/`](docs/redesign/) before proposing structural
  changes. Most "why is it this way?" questions are answered there.
- Be kind. The [Contributor Covenant](https://www.contributor-covenant.org/)
  applies.
- Keep pull requests focused. One concern per PR.
- Every PR must be signed off (Developer Certificate of Origin — DCO):
  ```
  Signed-off-by: Your Name <you@example.com>
  ```
  `git commit -s` adds this automatically.

## Getting started

Requirements:

- Node.js 22+
- pnpm 10.12+
- Docker + Compose plugin
- (optional) a local Postgres 17 and Redis 7 if you don't want to use
  the compose stack

```bash
git clone https://github.com/justmaildev/justmail
cd justmail
pnpm install
pnpm dev
```

`pnpm dev` starts the API, all three web apps, Postgres, Redis, and the
mail plane. Hot reload is on for apps and packages.

## What to work on

- Look for issues labelled [`good first issue`](https://github.com/justmaildev/justmail/issues?q=label%3A%22good+first+issue%22).
- The [`docs/redesign/13-roadmap.md`](docs/redesign/13-roadmap.md) lists
  milestones. Milestones with open placeholder issues welcome contributors.
- If you want to build a plugin, see
  [`docs/plugin-development.md`](docs/plugin-development.md).
- If you want to translate the UI, see
  [`docs/localization.md`](docs/localization.md).

## Development conventions

- **TypeScript strict, `noUncheckedIndexedAccess: true`.** Explicit types on
  every exported symbol.
- **Zod at every boundary.** Contract types live in
  `packages/contracts/`; never hand-write a network shape.
- **No cross-module SQL.** Modules talk through services.
- **Migrations are additive.** Destructive changes need a separate
  migration and `--allow-destructive` at install time.
- **Every write path emits an event** through the `EventBus`. Auditability
  is a hard requirement.
- **Every UI screen ships loading / empty / error / offline states** plus
  a Storybook story for its primary component.
- **Every feature ships tests.** Unit + integration + one e2e happy-path.

## Commit style

We use conventional commits with lower-case scopes:

```
feat(api): add /v1/orgs/:id/backups:run
fix(webmail): repair snooze race when message moves folders
docs(runbooks): add mail-blocked runbook
```

Please write commit *bodies* explaining the *why*, not the *what*.

## Reviewing

- Review the tests first, then the code.
- Ask if you're not sure. There are no stupid questions in reviews.
- Small "chore(polish)" follow-ups are welcome instead of requesting
  changes in the original PR.

## Release process

Releases are managed via [changesets](https://github.com/changesets/changesets):

- `pnpm changeset` at PR time to record the intended version bump.
- A `chore(release)` PR aggregates changesets and lands the version bump.
- Tags and container images build automatically on merge.

## Legal

- Contributions are licensed under the same terms as the repository
  (AGPL-3.0 for the platform, Apache-2.0 for the SDK/contract packages).
- No AI-generated attribution or fake contributor names in commits, PR
  descriptions, or `AUTHORS`. Use your name and email.
