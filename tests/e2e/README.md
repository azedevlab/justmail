# End-to-end tests

Playwright specs that drive `apps/admin` and `apps/webmail` against a
compose stack built from the current SHA.

Run locally:

```bash
pnpm --filter @justmail/api build
docker compose -f services/compose/docker-compose.yml \
  --profile core --profile mail --profile app up -d
pnpm exec playwright install --with-deps
pnpm exec playwright test
```

## Coverage targets

- Admin: bootstrap, login, add domain, add mailbox, add alias, invite user,
  add API key, add webhook, view queue, view backups, view deliverability.
- Webmail: unlock, folders, list, open, reply, snooze, delete.
- Cross-app: shared session cookie, WebSocket subscription, notification.

## Files

- `admin.spec.ts` — admin happy paths.
- `webmail.spec.ts` — webmail happy paths.
- `security.spec.ts` — cross-tenant access probes.
