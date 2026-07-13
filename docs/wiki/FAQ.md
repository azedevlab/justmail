# FAQ & Troubleshooting

### Is JustMail really self-hosted and open source?

Yes. The platform is AGPL-3.0; the SDK/plugin protocol is Apache-2.0. You run it
on your own infrastructure and own all the data.

### How is this different from running Postfix/Dovecot by hand?

JustMail drives them from one control plane. You create a domain and it
provisions mailboxes, generates DKIM keys, and publishes/monitors every DNS
record — no hand-editing maps or config files.

### Which DNS providers are supported?

Cloudflare and deSEC today, behind one interface; others are selectable and
fail loudly until credentialed. No API token? Export a BIND zone file and import
it anywhere.

### Which object storage backends work?

Local disk, and S3-compatible R2, MinIO, Backblaze B2, Wasabi, DigitalOcean
Spaces, Scaleway, and Ceph, plus Azure Blob and Google Cloud Storage.

---

## Troubleshooting

### DNS records won't turn green

Re-run **DNS Center → Publish**, then **Recheck** after propagation. Publishing
removes duplicate SPF/DKIM/DMARC records (a common cause of a permanent
`permerror`). See
[dns-drift.md](https://github.com/azedevlab/justmail/blob/main/docs/runbooks/dns-drift.md).

### Outbound mail lands in spam

Almost always missing **PTR/reverse DNS** or an **un-activated DKIM key**.
Confirm rDNS for your IP points at `mail.<domain>` and that DKIM shows Active.
See [mail-blocked.md](https://github.com/azedevlab/justmail/blob/main/docs/runbooks/mail-blocked.md).

### TLS certificate never issues

Ports 80/443 must be open and the hostnames must resolve to this server. certd
uses a self-signed cert until the real one is issued.

### Outbound port 25 is blocked

Many clouds block it. Request an unblock or configure a smarthost relay.

### IMAP index corruption on shared storage

Set `MAIL_STORAGE_BACKEND` for your filesystem and run a Dovecot Director so a
mailbox is only opened by one backend. See
[shared-storage.md](https://github.com/azedevlab/justmail/blob/main/docs/deployment/shared-storage.md).

### More runbooks

[docs/runbooks/](https://github.com/azedevlab/justmail/tree/main/docs/runbooks) —
Postgres failover, Redis loss, queue floods, certificate issuance, disaster
recovery.
