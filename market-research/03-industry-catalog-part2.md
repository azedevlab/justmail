# 3. Industry Automation Catalog — Part 2 (Logistics → Coworking)

---

## 3.1 Logistics, Cargo & Freight Forwarding

**Market:** Middle Corridor boom — Port of Baku ~105K TEU in 2025 (+37%), 350 China block trains (+34%), ADY/port merged Feb 2025; ~19–30 international forwarders + many domestic haulers; Wialon (via GPS.AZ) dominates telematics.

**Pain points:** quote turnaround (rate lookups by phone/email lose deals); shipment status questions consume dispatchers; document packs (invoice, CMR, certificates) chased over WhatsApp; container tracking across carriers manual; driver task communication by phone; COD/cash settlement with drivers.

**Existing process:** Excel + phone + WhatsApp + email; telematics for tracking but disconnected from customer communication; the big forwarders have TMS, the rest don't.

**Automation opportunities:** freight-quote responder (parse inquiry → rate table → PDF quote → follow-up); shipment milestone broadcaster to customers; doc-pack assembler with missing-doc nagging; container tracking consolidator; Wialon event → dispatcher alerts + client ETAs; driver WhatsApp task sheets with photo POD; weekly Middle-Corridor rate/news intel digest (sellable standalone).

- **n8n?** YES — orchestration and comms; TMS replacement no.
- **Integrations:** Wialon API, WA, TG, LLM, OCR, PDF, Sheets/Postgres, shipping-line APIs/scrapers, SMTP.
- **Difficulty:** Medium · **Dev time:** 4–8 weeks · **Revenue:** 500–2,000 AZN/mo per forwarder · **Setup:** 3k–10k AZN · **Managed:** 500–2,000 AZN/mo.
- **AZ fit:** Excellent — sector riding a structural boom with rising cargo volumes and staff shortages.
- **Competitors:** GPS.AZ (telematics only); no comms/ops automation provider → **Market Gap**.
- **Score:** 8/10 · **Priority:** High.

## 3.2 Courier & Parcel-Forwarding Companies

**Market:** Starex, Camex (Turkey/US/China forwarding — a mass consumer habit), local last-mile couriers, Azərpoçt modernizing.

**Pain points:** "Where is my package?" support floods (customs, arrival, address changes); COD reconciliation per courier; failed-delivery rescheduling; customs-declaration guidance for customers (Smart Customs).

**Automation opportunities:** tracking self-service bots; proactive milestone notifications (arrived at customs / at pickup point); failed-delivery auto-reschedule; COD settlement reconciliation; customer customs-declaration helper (guides through e.customs.gov.az steps); driver route sheets.

- **n8n?** YES.
- **Integrations:** internal tracking DBs, WA, TG, SMS, LLM, Sheets, OB.
- **Difficulty:** Medium · **Dev time:** 3–6 weeks · **Revenue:** 800–3,000 AZN/mo (these are volume businesses) · **Setup:** 3k–8k AZN · **Managed:** 800–3,000 AZN/mo.
- **AZ fit:** Yes — support-cost reduction is directly measurable in operator headcount.
- **Competitors:** in-house tools at Starex/Camex tier; nothing for smaller players → **partial Market Gap**.
- **Score:** 7/10 · **Priority:** Medium-High.

## 3.3 Customs Brokers

**Market:** 260+ registered customs representatives; declarations electronic since 2016 (customs.gov.az e-system, Smart Customs), but broker workflow = document collection by WhatsApp/email + manual HS-code classification + re-keying into the customs system + status calls.

**Pain points:** chasing importers for documents; HS-code lookups; duty calculations quoted by phone; per-shipment status updates; document archives unsearchable.

**Automation opportunities:** client document-intake bot with checklist enforcement; OCR extraction of invoice/CMR data into declaration-ready fields; HS-code suggestion agent (LLM + tariff DB, broker confirms); duty auto-calculator quotes; status notification flows; searchable shipment archive.

- **n8n?** YES for pre-processing and comms; the final declaration submission stays in the customs system (broker reviews & submits — keeps liability clear).
- **Integrations:** OCR/LLM, WA, SMTP, Sheets/Postgres, PDF, customs duty calculators, Drive/S3.
- **Difficulty:** Hard (domain depth) · **Dev time:** 6–10 weeks · **Revenue:** 400–1,500 AZN/mo per broker firm · **Setup:** 3k–8k AZN · **Managed:** 400–1,500 AZN/mo.
- **AZ fit:** Strong — 260+ firms all doing identical repetitive work; trade volumes rising.
- **Competitors:** none found → **Market Gap**.
- **Score:** 7.5/10 · **Priority:** High.

