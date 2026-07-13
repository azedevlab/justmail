# Deployment

## Single node (Docker Compose)

The default. See **[[Installation]]**. Good to a few thousand mailboxes on one
well-provisioned box.

## Kubernetes (Helm)

```bash
git clone https://github.com/azedevlab/justmail.git
helm install justmail ./justmail/services/helm/justmail \
  --namespace justmail --create-namespace \
  --values my-values.yaml
```

## Scale-out topology

Split into three tiers that scale independently (full design in
[multi-node.md](https://github.com/azedevlab/justmail/blob/main/docs/multi-node.md)):

- **App tier:** N stateless API/web replicas behind Traefik.
- **Data tier:** PostgreSQL primary + replicas fronted by PgBouncer; Redis
  (single → Cluster). Point `DATABASE_URL` at the writer and
  `DATABASE_READONLY_URL` at a reader.
- **Mail tier:** N Postfix (L4-balanced), a Dovecot **Director** pool routing
  each user to one backend, and Rspamd workers with shared Redis.

## Shared mail storage

Backends: NFSv4, SMB/CIFS, CephFS, or ZFS (or an S3 gateway with local cache).
Set `MAIL_STORAGE_BACKEND` so Dovecot's `mmap_disable` / `mail_fsync` /
`lock_method` are correct, and **always run a Director** so one mailbox is only
served by one backend at a time. Details:
[shared-storage.md](https://github.com/azedevlab/justmail/blob/main/docs/deployment/shared-storage.md).

## Storage & backups

- Move attachments/backups off-box with `STORAGE_KIND` (S3/R2/MinIO/…).
- Migrate between backends online with `justmail storage:migrate`
  (`TARGET_STORAGE_*` env), resumable with a health preflight.
- Backups: `justmail backup` / `justmail restore --backup <id>`.

## Images

Multi-arch (amd64 + arm64) images are built in CI and published to
`ghcr.io/azedevlab/*` on tagged releases.

## Day-2 operations

```bash
justmail status              # service health
justmail logs <service>      # tail logs
justmail upgrade             # pull + rolling redeploy
justmail backup / restore
justmail storage:migrate
```
