# Phase 7 — Wireframes (Milestone 1 screens)

Shell applies to all screens: sidebar (collapsible) + topbar + content. Detail views open
as right slide-over inspectors where possible (Linear pattern).

## 1. Shell

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ ⬢ Acme ▾ │  Domains / devlab.az            ⌘K Search…    ● Live  ◐  👤 │
│          ├──────────────────────────────────────────────────────────────┤
│ OVERVIEW │                                                              │
│ ◉ Dashbrd│                                                              │
│ MAIL     │                                                              │
│ ▸ Domains│                        content                               │
│ ▸ Mailbox│                                                              │
│ ▸ Aliases│                                                              │
│ ▸ Queue  │                                                              │
│ ▸ Logs   │                                                              │
│ INFRA    │                                                              │
│ ▸ DNS    │                                                              │
│ ▸ TLS    │                                                              │
│ ▸ System │                                                              │
│ SECURITY │                                                              │
│ ▸ Threats│                                                              │
│ ▸ Access │                                                              │
│──────────│                                                              │
│ ✓ Healthy│                                                              │
└──────────┴──────────────────────────────────────────────────────────────┘
```

## 2. Dashboard (`/`)

```
┌ Mail flow (live) ────────────┐ ┌ Queue ──────┐ ┌ Spam blocked ┐ ┌ TLS in ┐
│ ▁▂▄▆▅▇▆▄ in 42/m out 18/m   │ │ 3 deferred  │ │ 96.2% ▁▃▂▄   │ │ 99.1%  │
└──────────────────────────────┘ └─────────────┘ └──────────────┘ └────────┘
┌ Delivery outcomes (24h, stacked area) ───────────┐ ┌ System ────────────┐
│ delivered / deferred / bounced / rejected        │ │ CPU ▓▓░░ 34%       │
│                                                  │ │ RAM ▓▓▓░ 58%       │
│                                                  │ │ Disk ▓░░░ 12%      │
└──────────────────────────────────────────────────┘ │ 14 containers ✓    │
┌ Recent activity (live feed) ─────────────────────┐ │ cert renews in 62d │
│ ✓ delivered  alice@… → bob@gmail.com   2s  TLS1.3│ └────────────────────┘
│ ⚠ deferred   news@… → mx.corp.com   conn timeout │
│ ✗ rejected   spam@bad.tld  rspamd score 21.4     │
└──────────────────────────────────────────────────┘
```
All cards clickable → filtered detail views. Numbers tween on WS `metrics.tick`.

## 3. Domains list + onboarding

```
/domains
┌ Domains (3)                                  [＋ Add domain] ┐
│ devlab.az     ● Active    12 mailboxes  DNS ✓  DKIM ✓  🛡 98 │
│ acme.co       ◐ Verifying  0            DNS 3/7 pending      │
│ old.example   ○ Suspended  4            —                    │
└──────────────────────────────────────────────────────────────┘

Add-domain wizard (modal, 3 steps):
[1 Domain name] → [2 DNS records: auto-create via Cloudflare ✓ or copy manually] →
[3 Verification: live checklist, each record flips ✗→⏳→✓ as propagation confirms]
```

## 4. Domain detail (`/domains/:id`) — tabs: Overview · DNS · Mailboxes · DKIM · Settings

```
DNS tab ("DNS Center" scoped to domain):
┌ Health: 6/7 ✓   [Check now] [Repair all] [Sync to Cloudflare] ┐
│ TYPE  NAME              CONTENT                 STATUS         │
│ MX    @                 10 mail.devlab.az       ✓ ok           │
│ TXT   @                 v=spf1 mx -all          ✓ ok           │
│ TXT   jm26a._domainkey  v=DKIM1; k=ed25519…     ⏳ propagating  │
│ TXT   _dmarc            v=DMARC1; p=quarantine  ⚠ drifted [fix]│
│ …                                                              │
└────────────────────────────────────────────────────────────────┘
Row expand → observed vs desired diff, per-resolver propagation map.
```

## 5. Mailboxes (`/mailboxes`)

```
┌ Filter: domain ▾  status ▾   search…        [Import CSV] [＋ Mailbox] ┐
│ ● alice@devlab.az   Alice K.   2.1/5 GB ▓▓░   IMAP 2m ago            │
│ ● bob@devlab.az     Bob R.     0.4/5 GB ░░░   never                  │
│ ○ tmp@devlab.az     suspended  —                                     │
└───────────────────────────────────────────────────────────────────────┘
Row click → right inspector: quota slider, forwarding chips, autoresponder,
protocol toggles, reset password, sessions, per-folder usage, danger zone.
```

## 6. Queue (`/queue`)

```
┌ 3 deferred · 0 active · 0 hold      [Retry all] [⏸ Pause queue]      ┐
│ ☐ 4B2A1C  news@dl.az → x@corp.com  deferred 2h  "conn timeout" ↻ ✕ ⏸ │
│ ☐ 9F0E44  …                                                          │
└───────────────────────────────────────────────────────────────────────┘
Row expand → full delivery attempts timeline + headers preview.
Bulk bar appears on selection.
```

## 7. Logs / tracing (`/logs`)

```
┌ 🔍 to:bob@gmail.com status:bounced last:24h        [Live ▶] ┐
│ 12:03:22 ✗ bounced 4B2A1C alice→bob  5.1.1 no such user     │
│ 12:03:20 ✓ delivered …                                      │
└─────────────────────────────────────────────────────────────┘
Click row → Trace view: vertical timeline for queue-id
  accepted → rspamd(score 1.2) → queued → attempt 1 (tls1.3, 210ms) → delivered
  + raw log lines (mono, Loki) collapsible under each step.
```

## 8. Security (`/security`)

```
┌ Security score: 92/100 ────────────────────────────────────────┐
│ ✓ DMARC enforced  ✓ TLS strict  ⚠ 2FA off for 2 admins [fix]  │
└────────────────────────────────────────────────────────────────┘
┌ Threats (24h): 1,204 blocked ┐ ┌ Fail2Ban: 17 IPs banned      │
│ auth bruteforce 890          │ │ 203.0.113.9  dovecot  [unban]│
│ spam rejects   290           │ │ …                            │
└──────────────────────────────┘ └──────────────────────────────┘
```

## 9. Command palette (⌘K)

```
┌──────────────────────────────────────────────┐
│ 🔍 alice                                     │
│ MAILBOXES  ● alice@devlab.az       jump →    │
│ ACTIONS    ＋ Create mailbox "alice@…"       │
│            ↻ Retry queue item…               │
│ NAV        Domains · Queue · Logs · Settings │
└──────────────────────────────────────────────┘
```
Sources: nav, entities (domains/mailboxes/aliases), actions, queue IDs, settings.
