# Runbook — Postgres primary failover

**Trigger:** Alert `PostgresPrimaryDown` or the API returns 503 from `/healthz`
because `SELECT 1` fails.

## Single-node install

- Postgres is not HA on single-node. Restore from backup:
  `justmail restore --backup <latest>`
- If the box is compromised, follow `disaster-recovery.md` instead.

## Kubernetes install (Zalando operator)

1. Confirm the primary pod state: `kubectl -n justmail get postgresql`.
2. The operator promotes a replica automatically when it observes the
   primary as `Down`. This can take up to 60 seconds.
3. Verify the new primary: `kubectl -n justmail get pod -l spilo-role=master`.
4. `api` pods will reconnect via PgBouncer once the writer endpoint updates.

## Manual failover

If the operator does not promote a replica:

```bash
kubectl -n justmail exec -it <replica> -- \
  patronictl failover --candidate <new-primary>
```

## Aftermath

- Verify replication is caught up on remaining replicas.
- Rotate the compromised primary volume before re-adding it as a replica.
- Post-mortem within 24 hours; update this runbook with anything learned.