## 3.4 Construction Companies & Developers (incl. MTK)

**Market:** +4.7% output growth; Baku housing prices +15% YoY; MTK (cooperative) new-build model dominant with notorious document/paperwork problems; sales offices run on Excel + phone + Instagram ads.

**Pain points:** sales-lead leakage from ads; unit availability tracked in Excel; buyer document packs (contracts, payment schedules, çıxarış/title steps) manual; subcontractor acts-of-work and retention tracking; daily site reporting nonexistent; material RFQs by phone; tender discovery on etender.gov.az done by hand or paid aggregators.

**Automation opportunities:** developer sales funnel (ad → qualification → unit sheet → quote PDF → CRM stages → contract generation); buyer payment-schedule dunning; construction daily site reports (foreman WhatsApp photos → LLM-compiled PDF); subcontractor payment/approval workflows; material RFQ blaster with quote comparison; tender watcher with fit scoring.

- **n8n?** YES for sales/document/reporting layers; project-management depth (scheduling, BIM) no.
- **Integrations:** Meta Ads, WA, LLM, PDF, B24, Sheets, OCR, etender scraping, GCal.
- **Difficulty:** Medium · **Dev time:** 4–8 weeks · **Revenue:** developers 800–3,000 AZN/mo; contractors 300–1,000 · **Setup:** 3k–12k AZN · **Managed:** 300–3,000 AZN/mo.
- **AZ fit:** Yes — sales funnels for developers have immediate revenue attribution; construction back office is greenfield.
- **Competitors:** B24 integrators generically; no vertical specialist → **Market Gap**.
- **Score:** 7.5/10 · **Priority:** High.

## 3.5 Real Estate Agencies & Property Management

**Market:** ~72K active bina.az listings, 71% agency-posted; hundreds of unlicensed agencies; no MLS; workflow = bina.az + Instagram + phone/WhatsApp; commissions ~1 month rent / ~1%.

**Pain points:** listing double-entry (bina.az, IG, TG channels); buyer-criteria matching by memory; viewing scheduling ping-pong; stale/duplicate listings; zero post-viewing follow-up; landlord reporting absent; rent collection manual for property managers.

**Automation opportunities:** listing syndicator; buyer-listing matchmaker with instant WA alerts; viewing scheduler with reminders + feedback capture; lead qualification bots on IG/WA; rent-collection autopilot (invoices, PG links, dunning, landlord statements); tenant request desks for property/facility managers.

- **n8n?** YES.
- **Integrations:** WA, IG, TG, LLM, Sheets/Postgres, PG, PDF, GCal, bina.az posting flows (semi-automated).
- **Difficulty:** Easy–Medium · **Dev time:** 2–4 weeks · **Revenue:** agencies 150–500 AZN/mo; property managers 300–1,000 · **Setup:** 500–2k AZN · **Managed:** 150–1,000 AZN/mo.
- **AZ fit:** Yes — high listing volumes, commission-driven urgency; price-sensitive though.
- **Competitors:** none specialized → **Market Gap**.
- **Score:** 7/10 · **Priority:** Medium-High.

## 3.6 Manufacturing & Industrial SMEs

**Market:** manufacturing = 32% of industrial output; non-oil industry +5.5%; Sumgait Chemical Industrial Park (39–40 residents) + Aghdam/Pirallahi/Garadagh/Mingachevir parks; fast-growing pharma (+81%), textiles (+27%), wood (+88%).

**Pain points:** order intake by phone/email re-keyed into 1C; production scheduling in Excel; dealer/distributor communication manual; quality/maintenance logs on paper; procurement RFQs slow; export documentation repetitive.

**Automation opportunities:** B2B order intake bots (dealer Telegram portal → 1C order drafts); production daily reports; maintenance-schedule alerts with photo confirmation; procurement RFQ automation; export doc packs; energy/utility anomaly monitoring; safety-training compliance tracking.

