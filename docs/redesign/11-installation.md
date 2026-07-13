# Installation guide (v1.0)

Three supported install paths — Ubuntu single-node, Docker Compose,
Kubernetes. Windows and macOS are dev-only.

## Prerequisites (all paths)

- A Linux server with **≥ 4 vCPU, 16 GB RAM, 200 GB SSD**.
- A public IP with reverse DNS (`PTR`) set to the mail hostname (`mail.<domain>`).
  Without this many providers reject your mail.
- Ability to open ports:
  - 25 (SMTP, inbound)
  - 80, 443 (HTTPS, inbound)
  - 465 (SMTPS submission), 587 (submission, TLS)
  - 993 (IMAPS), 995 (POP3S), 4190 (managesieve)
  - 22 (SSH, admin only)
- A domain you control, with DNS at Cloudflare (or another supported provider).
- (Optional) An object storage bucket (S3/R2/MinIO/etc.) for backups + attachments.

Some cloud providers block outbound 25 by default. Use JustMail's
`OUTBOUND_MODE=smarthost` and point at a relay in that case.

## Path A — Ubuntu single-node (the one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/azedevlab/justmail/main/scripts/install.sh | sudo bash
```

The installer:

1. Verifies prerequisites (RAM, disk, ports, PTR).
2. Installs Docker + Docker Compose plugin.
3. Creates the `justmail` user, `/opt/justmail/{app,backups,attachments}`.
4. Fetches the release tarball with checksum verification.
5. Generates secrets and writes `/opt/justmail/.env` (chmod 600).
6. Prompts for domain, admin email, DNS provider token, and object-storage
   destination (skip = local FS).
7. Runs `justmail install` which:
   - Starts the `core`, `certs`, `mail`, `obs`, `sec`, `app` compose profiles.
   - Waits for LE cert issuance.
   - Boots API, runs migrations, seeds the initial admin.
   - Prints the admin console URL and initial credentials.

Idempotent: re-running the installer re-verifies state and repairs drift.

## Path B — Docker Compose (manual)

```bash
git clone https://github.com/azedevlab/justmail
cd justmail/services/compose
cp .env.example .env       # edit secrets, hostnames, storage, DNS provider
docker compose --profile core --profile certs --profile mail \
               --profile obs --profile sec --profile app up -d
```

Post-install:

```bash
justmail bootstrap --email you@example.com     # creates the initial owner
justmail status                                # health snapshot
```

## Path C — Kubernetes (HA)

```bash
git clone https://github.com/azedevlab/justmail.git

helm install justmail ./justmail/services/helm/justmail \
  --namespace justmail --create-namespace \
  --values values.yaml
```

Minimum `values.yaml`:

```yaml
domain: mail.example.com
adminEmail: postmaster@example.com

storage:
  kind: s3
  s3:
    endpoint: https://s3.us-east-1.amazonaws.com
    bucket: justmail-prod
    region: us-east-1
    existingSecret: justmail-s3

postgres:
  operator: zalando           # or "pgo", "external"
  size: 100Gi

dns:
  provider: cloudflare
  existingSecret: justmail-cf

certManager:
  enabled: true
  clusterIssuer: letsencrypt

ingress:
  className: nginx
```

Chart docs at `services/helm/justmail/README.md`.

## Path D — Terraform one-click (AWS example)

```hcl
module "justmail" {
  source  = "azedevlab/justmail/aws"
  version = "1.0.0"

  domain          = "mail.example.com"
  admin_email     = "postmaster@example.com"
  vpc_id          = module.network.vpc_id
  private_subnets = module.network.private_subnets
  public_subnets  = module.network.public_subnets

