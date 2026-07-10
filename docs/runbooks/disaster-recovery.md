# Runbook — Disaster recovery

**Trigger:** Complete host loss, region outage, or you're rebuilding after a
security incident.

## Prerequisites

- Latest backup accessible from your object store.
- DNS zone still under your control.
- Fresh Ubuntu 24.04+ box with the required ports open.

## Steps

1. **Bootstrap the new host.**
   ```bash
   curl -fsSL https://get.justmail.dev | sudo bash
   ```
   Edit `/opt/justmail/.env` with the same secrets as the old install (use
   your secret manager, not the old plaintext file — always assume it may
   be compromised).

2. **Restore Postgres.**
   ```bash
   justmail restore --backup s3://backups-prod/justmail/db/db-<date>.dump
   ```

3. **Restore maildir.**
   ```bash
   justmail restore --backup s3://backups-prod/justmail/vmail/vmail-<date>.tar.zst
   ```

4. **Restore attachments.**
   - If the storage bucket is unchanged, no action.
   - If migrating buckets, `justmail restore --backup s3://…/attachments-<date>`.

5. **Update DNS.**
   - Point A records for `mail`, `admin`, `webmail`, `api`, and any hosted
     tenant domains at the new IP.
   - PTR: ask your cloud provider to set the reverse DNS.

6. **Wait for TLS.**
   - Traefik + certd re-issue certs via DNS-01. ≤ 5 minutes on Cloudflare.

7. **Deep health.**
   ```bash
   justmail health --deep
   ```
   Verifies DNS, TLS, MX handshake, SPF/DKIM/DMARC alignment, IMAP login.

## Expected RTO / RPO

- Single-node: RTO 4 h, RPO 1 h (hourly WAL archive).
- Cluster: RTO 30 min, RPO 5 min.
