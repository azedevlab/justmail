# Runbook — Redis loss

**Trigger:** Redis pod down, connection refused, or AOF corruption.

## Impact

- Sessions cleared (users must re-login) — minor UX blip.
- Rate-limit counters reset — acceptable.
- BullMQ queued webhook deliveries are rehydrated from
  `webhook_deliveries` on next tick — no data loss.

## Fix

Single-node:

```bash
docker restart justmail-redis-1
# If AOF is corrupt:
docker exec -it justmail-redis-1 redis-check-aof --fix /data/appendonly.aof
```

Kubernetes: the sentinel triggers a failover automatically. If not:

```bash
kubectl -n justmail rollout restart statefulset/redis
```