  db_instance_class    = "db.t4g.medium"
  redis_node_type      = "cache.t4g.micro"
  attachments_bucket   = "justmail-prod-attachments"
  dns_zone_id          = data.aws_route53_zone.this.zone_id
}
```

`terraform apply` returns the admin URL and initial credentials.

## DNS setup

The installer seeds these records at your DNS provider (Cloudflare shown):

| Type | Name | Value | Notes |
|---|---|---|---|
| A | `mail.<domain>` | `<public ip>` | Mail plane host |
| A | `<domain>` | `<public ip>` | Web app |
| A | `api.<domain>` | `<public ip>` | API + WS |
| A | `webmail.<domain>` | `<public ip>` | End-user webmail |
| A | `admin.<domain>` | `<public ip>` | Control plane console |
| A | `caldav.<domain>` | `<public ip>` | CalDAV/CardDAV |
| MX | `<domain>` | `10 mail.<domain>.` | Primary MX |
| TXT | `<domain>` | `v=spf1 mx include:mail.<domain> ~all` | SPF |
| TXT | `_dmarc.<domain>` | `v=DMARC1; p=quarantine; rua=…` | DMARC |
| TXT | `_mta-sts.<domain>` | `v=STSv1; id=<token>` | MTA-STS |
| TXT | `_smtp._tls.<domain>` | `v=TLSRPTv1; rua=…` | TLS-RPT |
| TXT | `<selector>._domainkey.<domain>` | `v=DKIM1; k=rsa; p=…` | DKIM |
| TXT | `default._bimi.<domain>` | `v=BIMI1; l=…; a=…` | BIMI |
| TXT | `_justmail-verify.<domain>` | `justmail-verify=<token>` | Ownership |
| CAA | `<domain>` | `0 issue "letsencrypt.org"` | CA lockdown |

The DNS Center screen ("Sync to provider" button) upserts these
idempotently and shows drift when someone edits at the provider.

## PTR record

Ask your VPS or cloud provider to set the PTR of your public IP to
`mail.<domain>`. This is the single most common cause of soft-blocking at
Gmail/Outlook.

## Firewall

Ubuntu (ufw):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 25/tcp    # SMTP
sudo ufw allow 465/tcp   # SMTPS
sudo ufw allow 587/tcp   # Submission
sudo ufw allow 993/tcp   # IMAPS
sudo ufw allow 995/tcp   # POP3S
sudo ufw allow 4190/tcp  # ManageSieve
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Docker rewrites iptables. Use `ufw-docker` or the compose network's
`published: false` mode for services that shouldn't be public.

## SSL

- Traefik requests certs via ACME DNS-01 through the configured DNS
  provider. No HTTP challenge needed.
- Mail-plane certs are issued by the certd container using acme.sh with
  DNS-01. Files land in the `certs` volume; Postfix and Dovecot are
  reloaded on change via a checksum watcher.
- Both resolvers (LE + ZeroSSL) tried in order.

## Backups

- Nightly `justmail backup` runs a full backup and posts to the configured
  destination.
- The destination can be a local path, an S3-compatible URL, Azure, or GCS.
- Restore: `justmail restore --backup <id>` restores DB and vmail to a
  scratch prefix; a second command confirms and swaps.

## Upgrade

```bash
justmail upgrade                              # in-place
justmail upgrade --to 1.1.0                   # target version
justmail upgrade --dry-run                    # print plan
```

The upgrade tool:

1. Checks target version compat + changelog for breaking changes.
2. Runs a snapshot backup and records the id.
3. Applies non-destructive migrations.
4. Rolling-restarts services.
5. Runs post-migration checks; rolls back on failure.

Destructive migrations require `--allow-destructive`.

## Migration from another system

Adapters ship for:

- **iRedMail** → `justmail migrate iredmail --from <psql-uri>`
- **Mailcow** → `justmail migrate mailcow --from <docker-host>`
- **Postfixadmin** → `justmail migrate postfixadmin --from <sql-dump>`

Adapters do a dry-run diff, then a live sync in idle mode. Passwords
migrate as-is when hashes are compatible (BCrypt, ARGON2ID); users are
sent a "please reset" flow otherwise.

## Troubleshooting first steps

```bash
justmail status                # what's up, what isn't
justmail logs api              # tail api logs
justmail logs postfix          # tail mail logs
justmail exec dovecot          # get a shell in the container
justmail health --deep         # DNS, TLS, MX, SPF/DKIM/DMARC checks
```

Runbooks under `docs/runbooks/`:
- `dns-drift.md`
- `mail-blocked.md`
- `postgres-failover.md`
- `redis-loss.md`
- `certificate-issuance.md`
- `queue-flood.md`

## Recovery

- Lost admin password → `justmail admin reset-password <email>` (requires
  local shell).
- Lost 2FA → `justmail admin disable-2fa <email>`.
- Corrupt maildir for one mailbox → `justmail mailbox rebuild <address>`
  (walks the last-good snapshot; requires backups enabled).

## Disaster recovery

Full documented in `docs/runbooks/disaster-recovery.md`. High points:

1. New host, run installer.
2. `justmail restore --backup s3://…/db-<date>.dump` — restores DB.
3. `justmail restore --backup s3://…/vmail-<date>.tar.zst` — restores maildir.
4. `justmail restore --backup s3://…/attachments-<date>` — restores
   attachments (no-op if the same storage bucket is reachable).
5. Update DNS `A` records to new IP.
6. Wait for TLS re-issue (≤ 5 min on Cloudflare DNS-01).
7. `justmail health --deep` — final gate.
