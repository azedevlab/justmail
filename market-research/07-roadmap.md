# 7. Business Build Roadmap — Five Phases

Assumptions: founding team of 2–3 (1–2 engineers + 1 seller/operator), revenue-funded, Baku-based, n8n self-hosted on local VPS/cloud from day one. Licensing note: n8n's fair-code (Sustainable Use) license permits internal use and consulting/managed services; for a multi-tenant hosted product where customers use n8n directly, use the embed/enterprise license or keep customers on managed single-tenant instances — budget for this from Phase 2.

---

## Phase 1 — Fastest Cash (Months 0–4)
**Goal: 20–40 paying customers, 8–15k AZN MRR, prove the motion.**

**Build (shared core first):**
1. Core engine: WhatsApp BSP integration (Meta Cloud API via 360dialog or direct), Instagram DM webhook handling, LLM conversation layer with AZ/RU prompts, Google Calendar booking, local SMS gateway node, Epoint/Payriff payment-link node. This core powers everything.
2. Product 1: **Clinic/Dental AI receptionist** (Top-50 #1) — flagship demo.
3. Product 2: **Salon/travel/training-center booking funnels** (#4, #5, #13) — same engine, new skins.
4. Product 3: **AR chaser** (#6) — the universal B2B door-opener ("we recover your receivables").

**Sell:** founder-led; Instagram content (before/after workflow videos in Azerbaijani); 30 free pilot days for 5 lighthouse customers per vertical; pricing 150–500 AZN/mo + 500–2,000 setup. Collect testimonials and quantified results (bookings recovered, debtor days cut) obsessively.

**Milestones/kill-criteria:** ≥25% pilot→paid conversion and <5% monthly churn by month 4, else re-pick verticals before scaling.

## Phase 2 — Higher-Value Products (Months 4–10)
**Goal: 80–150 customers, 30–60k AZN MRR, first hires (1 support/delivery, 1 seller).**

1. **Accountant pack** (#3) — doc collection, tax calendar, receipt OCR, e-qaimə watching. Accountants become a referral channel to their client bases.
2. **E-commerce suite** (#2) — WooCommerce + WA + COD + couriers; partner with Epoint/Payriff and courier firms for distribution.
3. **Tender Watcher SaaS** (#7) — first true self-serve product: etender.gov.az + SOCAR e-procurement monitoring, LLM fit-scoring, 50–150 AZN/seat/mo. Landing page + subscription billing on your own billing engine (#19 — build it for yourself, then sell it).
4. **Vertical packs formalized** (chapter 6 bundles) — installation runbooks so juniors can deliver in <1 day.
5. Launch **template marketplace v1** (Azerbaijani landing + n8n community listings for international sales of the non-AZ-specific ~60%).

**Channel building:** white-label deal with 2–3 SMM agencies and 2–3 Bitrix24 integrators (they resell, you deliver; 20–30% margin share).

## Phase 3 — Enterprise & Moat (Months 10–20)
**Goal: 200–300 customers + 3–8 enterprise accounts, 80–150k AZN MRR.**

1. **Open-banking product line** (#8): reconciliation, payment-notify, cash-flow forecasting on api.birbank.business + CBAR open-banking standard. First-mover moat — start integration certification early.
2. **Logistics & customs**: forwarder comms pack (#14), customs-broker assistant (#15) — ride the Middle Corridor boom.
3. **Enterprise entries**: mid-tier banks/insurers (orchestration, KYC intake, claims), retail-chain reconciliation (#27), developer sales funnels (#17). Hire 1 enterprise delivery engineer; get ISO 27001-lite security posture documented — it unblocks bank deals.
4. **Government-adjacent**: subcontract via SINAM/ATL-class primes opportunistically; register with IDDA/4SİM programs; apply for KOBİA startup certificate (3-year profit-tax exemption) and technopark residency if eligible (10-year tax holidays).

## Phase 4 — AI Agent Platform (Months 18–30)
**Goal: productize intelligence; 150–250k AZN MRR; team 10–15.**

1. **Azerbaijani Voice AI** (#23): validate AZ STT/TTS quality (test Whisper-class + commercial engines + Dilmanc lineage); launch voice reminder/confirmation agents for clinics, collections, utilities.
2. **AI call-QA** (#25) for banks/telecom/BPO call centers — 100% call scoring.
3. **Agent workbench**: RAG document Q&A (#42), meeting-minutes agent (#29), exec assistant (#45) as a unified "AI employee" subscription (per-seat or per-agent pricing).
4. Publish an **agent API layer** so agencies/ISVs build on your AZ-localized agents (WhatsApp-first, SİMA-aware, e-qaimə-aware) — the beginning of platform economics.

## Phase 5 — Complete Automation Platform (Months 30+)
**Goal: the "Zapier + Intercom + UiPath of the Caucasus" — 300k+ AZN MRR, regional expansion.**

1. **Self-serve platform**: multi-tenant portal where SMBs pick vertical packs, connect channels, and manage flows — n8n embedded under proper licensing, your connector library (local payments, banks, e-taxes, SİMA, couriers, POS) as the defensible asset.
2. **Marketplace flywheel**: third-party template authors, revenue share; certified-partner program from your white-label agencies.
3. **Regional expansion**: Georgia and Uzbekistan share the same gaps (WhatsApp/Telegram commerce, weak SaaS penetration); Kazakhstan for tender/logistics products. Your playbook and 80% of templates transfer; only rails change.
4. **Strategic options**: acquisition interest plausibly from PASHA-ecosystem tech arms, banks building SME ecosystems, Turkish SaaS consolidators, or regional BPO groups; alternatively raise on revenue for regional rollout.

---

## Operating Principles (all phases)

- **Sell outcomes, not workflows.** "37 bookings recovered last month" — never "we configured n8n."
- **Anchor pricing to salaries** (700–1,200 AZN admin FTE), never to Western SaaS lists.
- **One core engine, many skins.** Every new vertical must reuse ≥70% of existing nodes or it waits.
- **Own the integrations others won't build:** e-taxes flows, SİMA, local PGs, open banking, POS APIs, courier APIs. Each one raises the wall.
- **Instrument churn from customer #1.** Micro-SMB churn is the #1 threat to the volume tier; the antidote is monthly value reports (auto-generated, of course, by workflow #200).
- **Legal hygiene early:** personal-data law compliance for message data, WhatsApp opt-in records, and the n8n licensing boundary as you productize.

## Risk Register (top 5)

| Risk | Mitigation |
|---|---|
| Meta/WhatsApp policy or pricing changes | Multi-channel from day one (SMS/Telegram fallbacks); BSP redundancy |
| Micro-SMB churn at low price points | Annual prepay discounts; value reporting; move upmarket steadily |
| Copycats (low technical barrier on simple bots) | Compound moats: local-rails connectors, brand, channel partners, data |
| AZ-language AI quality (esp. voice) | Benchmark early; human-fallback designs; fine-tune prompts per vertical |
| Portal automations (e-taxes, e-court) breaking on redesigns | Monitoring on the automations themselves; graceful degradation to human queues; pursue official API access as volume grows |
