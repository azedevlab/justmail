# justmail (Helm chart)

Production-shaped chart for JustMail on Kubernetes.

## Install

```bash
helm repo add justmail https://charts.justmail.dev
helm install justmail justmail/justmail \
  --namespace justmail --create-namespace \
  --values values.yaml
```

## Dependencies

- Zalando Postgres Operator (or PGO) for HA Postgres.
- Ingress controller (nginx-ingress or Traefik).
- cert-manager (for `clusterIssuer: letsencrypt`).
- External secrets manager for `Secret` inputs (recommended).

## What ships

- Deployments: `api`, `admin`, `webmail`, `landing`.
- StatefulSets: `postfix`, `dovecot`, `rspamd` (mail data plane).
- CRDs: `Domain`, `Mailbox`, `Alias`, `WebhookEndpoint`, `BackupSchedule` for
  GitOps use.
- ServiceMonitors and PrometheusRules.
- PodDisruptionBudgets for every Deployment.
- HorizontalPodAutoscaler on `api`, `admin`, `webmail`.

## Sizing

See [`docs/redesign/04-scalability.md`](../../../docs/redesign/04-scalability.md).
