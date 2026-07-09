# Scalability

## Load model

Two size envelopes drive design:

| Tier | Mailboxes | Msgs / day (inbound + outbound) | API RPS peak | WS concurrent | Storage / mo |
|---|---|---|---|---|---|
| Single-node | 10 000 | 1 000 000 | 200 | 2 000 | 500 GB |
| Cluster (v1.0) | 100 000 | 20 000 000 | 5 000 | 40 000 | 20 TB |

The cluster tier is the ceiling v1.0 promises. Above that we accept planned
work for v1.1 (multi-region + sharded Postgres).

## Scaling axes

### 1. Postgres (writes are the bottleneck)

- Baseline: one primary + two streaming replicas, PgBouncer transaction pool.
- Writer connections: capped at `4 × cpu` on the primary; PgBouncer
  `default_pool_size=8`, `max_client_conn=2000`.
- Reader routing: dashboard aggregation queries + view reads for the mail
  plane go to replicas via `DATABASE_READONLY_URL`.
- Partitioning: `mail_events`, `audit_logs`, `webhook_deliveries` all use
  `RANGE BY (occurred_at / created_at)` with monthly partitions; a worker
  materialises the next month's partition ten days before it's needed.
- Cold data: partitions older than 12 months move to a cold tablespace on
  cheaper disk (or object storage via pg_partman + a cold-storage extension
  in v1.1).
- Sharding (v1.1 only): tenant-aware `citus` shard by `org_id`. v1.0 accepts
  single-primary scale.

### 2. Redis

- One node with AOF + replica for baseline.
- Migrate to Redis Cluster (6 shards) when BullMQ throughput requires it.
  Keys are hash-tagged by org (`{org:<id>}:...`) so every org's data stays
  on one shard for atomic ops.
- Rate limits use `RedisReply`-friendly Lua scripts.

### 3. Object storage (attachments, thumbnails, backups)

- Content-addressed keys (`sha256(payload)`) enable dedup at the org level.
- Bucket layout: `justmail-<env>/org/<id>/attachments/<hash>` etc.
- CDN in front for downloads; adapter negotiates provider-specific signed
  URL scheme.
- Uploads use the tus.io resumable protocol so a 200 MB attachment on a bad
  hotel wifi survives disconnects.
- Thumbnail worker triggered on `attachment.uploaded` — decoupled from the
  upload path so a slow poppler run never stalls compose.

### 4. Mail plane

- Postfix stateless behind an L4 (HAProxy or GCE NLB) on :25 / :465 / :587.
  Each instance reads `mail_domains`, `mail_mailboxes`, `mail_aliases`,
  `mail_auth`, `mail_sender_login` — all views on the DB replica.
- Dovecot pool fronted by Dovecot Director for session stickiness. Backends
  share `vmail` on NFSv4 (or an S3 gateway).
- Rspamd cluster with shared Redis for fuzzy + bayes; policies fetched from
  a rspamd map file materialised by the control plane.
- ClamAV with signature updates from a central proxy so we don't hammer the
  Cisco mirrors.

### 5. Webmail app + API app

- Both are stateless Next.js standalone builds.
- Autoscale on CPU (target 60%) and on p95 latency (target 300 ms).
- WebSocket termination on the API pods; sticky by connection id.

### 6. Full-text search

- v1.0: Dovecot FTS with Xapian backend, per-mailbox index on the maildir
  volume. Small footprint, no separate service.
- v1.1: optional Meilisearch cluster for cross-mailbox search + admin log
  search + doc site search.

### 7. Search / log aggregation

- Loki for logs; retention 30 days hot + 180 days cold in object storage.
- Prometheus (with mimir once we scale) for metrics; retention 90 days.
- Tempo for traces once we adopt OpenTelemetry (see architecture doc).

## Capacity numbers (worked)

### Postgres

- Row rate: 20 M msgs/day × 6 events avg = 120 M rows/day in `mail_events`.
- Compressed row ~200 B → 24 GB/day → 720 GB/month.
- Monthly partition + BRIN on `occurred_at` keeps query time bounded at ~50 ms
  for last-24h queries even with billion-row tables.
- Audit log volume: ~100 rows per active user per day × 100k users = 10 M/day
  → 3 GB/month. Cheap.

### Redis

- Sessions: hash-per-session, ~1 KB. 100k active users × 3 sessions × 1 KB
  = 300 MB.
- Rate-limit counters: bucket-per-key, 40 M keys hot = ~2 GB.
- BullMQ deliveries: 200k queued × 4 KB = 800 MB.
- Total: comfortably < 10 GB → one shard is fine at cluster tier.

### Object storage

- Deduped attachments: 5 GB / active mailbox / year × 100k = 500 TB raw,
  30% dedup ratio ≈ 350 TB net at cluster tier.
- Store-level lifecycle: warm bucket → cold tier at 90 days, archive at 1
  year.

### Mail plane bandwidth

- p95 message size 60 KB; 20 M/day → 1.2 TB/day inbound egress.
- With 4× outbound multiplier from forwarding = 4.8 TB/day peak — plan a
  10 Gbps uplink at the cluster tier.

## Backpressure and load shedding

- API: 429 on per-tenant rate limit exceeded; header carries `Retry-After`.
- SMTP inbound: `postscreen` → temp-fail (450) when queue depth > threshold.
- SMTP outbound: BullMQ concurrency capped per-org via the warmup schedule.
- WebSocket: send-buffer overflow triggers `close 1013 (try again later)`,
  client backs off.

## Observability budgets

- Every service exposes a `/metrics` endpoint (Prometheus text format).
- SLOs (targets, not promises):
  - Control-plane API availability: 99.9% monthly.
  - Mail-plane inbound accept availability: 99.99% monthly.
  - p99 SMTP accept < 1500 ms.
  - p99 IMAP INBOX select on 10k-mailbox: < 250 ms.
  - p99 API mutation: < 250 ms.
- Error budget burns trigger PagerDuty (or webhook) alerts. Runbooks under
  `docs/runbooks/`.

## Cost model (order of magnitude)

- Single-node tier: fits a 4 vCPU / 16 GB / 500 GB SSD box. ~$60/mo on a
  cheap provider.
- Cluster tier: ~$3-5k/mo depending on storage tier and NFS choice.
- Attachment egress dominates at the cluster tier — R2 or B2 recommended for
  cost, S3 for the SLA.
