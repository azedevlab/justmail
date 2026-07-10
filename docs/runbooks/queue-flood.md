# Runbook — queue flood

**Trigger:** Queue snapshot shows `active > 500` for > 5 min or `oldest_age_s
> 3600`.

## Diagnose

1. Overview → Queue: read the current snapshot.
2. Open Queue → Deferred: sample the top 20 queue-ids and look for a pattern
   (same sender, same recipient, same DSN).

## Common causes

- **Legit spike:** Newsletter, cron report, monitoring alert. Let the queue
  drain.
- **Bounce storm:** A single source keeps deferring to the same recipient.
  Suspend the sender via mailbox settings if malicious.
- **DNS problem on outbound:** MX resolution failing. Check `dig MX` for the
  most common receiving domains.
- **Outbound IP reputation:** DNSBL hit. Follow `mail-blocked.md`.

## Fix

- If temporary, do nothing; the queue drains as retries succeed.
- If persistent, flush the queue manually:
  `justmail exec postfix postqueue -f`
- For hostile senders, block their IP on the Security screen.
