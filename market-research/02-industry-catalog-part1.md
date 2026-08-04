# 2. Industry Automation Catalog — Part 1 (Banking → E-commerce)

Format per industry: pain points → current process → automation opportunities → n8n verdict → integrations → economics → competition → score. Prices in AZN (1 USD = 1.70 AZN). "Market Gap" = no local provider found in research (Aug 2026).

---

## 2.1 Banking

**Market:** ~22 banks; leaders ABB (>14B AZN assets), Kapital Bank (~105 branches), PASHA Bank. High digital maturity at the top (Birbank 3.4M users), long tail of mid-size banks with thin engineering teams.

**Pain points:** manual back-office reconciliation between core banking / processing (Azericard) / gateways; KYC document collection and verification; loan-application document chasing; compliance reporting to CBAR; customer support volume (call centers); collections outreach; internal joiner/mover/leaver access management; SLA monitoring for partner integrations; marketing campaign execution across SMS/push/WhatsApp.

**Existing process:** top banks run RPA (Bank ABB is a published UiPath case, delivered by consultancy Native) and core systems (Oracle FLEXCUBE at ABB/Kapital); mid-tier banks rely on Excel, email, and manual operations teams; Deloitte does enterprise RPA projects.

**Automation opportunities:** compliance report assembly; reconciliation exception handling; KYC document intake with OCR + registry checks; collections messaging cascades (WhatsApp/SMS/voice); support triage RAG bots for internal knowledge; employee access provisioning against AD/LDAP; partner-API uptime monitoring; NPS/CSAT loops; card-dispute case workflows.

- **Can n8n solve it?** PARTIALLY — n8n excels at orchestration around core systems (notifications, reconciliation, document flows, monitoring) but will not replace core banking or licensed AML platforms; on-prem self-hosting is the key that gets n8n through bank security review.
- **Integrations:** core banking exports, Oracle DB, AD/LDAP, SMTP/Exchange, WhatsApp BSP, SMS gateways, OCR/LLM (self-hosted models often required), Jira, Grafana/Prometheus, CBAR reporting formats.
- **Difficulty:** Enterprise · **Dev time:** 2–6 months per project · **Revenue:** project-based 30k–200k AZN + 2k–10k AZN/mo support · **Setup:** 30k–200k AZN · **Managed:** 2k–10k AZN/mo.
- **Suitable for AZ?** Yes for mid-tier banks priced out of UiPath/Big-4; sales cycles 6–12 months, need security certifications and references.
- **Competitors:** Deloitte AZ, Native (UiPath), in-house teams. No n8n-based challenger → **partial Market Gap** (the low-cost orchestration tier is empty).
- **Score:** 6/10 · **Priority:** Medium (high value, slow entry; do after credibility built).

## 2.2 Insurance

**Market:** ~16 insurers, 1.5B AZN premiums (+11.2% YoY); PASHA group >50% share; compulsory motor (İcbari, via ISB central register), corporate health (DMS), life. Motor +22% H1 2025.

**Pain points:** annual renewals chased manually by call centers; agent/broker paperwork; claims document collection (photos, police reports) via WhatsApp with manual re-entry; corporate DMS member lists managed in Excel; policy issuance data re-keyed between systems; lead follow-up from ads is slow.

**Existing process:** top insurers (PASHA) have apps and online sales; mid-tier insurers and the entire broker/agent layer run on phone + Excel + WhatsApp; ISB provides the central e-register and SMS-check (9707).

**Automation opportunities:** renewal reminder engines with payment links (ISB online purchase gives 5% discount — a built-in CTA); WhatsApp claims intake (photos → OCR → structured claim file); agent portal bots (quote requests via Telegram); DMS corporate onboarding (employee list ingestion, card issuance tracking); lead-to-policy funnels from Instagram ads; churn-risk scoring on renewal book; broker commission reconciliation.

