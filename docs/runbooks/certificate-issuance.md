# Runbook — Certificate issuance failure

**Trigger:** Traefik or certd logs report ACME failures; new hosts serve
Traefik's default self-signed cert.

## Diagnose

Common causes, in order:

1. DNS provider token missing / wrong scope.
2. Rate limits (Let's Encrypt: 50 certs per registered domain per week).
3. TXT record collides with a previous attempt (stale `_acme-challenge`
   entry).
4. Zone propagation timeout — usually only during initial provider setup.

Check:

```bash
docker logs justmail-traefik-1 | grep -i acme | tail -20
```

## Fix

- **Stale TXT:** Delete `_acme-challenge.<host>` at the DNS provider, then
  wait for TTL, then let Traefik retry.
- **Bad token:** Update `CLOUDFLARE_API_TOKEN` in `/opt/justmail/.env`,
  then `justmail restart traefik`.
- **Rate limited:** Wait (LE clears after a week). If urgent, switch
  fallback resolver:
  ```
  --certificatesresolvers.zerossl.acme.…
  ```
  and restart Traefik.
