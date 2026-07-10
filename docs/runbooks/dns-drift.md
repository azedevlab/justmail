# Runbook — DNS drift

**Trigger:** DNS Center screen shows one or more records in `drifted` or
`missing` state; deliverability score drops below the threshold.

## Diagnose

1. Open `/orgs/<id>/domains/<id>` in admin.
2. Note which records are drifted. Common causes:
   - Someone edited the record at the DNS provider.
   - Provider zone was rotated / re-imported.
   - `provider_record_id` cache is stale after a provider export/import.

## Fix

1. If the drift is intentional (a colleague edited the record):
   - Update JustMail's expected content via the API:
     `PATCH /v1/orgs/<id>/domains/<id>/dns/<record-id>`, then verify.
2. If the drift is unintentional:
   - Click **Sync to provider** on the domain detail screen.
   - JustMail upserts the expected content. Wait ≤ 5 min for propagation.
   - Click **Check DNS** to verify.

## Escalate

- If `Sync` returns `error` for the record, capture the trace id from the
  error banner and file an incident.
- If drift recurs within 24 hours, disable `managed=true` on the record
  until the source of the change is identified.
