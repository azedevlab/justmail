# Configuration

JustMail is configured entirely through environment variables. Copy
`services/compose/.env.example` to `.env`, keep it `chmod 600`, and set the
values below. Generate the app secrets with `openssl rand -hex 32`.

## Hostnames

| Variable | Purpose |
|----------|---------|
| `JM_DOMAIN` | Primary domain |
| `JM_ADMIN_HOST` / `JM_WEBMAIL_HOST` / `JM_API_HOST` | App hostnames |
| `MAIL_HOSTNAME` / `JM_HOSTNAME` | Mail server FQDN (must have PTR) |
| `ACME_EMAIL` | Contact for Let's Encrypt |

## Datastores

| Variable | Purpose |
|----------|---------|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Primary database |
| `MAILPLANE_DB_PASSWORD` | Read-only role used by the mail plane |
| `REDIS_PASSWORD` | Cache/queue auth |

### Database HA (optional)

`DATABASE_URL` (writer) and `DATABASE_READONLY_URL` (reader/replica);
`DATABASE_POOL_MAX`, `DATABASE_POOL_IDLE_TIMEOUT_MS`,
`DATABASE_CONNECT_TIMEOUT_MS`, `DATABASE_SSL`,
`DATABASE_SSL_REJECT_UNAUTHORIZED`.

### Cache HA (optional)

Standalone via URL, or `REDIS_SENTINELS` + `REDIS_SENTINEL_NAME`, or
`REDIS_CLUSTER_NODES`; plus `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`,
`REDIS_TLS_REJECT_UNAUTHORIZED`.

## App secrets

| Variable | Purpose |
|----------|---------|
| `ENCRYPTION_KEY` | Encrypts stored credentials |
| `EVENTS_INGEST_TOKEN` | Guards the internal events ingest |

## DNS provider

```dotenv
DNS_PROVIDER=cloudflare      # or desec
CLOUDFLARE_API_TOKEN=…
CLOUDFLARE_ACCOUNT_ID=…
# DESEC_TOKEN=…              # when DNS_PROVIDER=desec
```

Publishing reconciles records by identity — it updates the record that is
genuinely yours, never overwrites an unrelated TXT (e.g. a site-verification),
and deletes duplicate SPF/DKIM/DMARC so checks go green.

## Object storage

```dotenv
STORAGE_KIND=local            # local|nfs|smb|cephfs|zfs|s3|r2|minio|b2|wasabi|do|scaleway|ceph|azure|gcs
STORAGE_LOCAL_PATH=/opt/justmail/attachments
# S3-flavoured:
# STORAGE_BUCKET=…  STORAGE_REGION=…  STORAGE_ENDPOINT=…  STORAGE_ACCESS_KEY=…  STORAGE_SECRET_KEY=…
# Azure: AZURE_CONNECTION_STRING=…   GCS: GCS_PROJECT_ID=… GCS_KEY_FILENAME=…
```

## Distributed mail storage

When the mail volume is on a network/clustered filesystem, set
`MAIL_STORAGE_BACKEND` (`local|nfs|smb|cephfs|zfs`) so Dovecot's index/lock
settings are tuned correctly. See
[shared-storage.md](https://github.com/azedevlab/justmail/blob/main/docs/deployment/shared-storage.md).

## Optional features

- **Antivirus:** `CLAMAV_ENABLED` (outbound attachment scanning).
- **Thumbnails:** `THUMBNAIL_ENABLED`.
- **Web Push:** `WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY`.
- **SSO:** `SSO_CALLBACK_BASE_URL`, `SSO_DEFAULT_RELAY_URL` (providers set per-org
  in the console).
- **Passkeys:** `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGINS`.

## Generate a full sample

```bash
pnpm --filter @justmail/api config:sample   # regenerates apps/api/.env.example from the schema
```
