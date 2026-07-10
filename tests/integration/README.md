# Integration tests

Testcontainers-backed integration tests. Spin up a real Postgres + Redis
for each test suite so we exercise the SQL layer, RLS policies, and
transactions.

Run locally:

```bash
pnpm -r --filter='./packages/**' build
pnpm --filter @justmail/api build
pnpm --filter @justmail/api test -- --runInBand
```