- **n8n?** YES for information flows around 1C/LOGO/Mikro ERP; machine-level automation (SCADA) no — but alert bridging from existing systems yes.
- **Integrations:** 1C/LOGO/Mikro, TG, WA, Sheets, OCR, LLM, SMTP, sensors/webhooks where present.
- **Difficulty:** Medium–Hard · **Dev time:** 6–12 weeks · **Revenue:** 500–2,500 AZN/mo per plant · **Setup:** 4k–15k AZN · **Managed:** 500–2,500 AZN/mo.
- **AZ fit:** Yes — government pushing non-oil industry; factories understaffed on office side.
- **Competitors:** 1C integrators (ERP-centric); MSOFT (Mikro-linked mobile sales) — closest analog; orchestration layer open → **partial Market Gap**.
- **Score:** 6.5/10 · **Priority:** Medium.

## 3.7 Oil & Gas Services / SOCAR Contractors

**Market:** SOCAR ecosystem (SAP since 2008, own e-procurement portal + Ariba in JVs); service JVs (SOCAR AQS, SOCAR-KBR, Petrofac, McDermott); BP/ACG supplier tier of EPC subcontractors.

**Pain points (contractor side):** tender/RFQ monitoring across SOCAR e-procurement + Ariba + etender; prequalification document packs (certificates, HSE records) reassembled per bid; personnel certification expiry tracking (critical for site access); timesheet/mobilization paperwork; HSE incident reporting.

**Automation opportunities:** multi-portal tender watcher; bid-pack assembler; certification/training expiry registry with renewal workflows; crew mobilization checklists; timesheet collection via WhatsApp; HSE report compilation.

- **n8n?** YES for contractor back offices; SOCAR-internal projects are enterprise sales requiring partners.
- **Integrations:** e-procurement portals (scrape/RPA), OCR, Sheets, WA, PDF, GCal, LLM.
- **Difficulty:** Medium (contractors) / Enterprise (operators) · **Dev time:** 4–8 weeks · **Revenue:** 500–2,000 AZN/mo per contractor · **Setup:** 3k–10k AZN · **Managed:** 500–2,000 AZN/mo.
- **AZ fit:** Yes — deep pockets, compliance-driven, document-heavy.
- **Competitors:** none at this layer → **Market Gap**.
- **Score:** 7/10 · **Priority:** Medium-High.

## 3.8 Government & Municipalities (B2G)

**Market:** strong central digitalization (ASAN 400+ services, MyGov, DOST centers, e-court); 685 municipalities post-consolidation, weak/underfunded; procurement via etender.gov.az (mandatory above 50K AZN, e-Contract mandatory from Apr 2026); delivery dominated by SINAM, ATL Tech, Professional IT, AzInTelecom.

**Pain points:** inter-agency data flows outside Digital Bridge; municipal citizen requests untracked; document processing backlogs; call-center loads (DOST 142 handles ~5,000 calls/day).

**Automation opportunities (as subcontractor/vendor):** citizen-notification workflows; internal document routing; report compilation; call-deflection assistants; municipal request desks (WhatsApp → tracked tickets). Realistically enter via prime contractors (SINAM/ATL) or the innovation agencies (IDDA, 4SİM) rather than direct.

- **n8n?** PARTIALLY — capability yes; procurement, security certification, and incumbent relationships are the barriers.
- **Difficulty:** Enterprise · **Dev time:** 3–12 months · **Revenue:** project 20k–300k AZN · **AZ fit:** long-cycle; pursue opportunistically in Phase 3+.
- **Competitors:** SINAM, ATL Tech, B.EST Solutions, AzInTelecom — entrenched.
- **Score:** 5/10 · **Priority:** Low (early), Medium (Phase 3+).

## 3.9 Accounting Firms ⭐

**Market:** outsourced bookkeeping is the norm for SMEs and foreign rep-offices (ABCC, Caspian Legal Center, ALC, BDO, Grant Thornton, Baker Tilly + hundreds of independents). Workflow: BTP desktop software → e-taxes.gov.az portal uploads, monthly/quarterly per client; e-qaimə XML for every B2B sale; Asan İmza/SİMA signing.

**Pain points (goldmine — one firm serves 20–100 clients, so every automation multiplies):** collecting client documents monthly (bank statements, invoices, contracts) via WhatsApp with endless nagging; deadline tracking across dozens of clients; e-qaimə issuance/receipt processing; manual entry from receipts into 1C; salary/DSMF calculations; client status questions ("did you file mine?"); price-quote generation for new clients.

**Automation opportunities:** client document-collection bot (monthly checklist per client, auto-nag, sorted folders); tax-calendar guardian with per-client checklists; receipt/invoice OCR into 1C-ready entries; e-qaimə inbox watcher (parse incoming XML, categorize); bank-statement auto-fetch via open banking; client self-service status bot; payroll prep automation; new-client onboarding (VÖEN lookup, contract generation, SİMA signing).

