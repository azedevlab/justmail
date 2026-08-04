# 4. Master Opportunity Table & Product Categories

## 4.1 Master Table

Columns: Difficulty (E/M/H/X=Enterprise) · Revenue = realistic monthly revenue per customer (AZN) · Competition (None/Low/Med/High) · Gap = explicit local market gap found · Priority (C/H/M/L) · RR = recurring revenue strength (1–5) · Impl = implementation time per install once templated · Suitability flags: SaaS / Agency (managed service) / Ent (enterprise) / SH (self-hosted) / Cloud / AI / n8n.

| Industry | Automation Product | Diff | Rev/cust | Compet. | Gap | Prio | RR | Impl | SaaS | Agency | Ent | SH | Cloud | AI | n8n |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Clinics | WhatsApp/IG AI receptionist + recalls | M | 300–800 | None | ✔ | C | 5 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Dental | Treatment-plan & recall automation | E–M | 200–500 | None | ✔ | C | 5 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| E-commerce | WA order/COD/cart automation suite | E–M | 150–600 | None | ✔ | C | 5 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Accounting firms | Client docs + tax calendar + OCR + e-qaimə pack | M–H | 300–1,500 | None | ✔ | C | 4 | 1–2 wk | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Training centers | Enrollment funnel + tuition + parent comms | E–M | 100–400 | None | ✔ | C | 5 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Beauty salons | IG booking bot + rebooking engine | E–M | 100–300 | Low (Altegio partial) | ~ | H | 4 | hours | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Hotels | Direct-booking rescue + guest journey | M | 300–1,000 | None | ✔ | H | 4 | 1–2 wk | ✔ | ✔ | ~ | ✔ | ✔ | ✔ | ✔ |
| Restaurants | POS-connected loyalty + reconciliation + P&L | E–M | 150–500 | Low (POS built-ins) | ~ | H | 4 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Travel agencies | Inquiry→quote→payment funnel | E–M | 150–500 | None | ✔ | H | 4 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Car dealers | Lead response + service recalls | M | 400–1,500 | None | ✔ | H | 4 | 1 wk | ✔ | ✔ | ~ | ✔ | ✔ | ✔ | ✔ |
| Insurance brokers | Renewal engine + WA claims intake | M | 500–1,500 | None | ✔ | H | 5 | 1–2 wk | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Freight forwarders | Quote responder + shipment comms + docs | M | 500–2,000 | None | ✔ | H | 3 | 2–4 wk | ~ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Customs brokers | Doc intake + OCR + HS-code assistant | H | 400–1,500 | None | ✔ | H | 4 | 2–4 wk | ~ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Construction/developers | Sales funnel + site reports + tender watch | M | 300–3,000 | Low (B24 generic) | ✔ | H | 3 | 2–4 wk | ~ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| SMM agencies | Client reporting + white-label automation | E–M | 200–800 | Low | ~ | H | 4 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| B2B (all) | Tender watcher (etender + SOCAR portals) | M | 50–200/seat | Low (foreign aggregators) | ~ | H | 5 | instant | ✔ | – | – | ✔ | ✔ | ✔ | ✔ |
| SMEs (all) | Open-banking reconciliation & cash-flow | H | 200–800 | None | ✔ | H | 5 | 1 wk | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Fitness | Renewal dunning + churn alarms | E–M | 200–600 | None | ✔ | M-H | 5 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Pharmacies/labs | Refill recalls + expiry sentinels | M | 300–1,000 | None | ✔ | M-H | 4 | 1–2 wk | ✔ | ✔ | – | ✔ | ✔ | ~ | ✔ |
| Retail chains | Cash-up reconciliation + supplier ingest | M–H | 1,000–5,000 | Low (1C integr.) | ~ | M-H | 4 | 4–8 wk | – | ✔ | ✔ | ✔ | ~ | ✔ | ✔ |
| Couriers | Tracking self-service + COD recon | M | 800–3,000 | Low (in-house) | ~ | M-H | 4 | 2–4 wk | ~ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Call centers | AI call QA + WA deflection | H | 1,000–5,000 | Low (Whelp adjacent) | ~ | M-H | 4 | 4–8 wk | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| O&G contractors | Bid packs + certification registry | M | 500–2,000 | None | ✔ | M-H | 3 | 2–4 wk | – | ✔ | ✔ | ✔ | – | ✔ | ✔ |
| Real estate | Matchmaker + syndication + rent autopilot | E–M | 150–1,000 | None | ✔ | M-H | 4 | days | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Regional ISPs | TG self-service + dunning | M | 400–1,200 | None | ✔ | M | 4 | 1–2 wk | ✔ | ✔ | – | ✔ | ✔ | ~ | ✔ |
| Law firms | Court tracker + doc assembly | M | 300–1,000 | None | ✔ | M | 3 | 2–3 wk | ~ | ✔ | – | ✔ | ✔ | ✔ | ✔ |
| Manufacturing | Dealer order bots + production reports | M–H | 500–2,500 | Low (1C/MSOFT) | ~ | M | 3 | 4–8 wk | – | ✔ | ✔ | ✔ | – | ~ | ✔ |
| Private schools/HEIs | Admissions + tuition autopilot | M | 300–1,500 | None | ✔ | M | 4 | 2–4 wk | ✔ | ✔ | ~ | ✔ | ✔ | ✔ | ✔ |
| MSPs/IT | MSP-in-a-box monitoring/reporting | E–M | 200–800 | Low (global tools) | ~ | M | 4 | days | ✔ | ✔ | – | ✔ | ✔ | ~ | ✔ |
| Security/cleaning | Geo timesheets + event routing | E–M | 200–800 | None | ✔ | M | 4 | 1 wk | ✔ | ✔ | – | ✔ | ✔ | – | ✔ |
| Property mgmt | Tenant desk + rent + utility autopilot | M | 300–1,000 | None | ✔ | M | 4 | 1–2 wk | ✔ | ✔ | – | ✔ | ✔ | ~ | ✔ |
| Banks (mid-tier) | Orchestration/recon/KYC flows | X | 2k–10k | Med (Big-4, UiPath) | ~ | M | 3 | 2–6 mo | – | ✔ | ✔ | ✔ | – | ✔ | ✔ |
| Insurers | Claims intake + renewal orchestration | X | 2k–8k | Med (in-house) | ~ | M | 3 | 2–4 mo | – | ✔ | ✔ | ✔ | – | ✔ | ✔ |
| Government | Citizen comms + doc routing (via primes) | X | project | High (SINAM/ATL) | – | L→M | 2 | 3–12 mo | – | ~ | ✔ | ✔ | – | ✔ | ✔ |
| NGOs | Donor reporting + beneficiary tracking | E | 100–300 | None | ✔ | L | 2 | days | ~ | ✔ | – | ✔ | ✔ | ~ | ✔ |

