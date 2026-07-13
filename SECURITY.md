# Security policy

## Supported versions

| Version | Supported                        |
|---------|----------------------------------|
| v1.x    | ✅ latest minor + previous minor |
| v0.x    | ⛔ pre-release; unsupported      |

## Reporting a vulnerability

Please report vulnerabilities privately:

- Email: `security@justmail.dev`
- PGP fingerprint: (published on `https://justmail.dev/security`)
- GitHub advisory: use the "Report a vulnerability" tab under this
  repository's Security page.

Please include:

- A description of the vulnerability and impact.
- Steps to reproduce (ideally a minimal proof of concept).
- Affected component and version.
- Any mitigations you're aware of.

We aim to:

- Acknowledge within **2 business days**.
- Provide a target fix window within **5 business days**.
- Ship a fix and public advisory within **90 days**, or negotiate a longer
  embargo with reporters when needed.

We follow coordinated disclosure and will credit reporters (unless they
prefer anonymity) in the resulting advisory.

## Scope

In scope:

- Everything in this repository (control plane, mail plane configs,
  installer, plugin runtime, SDKs).
- Official container images (`ghcr.io/azedevlab/*`).
- The hosted preview at `demo.justmail.dev` (in-scope for read-only
  probes; no destructive testing).

Out of scope:

- Third-party plugins (report to the plugin author first).
- Deployments not using the shipped installer or Helm chart.
- Social engineering of maintainers or users.

## Safe harbour

Good-faith research reported through this process will not lead to legal
action from the JustMail project.
