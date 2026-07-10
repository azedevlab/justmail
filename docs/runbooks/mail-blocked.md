# Runbook — mail rejected or landing in spam

**Trigger:** Bounce rate spike, complaints, DMARC failures, or user reports
of mail landing in spam.

## Diagnose

1. Open the Deliverability screen. Check DMARC pass/fail ratio.
2. Open the Queue screen; look for `deferred` entries with 4xx/5xx DSNs.
3. Run a quick check against `mail-tester.com` from a mailbox and observe
   the score.
4. Verify:
   - PTR (rDNS) of the public IP resolves to `mail.<domain>`.
   - MX, SPF, DKIM, DMARC records all show `ok` in DNS Center.
   - DNSBL panel shows no hits for the outbound IP.
   - MTA-STS policy is served (test with `curl https://mta-sts.<domain>/.well-known/mta-sts.txt`).

## Fix (in order)

1. **DKIM missing / retired:** Generate + activate a new selector.
2. **SPF too permissive or too strict:** Update SPF to include only your
   sending sources; avoid `+all` and `~all` misuse.
3. **DMARC `p=none`:** Move to `p=quarantine` once alignment is stable.
4. **Reputation problem:** Enable IP warmup on the Security screen and
   ramp gradually.
5. **DNSBL hit:** Follow the delisting URL surfaced in the report; only
   after fixing the underlying cause.

## Escalate

- Persistent 5xx on outbound: file a Postmaster ticket with the receiving
  provider using the audit trail from the queue trace view.