## 4.2 Product Category Groups

**A. AI Receptionists & Booking (flagship category)** — clinic/dental/salon/fitness/restaurant/hotel/dealer receptionists; voice AI reminder agents; waitlist/no-show engines. *The demand magnet — easiest to demo, easiest to sell.*

**B. Conversational Commerce & Sales** — IG comment/DM funnels, WhatsApp catalogs, COD verification, abandoned-cart rescue, lead qualifiers, speed-to-lead, SDR agents.

**C. Customer Support & Omnichannel** — RAG support bots, omnichannel inboxes (Chatwoot-based), ticket triage, CSAT, complaint escalation, ISP/utility self-service. *Whelp is the local incumbent to differentiate against (they sell software; you sell outcomes.)*

**D. Finance & Accounting Automation** — open-banking reconciliation, AR chasers, e-qaimə processing, receipt OCR, tax-calendar compliance, payroll prep, subscription billing, cash-flow forecasting. *Deepest moat: local rails (e-taxes, OB, BTP) nobody else automates.*

**E. Marketing Automation** — campaign engines (birthday/Novruz/win-back), review boosters, SMM client reporting, content pipelines, influencer ROI, competitor price watch.

**F. HR & Recruiting** — CV screening, interview scheduling/screening, onboarding, leave bots, geo timesheets, eNPS, contract generation with SİMA.

**G. Operations & Document Automation** — approval matrices, meeting minutes agents, doc expiry registries, archive digitization, report compilers, translation pipelines, RPA-style data entry.

**H. Logistics & Trade** — freight quoting, shipment comms, customs doc packs + HS-code AI, container tracking, fleet alert hubs (Wialon), driver task bots, COD settlement.

**I. Government & Compliance Interfaces** — tender watchers (etender/SOCAR), regulatory watch, license renewal minders, VÖEN enrichment, utility autopilots, stat-report calendars.

**J. Vertical Ops Packs** — Klinika/Gözəllik/Restoran/Təhsil/Əmlak/Mühasib/Logistika packs (chapter 6) — the productized bundles that make agency delivery repeatable.

**K. DevOps, IT & Monitoring** — uptime sentinels, incident war-rooms, backup verification, MSP client reporting, log summarizers, access provisioning (AD/LDAP).

**L. Security & Compliance Ops** — phishing handling, access reviews, awareness drips, CCTV event routing, visitor passes, ISO incident registers, AML rule engines.

**M. AI Agent Platform (Phase 4–5)** — voice AI (AZ), document Q&A, call QA, multi-agent ops copilots, exec assistants — the premium tier built on categories A–L rails.

## 4.3 Portfolio Logic

- **Volume engines (fund the business):** categories A, B, J at 100–800 AZN/mo × hundreds of customers.
- **Moat builders (defend the business):** category D + I — local-rails integrations competitors can't copy quickly.
- **Margin expanders (grow ACV):** categories H, K, and enterprise deals in banking/insurance.
- **Future platform (exit value):** category M on top of everything.
