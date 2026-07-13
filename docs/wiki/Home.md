# JustMail Wiki

**JustMail** is a modern, open-source, self-hosted email server and webmail
platform. It wires Postfix, Dovecot, Rspamd, and ClamAV together behind one API
and gives you a Gmail-class webmail plus a full admin console — with SPF, DKIM,
DMARC, MTA-STS, TLS-RPT, BIMI, CAA and ARC configured and monitored out of the
box.

> This wiki is the operator's handbook. For a project overview see the
> [README](https://github.com/azedevlab/justmail/blob/main/README.md).

## Start here

- **[[Installation]]** — from a bare server to deliverable mail.
- **[[Configuration]]** — every environment variable and what it controls.
- **[[Architecture]]** — how the control plane and mail data plane fit together.
- **[[Deployment]]** — single-node Compose, Kubernetes/Helm, and scale-out.
- **[[FAQ]]** — common questions and troubleshooting.

## What you get

- 📬 **Webmail** — search, threading, labels, Sieve filters, scheduled send,
  contacts, and browser push.
- 🛠️ **Admin console** — domains, mailboxes, aliases, DKIM, DNS Center,
  deliverability, security, webhooks, API keys, backups.
- 📈 **Deliverability by default** — one-click DNS publishing that reconciles
  records without clobbering unrelated ones and removes stale duplicates.
- 🔒 **Security** — per-tenant isolation, encrypted credential storage,
  passkeys/WebAuthn, OIDC/SAML SSO, SCIM, rate limiting, ClamAV scanning.
- ☁️ **Runs anywhere** — pluggable object storage (Local, S3, R2, MinIO, B2,
  Wasabi, DigitalOcean, Scaleway, Ceph, Azure, GCS) and DNS providers.

## License

Platform is **AGPL-3.0-only**; the SDK/plugin protocol is **Apache-2.0**. See
[LICENSE](https://github.com/azedevlab/justmail/blob/main/LICENSE).
