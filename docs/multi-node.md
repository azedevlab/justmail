# Multi-node data plane — design (M4)

The single-node compose stack in `infra/compose/docker-compose.yml` is the demo
and the small-scale target. Once a deployment outgrows one box we split the
stack into three tiers that scale independently. Nothing about the control-plane
API changes: it already reads and writes through the same PostgreSQL views the
mail plane consumes, so the reconciler pattern works verbatim.

## Layout

```
                                ┌──────────────────────┐
                                │       Traefik        │
                                │  (edge, HTTPS/WAF)   │
                                └──────────┬───────────┘
                                           │
                       ┌───────────────────┼───────────────────┐
                       │                   │                   │
                ┌──────▼────────┐   ┌──────▼────────┐   ┌──────▼────────┐
                │  api (n×)     │   │   web (n×)    │   │  webmail (n×) │
                └──────┬────────┘   └──────┬────────┘   └──────┬────────┘
                       │                   │                   │
                       └───────────┬───────┴───────────────────┘
                                   │
                     ┌─────────────▼─────────────┐   ┌──────────────────────┐
                     │      PgBouncer pool       │◄──┤     Redis Cluster    │
                     └─────────────┬─────────────┘   └──────────────────────┘
                                   │
                       ┌───────────▼───────────┐
                       │ Postgres primary + N  │
                       │ replicas (streaming)  │
                       └───────────┬───────────┘
                                   │
                                   │  (mailplane role, SELECT only)
                                   │
                    ┌──────────────┼───────────────┐
                    │              │               │
             ┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
             │ postfix pool││ dovecot pool││   rspamd    │
             └──────┬──────┘└──────┬──────┘└─────────────┘
                    │              │
              ┌─────▼──────────────▼──────┐
              │  shared maildir (NFSv4 or │
              │  S3 gateway with cache)   │
              └───────────────────────────┘
```

## Sizing rules of thumb

| Tier | Scaling signal | Notes |
|------|----------------|-------|
| API + web | 70% CPU sustained | Stateless — HPA against a load balancer |
| Postgres | 40% CPU on primary, WAL replay lag on replicas | Reads route to replicas via PgBouncer selectors |
| Redis | 60% memory | BullMQ + rate limits; cluster once we outgrow ~8 GB |
| Postfix | Queue length > 500 for > 5 min | Deferred flushed by RRDNS + relay pool |
| Dovecot | IMAP concurrency > 70% of imap-login worker cap | Session stickiness via director or L4 hashing |
| Storage | 70% quota consumed | Grow maildir volume online; ownership stays on the FS |

## Postgres

- **Primary + 2 replicas** as the baseline. Use `pg_auto_failover` or Patroni
  for automated promotion.
- **PgBouncer** in `transaction` mode fronts every DB client. Downstream
  services always use the pool, never the DB directly.
- Split roles by prefix in `.env`: `DATABASE_URL` (writer) and
  `DATABASE_READONLY_URL` (reader). API uses writer for mutations, reader for
  dashboard aggregation.
- Backups: the existing `infra/scripts/backup.sh` still targets the pool; add a
  per-replica `pg_basebackup` snapshot on a weekly cadence to a warm-standby
  bucket.

## Redis

- Start with a single node + AOF + replica. Migrate to Redis Cluster when
  BullMQ throughput requires it — no code changes; BullMQ v5 supports cluster.
- Keep the webhook queue and the rate-limit keys on different logical DBs.

## Shared maildir

The trickiest part. Two supported options:

1. **NFSv4** — cheapest, requires a beefy NFS box (or a managed EFS). Enable
   `no_wdelay,actimeo=0` so LMTP writes are visible to IMAP readers within
   milliseconds. Downside: NFS becomes a SPoF; mitigate with redundant heads.

2. **S3 gateway with local cache** — `rclone mount --vfs-cache-mode full` or a
   commercial gateway (JuiceFS, Weka). Cheaper at scale, higher latency; okay
   for IMAP if the working set fits in the local cache.

Per-filesystem Dovecot index/lock tuning (NFS/SMB/CephFS/ZFS) is documented in
[deployment/shared-storage.md](deployment/shared-storage.md) and driven by the
`MAIL_STORAGE_BACKEND` env var.

Either way: **one maildir per user, per shard**. If a mailbox moves shards we
rsync the maildir with the user suspended (a five-second UX hiccup) — the
plane's suspend flag is designed for exactly this.

## Postfix pool

- N stateless `postfix` containers behind an HAProxy TCP L4 load balancer on
  :25, :465, :587. Each Postfix instance shares the same `dkim-keys` volume
  and reads its lookup tables from the PG views — no host-specific config.
- Outbound DKIM signing is stateless because keys are read from the shared
  volume. Rotate keys via the existing `dkim.generate` → `dkim.activate` flow.
- Queue is per-instance. Deferred mail migrates on postfix restart via the
  `flush_service`; we don't try to share queues.

## Dovecot pool

- Dovecot Director on the frontend routes each user to a specific backend so
  IMAP caches (index files) stay warm.
- Backend instances share the same PG `mail_auth` view and the same maildir
  mount. Nothing about the auth surface changes.

## Rspamd

- Rspamd is compute-heavy. Deploy N stateless workers, one shared Redis for
  fuzzy state and bayes. GreyLister lives in Redis so it's cluster-safe.

## Deployment

- We stay on Docker Compose for the demo. For multi-node the intent is a Helm
  chart that mirrors the compose file 1:1 (chart in `infra/helm/justmail`,
  planned). K3s is the default target.
- Zero-downtime deploys: rolling `api`/`web` on the load balancer; blue/green
  the postfix pool because clients care about SMTP connections mid-transaction.

## Open items

- Formal SLOs (envelope latency, queue backlog, IMAP read latency)
- SIEM integration (Loki queries are the current signal, not enough for large
  fleets)
- Postscreen / postwhite tuning tables shared across the postfix pool
