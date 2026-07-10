# Runbooks

Playbooks the on-call operator runs when things go sideways. Each runbook is
short, dated, and testable — an integration test in `tests/security/`
reproduces the failure it addresses.

| Runbook | Trigger |
|---|---|
| [dns-drift.md](dns-drift.md) | DNS Center reports drift on a managed record |
| [mail-blocked.md](mail-blocked.md) | Outbound mail rejected or landing in spam |
| [postgres-failover.md](postgres-failover.md) | Postgres primary unreachable |
| [redis-loss.md](redis-loss.md) | Redis unreachable or data-loss event |
| [certificate-issuance.md](certificate-issuance.md) | ACME issuance fails |
| [queue-flood.md](queue-flood.md) | Queue depth > threshold or spike |
| [disaster-recovery.md](disaster-recovery.md) | Total host loss |