- **Can n8n solve it?** YES for distribution/service layers; PARTIALLY for core underwriting (stays in insurer systems).
- **Integrations:** WA, SMS, LLM/OCR, PG (Epoint/Payriff), insurer portals/APIs, ISB lookups, B24/Sheets, PDF.
- **Difficulty:** Medium (agents/brokers) to Enterprise (insurers) · **Dev time:** 2–6 weeks per agency solution; 2–4 months insurer projects · **Revenue:** 500–1,500 AZN/mo per brokerage; 20k–80k AZN insurer projects · **Setup:** 1.5k–5k AZN (broker), 20k+ (insurer) · **Managed:** 300–1,500 AZN/mo.
- **Suitable for AZ?** Yes — renewals are a universal, dated, high-value trigger; brokers are numerous and unautomated.
- **Competitors:** none found at broker/agency tier → **Market Gap**. Insurer tier: in-house + integrators.
- **Score:** 7/10 · **Priority:** High (broker tier first).

## 2.3 Telecom & ISPs

**Market:** Azercell (~48%), Bakcell (~28%), Nar (~24%) + regional ISPs. Giants have big IT departments; regional ISPs don't.

**Pain points (regional ISPs):** outage communication, payment reminders, support tickets by phone, technician dispatch on paper, churn from silent dissatisfaction.

**Automation opportunities:** Telegram/WhatsApp self-service (balance, tariff, outage reports → tickets); payment-due cascades with PG links; technician dispatch with geo-routed WhatsApp tasks; outage blast messaging; churn-risk alerts from usage/payment data; NPS loops. For the big three: campaign orchestration and partner/dealer automation (sold as vendor projects).

- **Can n8n solve it?** YES for ISPs; PARTIALLY for MNO internals.
- **Integrations:** billing systems (custom DBs), TG, WA, SMS, PG, Wialon (fleet), LLM.
- **Difficulty:** Medium · **Dev time:** 3–6 weeks · **Revenue:** 400–1,200 AZN/mo per ISP · **Setup:** 2k–6k AZN · **Managed:** 400–1,200 AZN/mo.
- **Suitable for AZ?** Yes — dozens of regional ISPs, zero tooling vendors serving them → **Market Gap**.
- **Score:** 6.5/10 · **Priority:** Medium.

## 2.4 Private Clinics & Hospitals

**Market:** several hundred private institutions (182 inspected in H1 2026 alone); leaders Bona Dea, Baku Medical Plaza, MediClub, Referans; mandatory insurance (İTS) with ~69 private facilities contracted; booking is phone + Instagram DM + WhatsApp; doktortap.az exists but online booking penetration is low.

**Pain points:** reception overload (calls answered = revenue; missed = lost patient); no-shows with no reminder systems; no recall campaigns (huge lost LTV); results delivered by phone calls; insurance pre-auth document shuffling; multi-branch coordination; owner has no daily numbers.

**Existing process:** call center + paper/Excel schedules; Clintee (local clinic SaaS) has partial penetration; larger hospitals run HIS (Sisoft implemented one platform); marketing = Instagram ads answered manually.

**Automation opportunities:** WhatsApp/Instagram AI receptionist (FAQ, price list, booking, rescheduling) in AZ/RU; no-show killer cascades; recall engine (checkups, chronic care); lab-result notification with verified delivery; post-visit review funnel; insurance pre-auth checklists; daily owner digest; waitlist auto-fill of cancellations; patient intake forms.