- **n8n?** YES — this is the killer B2B2B vertical: sell to one accountant, automate 50 companies.
- **Integrations:** WA, e-taxes/BTP flows (file-level + RPA), OB, 1C, OCR/LLM, Sheets, PDF, SİMA.
- **Difficulty:** Medium–Hard · **Dev time:** 6–10 weeks for the pack · **Revenue:** 300–1,500 AZN/mo per firm (scales with client count) · **Setup:** 2k–6k AZN · **Managed:** 300–1,500 AZN/mo.
- **AZ fit:** Outstanding — universal monthly compliance cycle, standardized by the state, painful, and every business in the country is downstream of it. Accountants also become your **referral channel** into every other vertical.
- **Competitors:** none found → **Market Gap** (BTP/e-taxes tooling is purely governmental; nobody automates around it).
- **Score:** 9/10 · **Priority:** Critical (beachhead vertical #4 and channel play).

## 3.10 Law Firms & Legal

**Market:** only 2,836 licensed advocates nationally; boutique business-law firms in Baku; e-court fully digital (e-filing, e-cabinet, SMS notifications); Mobile Notary app + SİMA integration.

**Pain points:** hearing/deadline tracking; document drafting from precedents; time capture for billing; client updates; regulatory change monitoring; conflict checks.

**Automation opportunities:** court-event tracker → calendar + client notifications; contract intake + deadline docket (OCR); document assembly with SİMA e-sign; regulatory watch digests (e-qanun.az); Telegram time-loggers → invoices; client intake + KYC/conflict screening.

- **n8n?** YES; e-court integration is RPA-level (no public API) — feasible but fragile, keep human review.
- **Difficulty:** Medium · **Dev time:** 4–6 weeks · **Revenue:** 300–1,000 AZN/mo per firm · **Setup:** 1.5k–4k AZN · **Managed:** 300–1,000 AZN/mo.
- **AZ fit:** Good but small market (thousands of practitioners, hundreds of firms) — solid niche, not a growth engine.
- **Competitors:** none → **Market Gap**.
- **Score:** 6.5/10 · **Priority:** Medium.

## 3.11 Car Dealerships & Auto Services

**Market:** new-car sales +114% in 2025 (69,832 units), Chinese brands ≥68%; 227 dealers (172 in Baku); Turbo.az dominant for used; fragmented service/detailing sector; compulsory TPL via ISB.

**Pain points:** lead response from Turbo.az/Instagram slow; test-drive scheduling; service-appointment booking by phone; service-history recalls (oil change reminders) absent; insurance renewal cross-sell missed; trade-in valuations ad hoc; parts inquiries by phone.

**Automation opportunities:** lead-response bots with model info/quote PDFs; test-drive scheduling; service booking + bay capacity; service recall engine (date/km-based); insurance renewal reminders (cross-sell with brokers); post-service review funnels; parts-inquiry bots; new-Chinese-brand launch campaign automation.

- **n8n?** YES.
- **Integrations:** WA, IG, LLM, GCal, B24, SMS, PDF, DMS/1C where present.
- **Difficulty:** Medium · **Dev time:** 3–5 weeks · **Revenue:** dealers 400–1,500 AZN/mo; services 150–400 · **Setup:** 1k–4k AZN · **Managed:** 150–1,500 AZN/mo.
- **AZ fit:** Excellent timing — dealer count and sales exploding with Chinese-brand entry; new dealers need infrastructure fast.
- **Competitors:** none specialized → **Market Gap**.
- **Score:** 7.5/10 · **Priority:** High.

## 3.12 Travel Agencies

**Market:** 381 agencies (+27% YoY), revenue 166M AZN (doubled); sell via Instagram + WhatsApp explicitly ("WhatsApp is the fastest way to book"); outbound to Türkiye, Georgia, UAE, Iran; AZAL pushing self-service.

**Pain points:** inquiry overload in season; quote assembly (hotel+flight+transfer) manual; payment collection informal; pre-departure document reminders (passport, visa) manual; zero post-trip re-marketing.

**Automation opportunities:** inquiry qualification bot (destination, dates, budget → structured request); quote templates with PDF itineraries; deposit/payment links + dunning; pre-departure checklist sequences; flight-change notifications; post-trip review + next-season campaigns; group-tour seat management.

- **n8n?** YES.
- **Integrations:** WA, IG, LLM, PDF, PG, Sheets, GCal, SMTP.
- **Difficulty:** Easy–Medium · **Dev time:** 2–3 weeks (highly templatable) · **Revenue:** 150–500 AZN/mo per agency · **Setup:** 500–1.5k AZN · **Managed:** 150–500 AZN/mo.
- **AZ fit:** Very good — fast-growing, seasonal pain spikes, WhatsApp-native by admission.
- **Competitors:** none → **Market Gap**.
- **Score:** 7.5/10 · **Priority:** High.

## 3.13 Universities & Schools

**Market:** 52 HEIs (220K students), few dozen private schools (growing: 8 new in 2024/25), state systems dominate school admin (e-mekteb, mektebeqebul.edu.az); no notable private school-management SaaS.

**Pain points (private schools/HEIs):** admissions funnels (open days, applications, document collection); tuition invoicing/dunning; parent communication; alumni relations; certificate issuance.

**Automation opportunities:** admissions CRM funnels; tuition payment autopilot; parent notification hub; document collection bots; event management; alumni campaigns.

- **n8n?** YES.
- **Difficulty:** Medium · **Dev time:** 3–6 weeks · **Revenue:** 300–1,500 AZN/mo per institution · **Setup:** 2k–6k AZN · **Managed:** 300–1,500 AZN/mo.
- **AZ fit:** Good but limited count; private-school growth helps.
- **Competitors:** state systems (public), none for private ops → **Market Gap**.
- **Score:** 6/10 · **Priority:** Medium.

## 3.14 Training Centers & Private Tutors ⭐

**Market:** large and informal: CELT (16 centers), Zirvə, Zəka, BANİ, ILC, KMT + thousands on kurslar.az; abituriyent (entrance-exam) prep is the anchor; 20–240 AZN/month per subject; enrollment via walk-in/phone/Instagram; no local course-management SaaS found.

**Pain points:** inquiry-to-trial conversion untracked; monthly cash collection + debt lists; attendance → parent communication absent; group formation (matching level/schedule) manual; teacher payroll by attendance; student churn invisible.

**Automation opportunities:** inquiry → trial → enrollment funnel with payments; tuition reminder + debt escalation; absence alerts to parents; progress reports; group-fill optimizer; churn predictor with save-offers; certificate generation; alumni upsell (next level).

- **n8n?** YES — full stack.
- **Integrations:** WA, IG, LLM, PG, Sheets, PDF, GCal.
- **Difficulty:** Easy–Medium · **Dev time:** 2–4 weeks template · **Revenue:** 100–400 AZN/mo per center; big chains 500–1,500 · **Setup:** 500–2k AZN · **Managed:** 100–400 AZN/mo.
- **AZ fit:** Excellent — parents pay monthly, retention = revenue, centers compete on service; white-space confirmed (no local EduCRM).
- **Competitors:** none → **Market Gap**.
- **Score:** 8/10 · **Priority:** Critical (beachhead vertical #5 — huge count, simple sale).

## 3.15 Media, SMM & Marketing Agencies

**Market:** 20+ SMM agencies in Baku (retainers 500–5,000 AZN/mo), influencer market $8.3M; agencies sell content plans, ads, community management.

**Pain points:** client reporting eats days monthly; content production bottlenecks; lead handover to clients unmeasured; influencer ROI untracked.

**Automation opportunities (sell TO agencies — they resell to their clients):** auto client reports (branded PDFs); AI content pipelines with approval flows; ad-lead → client CRM pipes with attribution; influencer promo-code tracking; review/reputation monitoring as a service. **Agencies are also a channel:** white-label your chatbot/automation stack to them.

- **n8n?** YES.
- **Difficulty:** Easy–Medium · **Dev time:** 2–4 weeks · **Revenue:** 200–800 AZN/mo per agency + white-label licensing · **Setup:** 1k–3k AZN · **Managed:** 200–800 AZN/mo.
- **AZ fit:** Very good — agencies understand recurring fees and can become resellers.
- **Competitors:** global tools (no AZ localization) → **partial Market Gap**.
- **Score:** 7.5/10 · **Priority:** High (dual product + channel value).

## 3.16 Call Centers & BPO

**Market:** thin outsourced-BPO sector (HRC, Intercomp, 2Max, Teleperformance since 2014); large in-house centers at banks (Kapital 196), telecoms, AZAL, DOST 142 (~5,000 calls/day); operator salary ~400–700 AZN/mo.

**Pain points:** volume of repetitive calls; QA sampling covers <5% of calls; agent onboarding; after-call work (summaries, dispositions).

**Automation opportunities:** AI call-QA (100% of recordings scored vs script/compliance); after-call summarization into CRM; WhatsApp deflection bots in front of voice lines; voice AI for outbound reminders/confirmations; workforce scheduling alerts.

- **n8n?** YES with STT/LLM stack; voice agents via Vapi/Retell-class platforms orchestrated by n8n.
- **Difficulty:** Hard · **Dev time:** 6–12 weeks · **Revenue:** 1k–5k AZN/mo per center · **Setup:** 5k–20k AZN · **Managed:** 1k–5k AZN/mo.
- **AZ fit:** Good — Azerbaijani-language STT quality is the technical risk to validate early; huge value if solved (nobody local offers call QA).
- **Competitors:** Whelp (omnichannel inbox, chatbot ~60% deflection) — the one serious local adjacent player; none on call-QA → **partial Market Gap**.
- **Score:** 7/10 · **Priority:** Medium-High.

## 3.17 IT Companies, MSPs & Dev Agencies

**Market:** dozens of agencies (dev rates $9–21/hr), MSP practices immature; ICT sector ~$2.3B with state-fueled growth targets.

**Pain points:** client uptime monitoring ad hoc; ticket intake via WhatsApp untracked; monthly client reporting; backup verification; deploy communications.

**Automation opportunities:** full MSP-in-a-box: uptime/SSL sentinels, WhatsApp helpdesk front-end → Jira, backup verification loops, per-client monthly PDF reports, incident war-rooms, patch/CVE feeds. Sell as tooling to agencies (they lack ops maturity) or use internally to run your own managed-automation business.

- **n8n?** YES — natively.
- **Difficulty:** Easy–Medium · **Dev time:** 2–4 weeks · **Revenue:** 200–800 AZN/mo per MSP/agency · **Setup:** 1k–3k AZN · **Managed:** 200–800 AZN/mo.
- **AZ fit:** Good; also doubles as your own internal stack.
- **Competitors:** global tools unlocalized → **partial Market Gap**.
- **Score:** 6.5/10 · **Priority:** Medium.

## 3.18 NGOs

**Market:** modest, donor-funded; reporting-heavy (donor compliance).

**Automation opportunities:** donor report compilation; beneficiary registration/tracking via WhatsApp; volunteer coordination; grant-deadline watchers.
- **n8n?** YES · **Difficulty:** Easy · **Revenue:** low (100–300 AZN/mo, grant-dependent) · **AZ fit:** marginal commercially.
- **Score:** 4/10 · **Priority:** Low.

## 3.19 Security, Cleaning & Facility Companies

**Market:** fragmented B2B services with large field workforces.

**Pain points:** shift attendance verification; site incident logging; client reporting; contract renewals; guard/cleaner dispatch.

**Automation opportunities:** WhatsApp geo check-in timesheets; alarm/CCTV event routing to guards with escalation; site inspection checklists with photos; monthly client service reports; contract renewal radar.
- **n8n?** YES · **Difficulty:** Easy–Medium · **Dev time:** 2–4 weeks · **Revenue:** 200–800 AZN/mo per firm · **Setup:** 800–2.5k AZN.
- **AZ fit:** Good — labor-heavy firms feel timesheet fraud directly. **Market Gap.**
- **Score:** 6.5/10 · **Priority:** Medium.

## 3.20 Property Management, Coworking & Business Centers

**Market:** growing Baku segment (business centers, coworkings, MTK building managers).

**Pain points:** tenant requests via calls; rent/fee collection; utility pass-through billing; meeting-room booking; access management.

**Automation opportunities:** tenant WhatsApp request desk → work orders; rent autopilot with dunning; utility bill fetch + allocation (Azerishiq/Azersu/Azeriqaz portals); room booking bots; move-in/out checklists.
- **n8n?** YES · **Difficulty:** Medium · **Revenue:** 300–1,000 AZN/mo · **Setup:** 1.5k–4k AZN.
- **AZ fit:** Good. **Market Gap.**
- **Score:** 6.5/10 · **Priority:** Medium.

---

### Cross-industry verdict

Out of 30+ industries examined, **the recurring formula is identical**: Instagram/WhatsApp inbox → structured data → calendar/payment/ERP action → proactive lifecycle messaging → owner digest. One core engine, vertical skins. The five beachheads (clinics, dental, e-commerce, accountants, training centers) share 80% of the same workflow DNA, which is exactly what makes an n8n template business compound.