- **Can n8n solve it?** YES — the entire communication/coordination layer; clinical records stay in HIS/Clintee (integrate, don't replace).
- **Integrations:** WA BSP, IG, LLM (AZ/RU), GCal or Clintee/HIS API, SMS, PG, PDF, Sheets.
- **Difficulty:** Medium · **Dev time:** 2–4 weeks first clinic, then days (templated) · **Revenue:** 300–800 AZN/mo per clinic; 200+ realistic targets in Baku → 60k–160k AZN/mo at 200 clients ceiling · **Setup:** 1k–3k AZN · **Managed:** 300–800 AZN/mo.
- **Suitable for AZ?** Excellent — high-margin businesses, direct revenue link (every recovered booking is cash), WhatsApp-native patients.
- **Competitors:** Clintee (management software, weak on conversational automation), AITOOLS.AZ/Tapla (generic chatbots). No clinic-specialized AI receptionist found → **Market Gap**.
- **Score:** 9/10 · **Priority:** Critical (beachhead vertical #1).

## 2.5 Dental Clinics

**Market:** fragmented into hundreds of small cabinets; Baku is a dental-tourism destination (prices 50–70% below Western Europe); İTS does not cover dental → fully private cash flows.

**Pain points:** identical to clinics plus: treatment-plan follow-through (patients abandon multi-visit plans), recall cycles (6-month cleanings almost never systematically triggered), dental-tourism inquiries in foreign languages at odd hours, deposits for long procedures.

**Automation opportunities:** all of 2.4 plus treatment-plan sequence automation (visit N complete → schedule N+1 → nudge until booked); dental-tourism funnel (EN/RU/AR inquiry bot → treatment quote → itinerary); deposit-protected bookings; before/after photo consent + review engine.

- **Can n8n solve it?** YES — same stack as clinics, tuned prompts and flows.
- **Integrations:** WA, IG, LLM, GCal, PG, SMS, PDF.
- **Difficulty:** Easy–Medium (templated after clinic build) · **Dev time:** days per clinic once templated · **Revenue:** 200–500 AZN/mo per cabinet, large count · **Setup:** 800–2k AZN · **Managed:** 200–500 AZN/mo.
- **Suitable for AZ?** Excellent — cash businesses, measurable ROI (one saved implant patient pays a year of service).
- **Competitors:** none specialized → **Market Gap**.
- **Score:** 8.5/10 · **Priority:** Critical (same motion as clinics).

## 2.6 Pharmacies & Private Labs

**Market:** pharmacy chains (Zeytun, A+ tier) + independents; labs dominated by Referans network (Synevo not present). Pharma manufacturing grew +81% in 2025.

**Pain points:** expiry/lot tracking, inter-branch stock imbalances, supplier reordering, prescription-customer recall (chronic meds), lab-result delivery by phone, corporate client (clinic) reporting.

**Automation opportunities:** expiry/stock sentinels with reorder drafts; chronic-refill reminder service (huge retention play: "your blood-pressure meds run out in 3 days — reply 1 to reserve"); result-ready notifications with secure retrieval; B2B ordering bots for clinics ordering from labs; daily multi-branch sales digests.

- **Can n8n solve it?** YES — on top of 1C/pharmacy DBs; PARTIALLY where regulations require validated systems.
- **Integrations:** 1C/DB, WA, SMS, TG, LLM, Sheets.
- **Difficulty:** Medium · **Dev time:** 3–6 weeks · **Revenue:** 300–1,000 AZN/mo per chain · **Setup:** 2k–5k AZN · **Managed:** 300–1,000 AZN/mo.
- **Suitable for AZ?** Yes; chains are consolidated enough to pay.
- **Competitors:** none found for the communication layer → **Market Gap**.
- **Score:** 7/10 · **Priority:** Medium-High.

## 2.7 Beauty Salons & Barbershops

**Market:** thousands in Baku (informality receding — cash registers mandatory since 2022); booking is Instagram DM + WhatsApp + phone, near-universally manual; no dominant local Fresha/Booksy; Altegio present but shallow.

**Pain points:** DMs answered between clients (hours of delay → lost bookings); no-shows unpunished and unreminded; no rebooking prompts (a 4-week color client left unprompted books elsewhere); zero customer database; masters leave and take clients.

**Automation opportunities:** IG/WA booking bot with master/service selection; no-show cascades + deposits for premium slots; rebooking engine by service cycle; birthday/holiday campaigns; review funnels; referral rewards; owner daily digest; win-back for 60-day-absent clients.

- **Can n8n solve it?** YES — entirely.
- **Integrations:** IG, WA, LLM, GCal/Altegio, PG, SMS.
- **Difficulty:** Easy–Medium (highly templatable) · **Dev time:** 1–2 weeks template, hours per install · **Revenue:** 100–300 AZN/mo per salon — volume play (thousands of targets) · **Setup:** 300–800 AZN · **Managed:** 100–300 AZN/mo.
- **Suitable for AZ?** Perfect fit for the Instagram-economy; price must stay low; sell via Instagram itself with demo videos.
- **Competitors:** Altegio (booking software, not conversational), generic chatbot micro-agencies → **near-Market Gap** for the full automation pack.
- **Score:** 8/10 · **Priority:** High (volume beachhead #2; watch churn at low price points).

## 2.8 Fitness Centers

**Market:** Baku-centric: World Class, Gold's Gym, OLIMP chain, independents at ~25 AZN/mo → premium 120+ AZN/mo.

**Pain points:** membership renewals lapse silently; class no-shows; lead follow-up from Instagram ads; frozen-membership admin; PT session scheduling; churn invisible until it happened.

**Automation opportunities:** renewal dunning with PG links; class booking bot with capacity + waitlists; visit-frequency churn alarms ("member hasn't visited in 14 days → win-back sequence"); PT scheduling; new-lead trial funnels; referral programs.

- **Can n8n solve it?** YES.
- **Integrations:** membership DB/Sheets, WA, IG, PG, LLM, turnstile/access system exports where available.
- **Difficulty:** Easy–Medium · **Dev time:** 1–3 weeks · **Revenue:** 200–600 AZN/mo per club · **Setup:** 800–2.5k AZN · **Managed:** 200–600 AZN/mo.
- **Suitable for AZ?** Yes — recurring-revenue businesses understand paying for retention.
- **Competitors:** none specialized → **Market Gap**.
- **Score:** 7/10 · **Priority:** Medium-High.

## 2.9 Hotels & Guesthouses

**Market:** 859 hotels/31,750 rooms nationally; Baku occupancy 39.3%; revenue +42% in 2024; 2.6M foreign arrivals (+26%) — tourism boom. International chains run Opera/Fidelio (Medya Turk supports Fidelio locally); small/mid hotels run Excel + OTA extranets.

**Pain points:** OTA commissions (15–20%) on bookings that begin as direct WhatsApp/IG inquiries answered too slowly; review responses neglected; pre-arrival upsells nonexistent; group/event inquiries handled ad hoc; nightly reconciliation of OTA payouts.

**Automation opportunities:** direct-booking rescue bot (instant quote + deposit link on WA/IG); guest journey messaging (pre-arrival → in-stay requests → late-checkout upsell → review ask); OTA review aggregation with LLM reply drafts; event/banquet lead pipelines; OTA payout reconciliation; housekeeping/maintenance task routing from guest messages.

- **Can n8n solve it?** YES for small/mid hotels; PARTIALLY for chains (PMS integration depth).
- **Integrations:** WA, IG, LLM, PMS exports/Fidelio, channel managers, PG, PDF, Sheets.
- **Difficulty:** Medium · **Dev time:** 3–5 weeks · **Revenue:** 300–1,000 AZN/mo per hotel · **Setup:** 1.5k–4k AZN · **Managed:** 300–1,000 AZN/mo.
- **Suitable for AZ?** Yes — tourism growth + measurable OTA-commission savings make the pitch concrete ("one rescued direct booking/week pays for us").
- **Competitors:** none local for guest-messaging automation → **Market Gap** (international tools like HiJiffy exist but no AZ language/presence).
- **Score:** 7.5/10 · **Priority:** High.

## 2.10 Restaurants, Cafes & Coffee Shops

**Market:** thousands of outlets; ~50% sole-proprietor run; POS landscape: Clopos (local, 1,200+ venues), iiko (OPTIMA), R-Keeper; delivery duopoly Wolt + Bolt Food (+Yango); Baku F&B turnover ~855M AZN.

**Pain points:** reservation chaos on phone/DM; delivery-aggregator reconciliation (commissions, refunds) done by hand; no guest database or loyalty; supplier ordering by phone each morning; owner blind on daily P&L; staffing gaps on sick days.

**Automation opportunities:** reservation bot with deposits for groups; loyalty/birthday engine from POS data; Wolt/Bolt payout reconciliation vs POS; daily P&L snapshot (Clopos/iiko APIs); supplier par-level ordering; review funnels; menu-engineering monthly reports; shift-filler broadcasts.

- **Can n8n solve it?** YES — Clopos/iiko have APIs; aggregator reconciliation via report parsing.
- **Integrations:** Clopos/iiko API, WA, IG, LLM, PG, Sheets, Wolt/Bolt merchant reports.
- **Difficulty:** Easy–Medium · **Dev time:** 2–4 weeks per pack · **Revenue:** 150–500 AZN/mo per venue; chains 500–2,000 · **Setup:** 500–2k AZN · **Managed:** 150–500 AZN/mo.
- **Suitable for AZ?** Yes — huge count; partner with Clopos ecosystem for distribution (they have the POS relationship, you add the automation layer).
- **Competitors:** POS vendors' built-ins (partial); no automation specialist → **Market Gap** for the layer above POS.
- **Score:** 7.5/10 · **Priority:** High.

## 2.11 Retail Chains & Supermarkets

**Market:** Bravo (~135 stores), Araz (largest count), OBA, Bazarstore, Rahat (ANC), AL Market; electronics: Kontakt Home, Baku Electronics, İrşad (strong installment sales).

**Pain points:** inter-branch stock imbalance; supplier price-list churn (Excel/PDF ingestion); shelf-price vs system mismatches; promo execution across branches; customer complaints scattered across channels; POS-vs-bank reconciliation per store; installment-sales document flows (electronics).

**Automation opportunities:** supplier price-list ingestion with diff alerts; multi-store stock consolidation + transfer suggestions; daily per-branch cash-up reconciliation (POS vs card settlements vs bank via open banking); promo-compliance checklists with photo verification via WhatsApp; complaint routing; loyalty campaign engines; installment-application document automation.

- **Can n8n solve it?** YES for data/messaging layers; PARTIALLY where deep ERP (1C, SAP-like) writes are needed.
- **Integrations:** 1C/ERP, POS exports, OB, WA, SMS, OCR, Sheets, LLM.
- **Difficulty:** Medium–Hard · **Dev time:** 1–3 months · **Revenue:** 1k–5k AZN/mo per chain · **Setup:** 5k–25k AZN · **Managed:** 1k–5k AZN/mo.
- **Suitable for AZ?** Yes — chains are consolidated, professionally managed, and measurable-savings-driven.
- **Competitors:** 1C integrators (Optima, ICGROUP, ESC) own the ERP relationship; nobody owns the orchestration layer → **partial Market Gap**.
- **Score:** 7/10 · **Priority:** Medium-High.

## 2.12 E-commerce & Marketplace Sellers

**Market:** ~$1.3–1.7B, doubling by 2027; WooCommerce dominates (~58% of tracked stores); Trendyol AZ (2M customers) + Birmarket/Umico (1,000+ sellers, 10K daily orders) + Tap.az; parcel-forwarding culture (Starex, Camex); COD still common.

**Pain points:** order confirmation calls; COD fake orders; "sifarişim harada?" support volume; multi-marketplace stock sync; abandoned carts ignored (email dead in AZ — WhatsApp is the channel); courier dispatch decisions; returns chaos; sellers on Trendyol needing Turkish-entity operations support.

**Automation opportunities:** WhatsApp order-confirmation suite; COD verification bot; abandoned-cart WA rescue; order-status self-service; courier routing + tracking updates; marketplace order aggregation & stock sync; supplier feed ingestion; fraud flags; review harvesting; e-qaimə prep for B2B sellers.

- **Can n8n solve it?** YES — WooCommerce webhooks + WA + PG are native n8n territory; marketplace APIs partially (some scraping).
- **Integrations:** WooCommerce, WA, PG (Epoint/Payriff/Kapital PG), courier APIs, Sheets/Postgres, LLM, marketplace APIs/scrapers.
- **Difficulty:** Easy–Medium · **Dev time:** template pack 2–3 weeks; installs in days · **Revenue:** 150–600 AZN/mo per store; thousands of targets · **Setup:** 500–2k AZN · **Managed:** 150–600 AZN/mo.
- **Suitable for AZ?** Excellent — fastest-growing sector, digitally literate owners, WhatsApp-native buyers.
- **Competitors:** none packaged locally → **Market Gap** (global tools exist but no AZ payments/couriers/language support).
- **Score:** 8.5/10 · **Priority:** Critical (beachhead vertical #3).
