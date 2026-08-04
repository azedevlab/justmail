# 6. n8n Template Marketplace — 215 Workflow Templates for the Azerbaijan Market

Design for a template marketplace: sellable individually (one-time), bundled into vertical "packs," delivered as managed services, or hosted as multi-tenant SaaS products.

**Column legend:** Diff = Difficulty (E=Easy, M=Medium, H=Hard, X=Enterprise). Sell = can be sold as **T**emplate / **M**anaged service / **S**aaS (✔ or –).
**Integration shorthand:** WA = WhatsApp Business API (via BSP: 360dialog/Twilio/Meta Cloud API), IG = Instagram Messaging API, TG = Telegram Bot API, SMS = local SMS gateway (1sms.az / Mobis / Nar bulk SMS), LLM = OpenAI/Claude/Gemini (Azerbaijani+Russian prompts), Sheets = Google Sheets, GCal = Google Calendar, B24 = Bitrix24, PG = payment gateway (Kapital PG / Epoint / Payriff), e-taxes = e-taxes.gov.az portal/e-qaimə flows, OB = Open Banking APIs (api.birbank.business etc.), PDF = PDF generation node, OCR = vision-LLM OCR.

> Pricing guidance for the marketplace: simple templates 50–150 AZN one-time; vertical packs 300–900 AZN; managed service setups per chapter 5 pricing. All conversational templates must ship with Azerbaijani + Russian prompt/localization files.

---

## 6.1 AI Receptionist & Booking (16 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 1 | WhatsApp AI Receptionist — Clinic | Answers FAQs (prices, hours, doctors), books/reschedules appointments, sends reminders in AZ/RU | WA inbound message | LLM intent → slot lookup → booking → confirmation + reminder | WA, LLM, GCal/Clintee, SMS | Private clinics, dentists | M | ✔/✔/✔ |
| 2 | WhatsApp AI Receptionist — Beauty Salon | Same flow tuned for salons: master selection, service menu, deposits | WA inbound | LLM → calendar → optional deposit link | WA, LLM, GCal/Altegio, PG | Salons, barbershops | M | ✔/✔/✔ |
| 3 | Instagram DM Booking Bot | Converts IG DMs ("qiymət neçədir?") into bookings without human reply | IG DM webhook | LLM reply → booking link/slot booking → CRM log | IG, LLM, GCal, Sheets/B24 | All appointment businesses | M | ✔/✔/✔ |
| 4 | No-Show Killer | Reminder cascade: T-24h WhatsApp, T-3h SMS, unconfirmed → auto-offer slot to waitlist | Cron on bookings DB | WA template msg → SMS fallback → waitlist re-offer | WA, SMS, GCal/DB | Clinics, salons, services | E | ✔/✔/✔ |
| 5 | Missed-Call → WhatsApp Callback | Missed/after-hours call triggers instant WhatsApp "Necə kömək edə bilərik?" + lead capture | Telephony/VoIP webhook or missed-call log | WA outreach → LLM qualify → CRM task | VoIP/SIP, WA, LLM, B24 | Any SMB with a phone line | M | ✔/✔/✔ |
| 6 | Voice AI Receptionist (AZ) | Phone agent answering in Azerbaijani, books appointments, transfers complex calls | Inbound SIP call (Vapi/Retell/Twilio) | STT → LLM agent → booking → SMS confirm | Voice platform, LLM, GCal, SMS | Clinics, dealerships, hotels | H | –/✔/✔ |
| 7 | Doctor Schedule Sync | Syncs multiple doctors' calendars to one booking layer, prevents double-booking | Calendar change | Conflict check → normalize → notify reception | GCal/Outlook, DB | Multi-doctor clinics | E | ✔/✔/– |
| 8 | Waitlist Autopilot | Cancellation instantly offers the slot to ranked waitlist via WhatsApp with 15-min hold | Booking cancelled | Rank waitlist → WA offer → confirm/decline loop | WA, DB, GCal | Clinics, salons, restaurants | M | ✔/✔/✔ |
| 9 | Post-Visit Review Funnel | After visit: thanks + Google Maps review ask; unhappy replies routed to owner privately | Visit completed / cron | WA msg → sentiment branch → review link or owner alert | WA, LLM, Google Maps link | All service businesses | E | ✔/✔/✔ |
| 10 | Recall/Recurring Visit Reminder | 6-month dental recall, 3-week color touch-up, annual checkup campaigns | Cron on visit history | Segment → personalized WA/SMS → booking link | WA, SMS, DB | Dentists, salons, vets | E | ✔/✔/✔ |
| 11 | Multi-Branch Router | One WhatsApp number → routes to correct branch by location/service, aggregates stats | WA inbound | LLM branch detection → forward → central dashboard | WA, LLM, DB, Sheets | Chains (clinics, salons) | M | ✔/✔/✔ |
| 12 | Deposit-Protected Booking | Takes prepayment via Epoint/Payriff link before confirming premium slots | Booking request | PG payment link → webhook confirm → calendar lock | PG, WA, GCal | Premium salons, aesthetics | M | ✔/✔/✔ |
| 13 | Fitness Class Booking Bot | Class schedule Q&A, membership status check, class reservation, capacity limits | WA/IG inbound | LLM → membership lookup → reserve → reminder | WA, IG, LLM, DB | Gyms, yoga/pilates studios | M | ✔/✔/✔ |
| 14 | Tutor/Lesson Scheduler | Parents book/reschedule lessons; teacher gets daily WhatsApp roster | WA inbound + cron | LLM → GCal → daily digest | WA, LLM, GCal | Tutors, training centers | E | ✔/✔/✔ |
| 15 | Restaurant Reservation Bot | Table booking with party size, occasion tagging, deposit for large groups | WA/IG inbound | LLM → table map/DB → confirm → pre-visit reminder | WA, IG, LLM, DB, PG | Restaurants | M | ✔/✔/✔ |
| 16 | Government-Style Queue Ticket Bot | Virtual queue via WhatsApp for busy service points (dealership service, notary-adjacent) | WA inbound | Issue ticket → live position updates → arrival call-up | WA, DB | Car services, busy offices | M | ✔/✔/– |

## 6.2 Instagram/WhatsApp Sales & Lead Capture (15 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 17 | IG Comment → DM Funnel | "Qiymət yazın" comments get auto-DM with catalog + price + order link | IG comment webhook | Keyword/LLM match → DM → lead to CRM | IG, LLM, B24/Sheets | IG shops | E | ✔/✔/✔ |
| 18 | IG Story Reply Catcher | Story replies ("neçəyədir?") answered instantly with product/price | IG story reply | LLM → product lookup → reply + order CTA | IG, LLM, DB | IG shops | E | ✔/✔/✔ |
| 19 | WhatsApp Product Catalog Bot | Full catalog browsing, cart, and order capture inside WhatsApp | WA inbound | LLM/menu flow → cart → order → payment link | WA, LLM, PG, Sheets/DB | IG/WA retailers | M | ✔/✔/✔ |
| 20 | Lead Qualifier Agent | Asks 3–5 qualifying questions, scores lead, routes hot leads to sales with summary | WA/IG/form inbound | LLM qualification → score → CRM + owner WA alert | WA, IG, LLM, B24 | Real estate, autos, B2B | M | ✔/✔/✔ |
| 21 | Instant Quote Bot | Structured quote generation (windows, furniture, repairs) from customer inputs/photos | WA inbound with photos | OCR/vision → pricing rules → PDF quote → follow-up | WA, LLM/OCR, PDF | Construction trades, custom goods | M | ✔/✔/– |
| 22 | Abandoned Conversation Rescuer | Leads who went silent get a 24h/72h nudge sequence with an offer | Cron on conversation state | Segment → personalized WA nudge → CRM update | WA, LLM, DB | All DM-sales businesses | E | ✔/✔/✔ |
| 23 | Lead Distribution Round-Robin | New leads distributed to sales agents evenly/by skill with response SLA timers | New CRM lead | Assign → WA notify agent → SLA escalation | B24, WA | Agencies, dealerships, developers | E | ✔/✔/– |
| 24 | Speed-to-Lead Enforcer | If a lead isn't contacted in 5 min, escalate to manager; log response times | CRM lead created | Timer → check activity → escalate → report | B24, WA, Sheets | Sales teams | E | ✔/✔/– |
| 25 | Website Form → Omni Follow-up | Form fill triggers instant WhatsApp + email sequence and CRM deal | Webhook (form) | WA hello → email → CRM deal → task | Webhook, WA, SMTP, B24 | Any business with a site | E | ✔/✔/– |
| 26 | Price-List On Demand | "Preyskurant" keyword sends current PDF price list, tracks who requested | WA/IG keyword | Send PDF → log → retarget list | WA, IG, PDF, Sheets | Wholesalers, B2B | E | ✔/–/– |
| 27 | Referral Reward Tracker | Customers share referral codes via WhatsApp; rewards auto-credited | WA inbound code | Validate → credit ledger → notify both parties | WA, DB | Salons, gyms, courses | M | ✔/✔/✔ |
| 28 | B2B Reorder Bot | Regular buyers (shops ordering from distributor) reorder via WhatsApp shortcut | WA inbound | Parse order → 1C/ERP order draft → confirm → invoice | WA, LLM, 1C API/file, e-taxes | Distributors, wholesale | H | –/✔/✔ |
| 29 | Live Chat Handover | AI answers until confidence drops or client asks for human; smooth agent handover with context summary | WA/IG inbound | LLM confidence gate → summary → assign agent | WA, IG, LLM, B24/Slack | Any support/sales team | M | ✔/✔/✔ |
| 30 | Lead Source Attribution Logger | Tags every lead with source (IG ad, story, tap.az, referral) and builds ROI report | Inbound any channel | Parse ref → CRM field → weekly ROI digest | IG, WA, B24, Sheets | SMBs running ads | E | ✔/✔/– |
| 31 | Turbo.az/Tap.az Listing Lead Sync | Calls/messages from classifieds listings logged to CRM with listing reference | Inbound msg/manual fwd | Parse → CRM lead → follow-up sequence | WA, B24, Sheets | Dealers, realtors, sellers | M | ✔/✔/– |

## 6.3 Customer Support & Omnichannel (12 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 32 | Omnichannel Inbox Hub | WA+IG+TG+email unified into one queue (Chatwoot) with n8n routing/automation | Any channel inbound | Normalize → Chatwoot → rules/LLM triage | WA, IG, TG, SMTP, Chatwoot | SMBs with multi-channel support | M | ✔/✔/✔ |
| 33 | RAG Support Agent (AZ/RU) | Answers from company knowledge base (price lists, policies, FAQs) with citations | WA/TG inbound | Embed KB → vector search → LLM answer → fallback human | WA, LLM, Postgres/pgvector | Telecom/ISP/retail support | M | ✔/✔/✔ |
| 34 | Ticket Auto-Triage | Classifies tickets (billing/tech/complaint), sets priority, routes to right team | New ticket/email | LLM classify → route → SLA timer | SMTP, LLM, Jira/B24 | Mid-size support teams | E | ✔/✔/– |
| 35 | CSAT Collector | Post-resolution 1-tap rating via WhatsApp; low scores alert manager instantly | Ticket closed | WA rating → log → alert branch | WA, Sheets/DB | Support teams | E | ✔/✔/✔ |
| 36 | Complaint Escalation Guard | Detects angry/legal-threat language in any channel, escalates to owner in minutes | Inbound msg | LLM sentiment/risk → owner WA + log | WA, IG, LLM | Reputation-sensitive SMBs | E | ✔/✔/– |
| 37 | Order Status Self-Service | "Sifarişim haradadır?" answered automatically from order/courier data | WA inbound | Order lookup → courier API → status reply | WA, DB, courier API | E-commerce | M | ✔/✔/✔ |
| 38 | Utility Outage Notifier | Businesses notify customers of outages/closures via segmented WhatsApp blast | Manual/cron trigger | Segment → template blast → delivery report | WA, Sheets | Service providers, HOAs | E | ✔/✔/– |
| 39 | SLA Breach Radar | Tracks first-response/resolution SLAs across channels, daily breach report | Cron | Query inbox data → compute SLAs → Slack/WA digest | Chatwoot/B24, Sheets | Support managers | E | ✔/✔/– |
| 40 | Multilingual Reply Assistant | Drafts replies in customer's language (AZ/RU/EN), agent approves with one tap | Agent request | LLM draft → approval → send | WA, LLM, Slack | Support/sales teams | E | ✔/✔/– |
| 41 | FAQ Auto-Learner | Mines resolved conversations weekly, proposes new FAQ/KB entries for approval | Weekly cron | Cluster questions → LLM draft KB → approval flow | LLM, DB, Notion/Sheets | Growing support teams | M | ✔/✔/– |
| 42 | VIP Customer Flagger | Recognizes high-LTV customers in any channel, alerts a senior agent | Inbound msg | CRM lookup → VIP route → agent alert | WA, B24 | Banks-adjacent, premium retail | E | ✔/✔/– |
| 43 | Telegram Support Bot for ISPs | Balance check, tariff info, outage reports, ticket creation for internet providers | TG inbound | Menu/LLM → billing API → ticket | TG, LLM, billing API | Regional ISPs | M | ✔/✔/✔ |

## 6.4 Marketing & SMM (15 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 44 | AI Content Calendar → Auto-Post | Generates month of AZ-language posts from product info, schedules to IG/FB/TikTok | Cron/manual | LLM captions + image prompts → schedule → publish | LLM, IG Graph, Meta, Buffer-like | SMBs, SMM agencies | M | ✔/✔/✔ |
| 45 | SMM Agency Client Reporter | Auto-monthly report per client: reach, followers, leads, ad spend, in branded PDF | Monthly cron | Pull IG/Meta Ads metrics → PDF → email/WA to client | IG, Meta Ads, PDF, SMTP | SMM agencies | M | ✔/✔/✔ |
| 46 | Birthday & Holiday Campaigner | Auto WhatsApp/SMS greetings + offers on birthdays, Novruz, Ramazan, 8 March, year-end | Daily cron | Segment → personalized msg → redemption tracking | WA, SMS, Sheets/CRM | Retail, salons, restaurants | E | ✔/✔/✔ |
| 47 | Win-Back Campaign Engine | Customers inactive 60/90/180 days get escalating offers; tracks reactivation | Cron on sales data | RFM segment → WA/SMS sequence → report | WA, SMS, DB/POS | Retail, beauty, fitness | M | ✔/✔/✔ |
| 48 | Google Review Booster | Systematic post-purchase review requests; monitors and replies to reviews with LLM drafts | Purchase event/cron | WA ask → review scrape → LLM reply drafts | WA, Maps scraping/API, LLM | Restaurants, clinics, hotels | M | ✔/✔/✔ |
| 49 | Ad Lead Form → CRM Pipe | Meta Lead Ads instantly to CRM + WhatsApp greeting (kills the 24h death delay) | Meta lead webhook | CRM deal → instant WA → assign | Meta Ads, B24, WA | Anyone running lead ads | E | ✔/✔/– |
| 50 | Influencer Campaign Tracker | Tracks promo codes/links per influencer, computes real ROI | Order events | Attribute code → ledger → dashboard | PG/shop webhook, Sheets | Brands using influencers | E | ✔/✔/– |
| 51 | Competitor Price Watch | Scrapes competitor sites/marketplaces (Umico/Trendyol) for price changes, alerts | Daily cron | Scrape → diff → WA/TG alert + sheet | HTTP scrape, Sheets, TG | Retail, e-commerce | M | ✔/✔/✔ |
| 52 | Content Repurposer | One long video/post → IG caption, TikTok script, Telegram post, blog draft | Manual/upload | LLM transform ×4 → drafts for approval | LLM, Drive | Media, agencies, experts | E | ✔/✔/– |
| 53 | Hashtag & Trend Scout (AZ) | Weekly digest of trending AZ hashtags/sounds/topics in your niche | Weekly cron | Scrape/analyze → LLM digest → TG channel | HTTP, LLM, TG | SMM specialists | M | ✔/–/✔ |
| 54 | Event Promo Automation | Concert/conference promo: registration, ticket delivery, reminder, post-event NPS | Form/payment webhook | PG confirm → QR ticket PDF → WA reminders → NPS | PG, PDF/QR, WA | Event organizers | M | ✔/✔/✔ |
| 55 | Loyalty Punch-Card Bot | Digital loyalty (every 10th coffee free) via WhatsApp number lookup | POS event/manual code | Ledger update → milestone reward msg | WA, DB, POS webhook | Coffee shops, fast food | M | ✔/✔/✔ |
| 56 | SMS Blast Manager | Segmented bulk SMS with sender-ID compliance, opt-out handling, delivery analytics | Manual/cron | Segment → SMS API → suppress opt-outs → report | SMS, Sheets/DB | Retail chains, services | E | ✔/✔/✔ |
| 57 | UGC Collector | Asks happy customers for photo/video testimonials, collects rights confirmation | Post-purchase | WA ask → media store → consent log | WA, Drive/S3 | Brands, salons | E | ✔/–/– |
| 58 | Local SEO Auditor | Weekly check of Google Business profile completeness, review velocity vs competitors | Weekly cron | Scrape/audit → score → recommendations email | HTTP, LLM, SMTP | Local businesses, agencies | M | ✔/✔/✔ |

## 6.5 E-commerce Operations (15 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 59 | Order → WhatsApp Confirmation Suite | Order placed → instant WA confirm, payment link if unpaid, status updates through delivery | Woo/shop webhook | WA confirm → PG link → status msgs | WooCommerce, WA, PG | Online stores | E | ✔/✔/✔ |
| 60 | Umico/Trendyol Order Aggregator | Pulls marketplace orders into one sheet/dashboard + stock sync back | Cron/API | Fetch orders → normalize → stock update → alerts | Marketplace APIs/scrape, Sheets, DB | Marketplace sellers | H | –/✔/✔ |
| 61 | Stock-Out Sentinel | Low-stock alerts, auto-hide product on site, supplier reorder draft | Inventory threshold | Alert → toggle product → PO draft email | Woo, SMTP, Sheets | Retailers | E | ✔/✔/– |
| 62 | COD Confirmation Bot | Cash-on-delivery orders auto-verified via WhatsApp before dispatch (kills fake orders) | New COD order | WA confirm request → status branch → courier release | WA, Woo | E-commerce with COD | E | ✔/✔/✔ |
| 63 | Courier Dispatch Router | Assigns orders to courier services by zone/weight/COD, creates shipments via API | Order paid | Rules → courier API → tracking back to customer | Courier APIs, WA | Stores with multi-courier | M | ✔/✔/✔ |
| 64 | Starex/Camex Package Tracker | Tracks Turkey/US parcel-forwarding shipments, notifies customers of customs/arrival | Cron on tracking | Scrape/API status → WA update | HTTP, WA | Forwarding users, resellers | M | ✔/✔/✔ |
| 65 | Product Feed Generator | Auto-generates/updates Meta catalog, Google Merchant, marketplace feeds from store data | Cron | Transform → feed XML/CSV → push | Woo, Meta, HTTP | E-commerce | M | ✔/✔/– |
| 66 | Price & Margin Guard | Recalculates prices on cost/FX changes with margin floors; flags loss-makers | Sheet/cost update | Rules → price update → approval → publish | Sheets, Woo | Importers/retail | M | ✔/✔/– |
| 67 | Returns & Refund Desk | Structured return requests via WhatsApp, photo evidence, refund via PG, RMA log | WA keyword | Form flow → approval → PG refund → ledger | WA, PG, Sheets | E-commerce | M | ✔/✔/✔ |
| 68 | Abandoned Cart Rescue | Cart abandonment → WA reminder with payment link (vastly outperforms email in AZ) | Woo abandoned hook | Delay → WA + link → discount escalation | Woo, WA, PG | Online stores | E | ✔/✔/✔ |
| 69 | Supplier Price-List Ingest | Supplier Excel/PDF price lists auto-parsed into product DB with change report | Email attachment | Parse (OCR/Excel) → diff → update draft | SMTP, OCR/LLM, Sheets | Retail/wholesale | M | ✔/✔/– |
| 70 | Daily Sales Digest | 09:00 WhatsApp digest: yesterday's sales, orders, top products, vs-last-week | Daily cron | Query POS/shop → compose → WA to owner | Woo/POS, WA, LLM | Owners | E | ✔/✔/✔ |
| 71 | Fraud/Anomaly Flagger | Flags suspicious orders (mismatched geo, repeated fails, bulk COD) for review | New order | Rules score → hold → review task | Woo, DB | E-commerce | M | ✔/✔/– |
| 72 | Invoice-on-Order (e-qaimə prep) | B2B orders generate e-invoice draft data ready for e-taxes submission | B2B order | Map to XML fields → accountant queue/portal flow | Woo, e-taxes, Sheets | B2B sellers | H | –/✔/✔ |
| 73 | Multi-Store Consolidator | Chains with several stores get unified stock, sales, and transfer suggestions | Cron | Aggregate → analyze → transfer proposals | POS/DB, Sheets | Retail chains | H | –/✔/✔ |

## 6.6 Finance & Accounting (15 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 74 | Bank Statement Auto-Reconciler | Pulls statements via open banking, matches to invoices/orders, flags exceptions | Daily cron | OB fetch → match engine → exception list → 1C draft | OB, 1C/Sheets, LLM | SMBs, accountants | H | –/✔/✔ |
| 75 | Payment-Received Notifier | Incoming bank payment → instant WA to owner + CRM deal marked paid | OB webhook/poll | Match → notify → CRM update | OB, WA, B24 | B2B SMBs | M | ✔/✔/✔ |
| 76 | AR Chaser (Debitor Bot) | Polite, escalating WhatsApp/email reminders for unpaid invoices; promise-to-pay tracking | Cron on AR ledger | Segment by age → sequence → owner escalation | WA, SMTP, Sheets/1C | Wholesale, services, B2B | M | ✔/✔/✔ |
| 76a | e-Qaimə Inbox Watcher | New incoming e-invoices detected, parsed, categorized, pushed to accountant + ledger | Portal poll (RPA) | Fetch XML → LLM categorize → ledger/1C draft | e-taxes, LLM, 1C | Accountants, SMBs | H | –/✔/✔ |
| 77 | Expense Receipt OCR | Staff photo receipts to WhatsApp; OCR → categorized expense entries | WA media inbound | OCR/LLM extract → validate → expense sheet/1C | WA, OCR, Sheets/1C | SMBs | M | ✔/✔/✔ |
| 78 | Tax Deadline Guardian | AZ tax calendar (VAT, profit, ƏDV, DSMF etc.) reminders with per-client checklists | Cron | Checklist gen → WA/email → completion tracking | Sheets, WA, SMTP | Accounting firms | E | ✔/✔/✔ |
| 79 | Accountant Client-Docs Collector | Monthly automated collection of bank statements/invoices from each client via WhatsApp | Monthly cron | Request → receive files → sort to client folders → nag | WA, Drive/S3 | Outsourced accountants | M | ✔/✔/✔ |
| 80 | Cash-Flow Forecaster | Weekly 13-week cash-flow projection from OB balances + AR/AP | Weekly cron | OB pull → model → PDF/Sheet → owner WA | OB, Sheets, PDF, LLM | SMB owners, CFOs | H | –/✔/✔ |
| 81 | Payroll Prep Automator | Collects attendance/hours, computes salary drafts incl. DSMF/income tax, export for bank salary project | Monthly cron | Aggregate → compute → approval → bank file/API | Sheets/HR, OB (salary API) | 20–200 staff companies | H | –/✔/✔ |
| 82 | Currency & Commodity Alerts | CBAR rates, oil price, customs FX alerts to Telegram/WA for importers | Daily cron | Fetch CBAR/API → threshold alerts | CBAR API/HTTP, TG, WA | Importers, finance teams | E | ✔/–/✔ |
| 83 | Subscription Billing Engine | Recurring AZN billing via Epoint/Payriff with dunning (retry, WA reminders, suspension) | Monthly cron | Charge → fail branch → dunning → status sync | PG, WA, DB | Local SaaS, gyms, schools | M | ✔/✔/✔ |
| 84 | POS Cash-Up Reconciler | Compares POS Z-reports vs card settlements vs bank credits, flags gaps per branch | Daily cron | Pull 3 sources → match → variance alert | POS, PG, OB | Retail/restaurant chains | H | –/✔/✔ |
| 85 | Budget vs Actual Reporter | Monthly department budget variance report with LLM commentary | Monthly cron | Query ledger → compare → narrative → PDF | 1C/Sheets, LLM, PDF | Mid-size companies | M | ✔/✔/– |
| 86 | Vendor Invoice Approval Flow | Incoming invoices routed for multi-level approval via WhatsApp buttons before payment | Invoice received | OCR → route by amount → approvals → pay queue | OCR, WA, Sheets | Companies with approvals | M | ✔/✔/– |

## 6.7 HR & Recruiting (12 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 87 | CV Screening Agent | Parses CVs from email/job boards, scores vs vacancy, shortlist to hiring manager | Email/upload | OCR/LLM parse → score → ranked sheet → alerts | SMTP, LLM, Sheets | HR teams, agencies | M | ✔/✔/✔ |
| 88 | WhatsApp Interview Scheduler | Candidates self-schedule interviews; reminders cut no-shows | Shortlist event | WA invite → slot pick → GCal → reminders | WA, GCal | Recruiters | E | ✔/✔/✔ |
| 89 | Onboarding Checklist Runner | New hire triggers doc collection, account creation tasks, day-1 agenda, buddy intro | HR event | Task cascade → doc collection via WA → IT tickets | WA, Sheets, Jira/AD | 50+ staff companies | M | ✔/✔/– |
| 90 | Leave & Absence Bot | Staff request vacation via WhatsApp/Telegram; manager approves; balance tracked | WA/TG inbound | Validate balance → approval → calendar + HR log | WA/TG, Sheets, GCal | SMBs | E | ✔/✔/✔ |
| 91 | Timesheet Collector | Field staff check in/out via WhatsApp location; weekly timesheet auto-compiled | WA inbound/cron | Geo-log → compile → anomaly flags → payroll feed | WA, Sheets | Construction, cleaning, security | M | ✔/✔/✔ |
| 92 | eNPS Pulse Surveys | Monthly anonymous staff mood survey via Telegram with trend dashboard | Monthly cron | TG survey → anonymize → dashboard → HR alert | TG, Sheets | HR leaders | E | ✔/✔/– |
| 93 | Vacancy Multi-Poster | One vacancy posted to JobSearch.az-style boards, LinkedIn, TG channels simultaneously | Manual trigger | Format per channel → post/queue → applicant inbox | HTTP, TG, LinkedIn | Recruiters | M | ✔/✔/– |
| 94 | Interview Feedback Collector | Structured scorecards demanded from interviewers within 24h, auto-compiled | Interview done | Form → nag loop → compiled profile | Sheets, WA/Slack | Hiring teams | E | ✔/–/– |
| 95 | Contract & Offer Generator | Offer letters/employment contracts generated from template + SİMA/Asan İmza signing step | Hire approved | Doc merge → PDF → e-sign request → archive | PDF, SİMA, Drive | HR/legal | M | ✔/✔/– |
| 96 | Birthday/Anniversary Culture Bot | Team birthdays, work anniversaries → congratulations + gift task | Daily cron | Lookup → channel post → task | TG/Slack, Sheets | Any team | E | ✔/–/– |
| 97 | Attrition Early-Warning | Flags patterns (absences, overtime, eNPS drop) suggesting flight risk | Weekly cron | Score → confidential HR alert | Sheets/HR data, LLM | 100+ staff | M | –/✔/– |
| 98 | Training Compliance Tracker | Mandatory trainings (safety, compliance) assigned, reminded, certified, reported | Cron | Assign → remind → quiz → certificate PDF | WA/email, PDF, Sheets | Industrial, banks | M | ✔/✔/– |

## 6.8 Sales & CRM Ops (10 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 99 | CRM Hygiene Bot | Finds stale deals, missing fields, duplicate contacts; nags owners weekly | Weekly cron | Audit → tasks → manager digest | B24, WA/Slack | Sales teams on CRM | E | ✔/✔/– |
| 100 | Call Summary → CRM | Sales call recordings transcribed, summarized, action items to CRM automatically | Recording uploaded | STT → LLM summary → CRM note + tasks | STT, LLM, B24 | Sales teams | M | ✔/✔/✔ |
| 101 | Proposal Generator | CRM deal data → branded proposal PDF in AZ/EN → tracked send | Deal stage change | Merge template → PDF → email/WA → open tracking | B24, PDF, SMTP | B2B sales | M | ✔/✔/– |
| 102 | Pipeline Forecast Digest | Weekly weighted pipeline forecast with LLM risk commentary to owner's WhatsApp | Weekly cron | Query CRM → model → narrative → WA | B24, LLM, WA | Sales leaders | E | ✔/✔/– |
| 103 | Quote Follow-Up Cadence | Every sent quote gets 3/7/14-day follow-ups until answered | Quote sent | Sequence → reply detection → CRM update | SMTP/WA, B24 | B2B | E | ✔/✔/– |
| 104 | Contract Renewal Radar | Contracts expiring in 60/30/7 days → renewal tasks + client outreach | Cron on contracts | Alert → task → renewal WA/email | Sheets/CRM, WA | Services, ISPs, insurers | E | ✔/✔/✔ |
| 105 | Upsell Recommender | Purchase-history-based next-product suggestions pushed to account managers | Monthly cron | Basket analysis → LLM suggestions → CRM tasks | DB, LLM, B24 | Distributors, B2B | M | –/✔/– |
| 106 | Dealer/Partner Portal Lite | Partners request stock/prices/orders via Telegram bot instead of calling managers | TG inbound | Auth → query ERP/sheet → respond/order | TG, 1C/Sheets | Manufacturers, importers | M | ✔/✔/✔ |
| 107 | Sales Contest Scoreboard | Live sales leaderboard to office screen/TG with milestone celebrations | Deal won event | Update board → celebrate msg | B24, TG/Sheets | Sales floors | E | ✔/–/– |
| 108 | Meeting No-Show Recovery | Missed sales meetings auto-rebooked with apology flow | Calendar no-show | Detect → WA rebook link → CRM log | GCal, WA, B24 | B2B sales | E | ✔/✔/– |

## 6.9 Logistics, Courier & Customs (10 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 109 | Shipment Status Broadcaster | Every shipment milestone (picked, customs, out-for-delivery) → customer WA update | TMS/tracking event | Map status → localized msg → log | TMS/Wialon/HTTP, WA | Forwarders, couriers | M | ✔/✔/✔ |
| 110 | Customs Doc Pack Assembler | Collects invoice, packing list, CMR, certificate per shipment; flags missing docs | Shipment created | Checklist → doc collection via email/WA → OCR verify | OCR, Drive, WA | Customs brokers | H | –/✔/✔ |
| 111 | e-Customs Declaration Prep | Extracts data from commercial docs into declaration-ready structured fields | Doc pack complete | OCR/LLM extract → HS-code suggest → broker review | OCR, LLM, Sheets | Customs brokers | H | –/✔/✔ |
| 112 | Fleet Alert Hub | Wialon events (geofence, idle, fuel drop) → dispatcher Telegram + daily fleet report | Wialon webhook | Filter → alert → daily digest | Wialon API, TG | Fleet operators | M | ✔/✔/✔ |
| 113 | Driver Task Sheet Bot | Drivers get daily route/task list on WhatsApp, confirm deliveries with photo POD | Daily cron | Assign → WA tasks → POD collection → log | WA, Sheets/TMS | Delivery firms | M | ✔/✔/✔ |
| 114 | Freight Quote Responder | Inbound freight inquiries (route, weight, container) get fast structured quotes | Email/WA inbound | LLM parse → rate table → quote PDF → follow-up | LLM, Sheets, PDF, WA | Forwarders | M | ✔/✔/✔ |
| 115 | Container Tracking Consolidator | Tracks containers across shipping lines into one client-facing status page/digest | Cron | Poll line APIs/scrape → normalize → notify | HTTP, Sheets, WA | Forwarders, importers | H | –/✔/✔ |
| 116 | Warehouse Intake Logger | Arrivals photographed + logged via WhatsApp; discrepancies flagged to supplier | WA media inbound | OCR label → match PO → variance alert | WA, OCR, Sheets | Warehouses, 3PL | M | ✔/✔/– |
| 117 | COD Cash Settlement Reporter | Courier COD collections vs remittances reconciled daily per driver | Daily cron | Compare → variance → finance alert | Sheets/TMS, OB | Courier companies | M | –/✔/✔ |
| 118 | Middle-Corridor Rate Radar | Monitors transit rates/news (Baku port, BTK railway), weekly intel digest for forwarders | Weekly cron | Scrape/news → LLM digest → TG channel | HTTP, LLM, TG | Logistics firms | M | ✔/–/✔ |

## 6.10 Healthcare & Clinics (10 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 119 | Lab Result Notifier | Results ready → secure WhatsApp notification + PDF retrieval flow | LIS event/cron | Match patient → notify → deliver on verify | LIS/DB, WA, PDF | Labs, clinics | M | ✔/✔/✔ |
| 120 | Pre-Visit Instruction Bot | Procedure-specific prep instructions (fasting, meds) sent automatically | Booking type | Lookup protocol → schedule msgs | WA, DB | Clinics, imaging centers | E | ✔/✔/– |
| 121 | Patient Recall Engine | Chronic-care and preventive recalls (diabetes reviews, dental cleanings) | Cron on history | Segment → recall WA/SMS → booking | WA, SMS, clinic DB | Clinics, dentists | E | ✔/✔/✔ |
| 122 | Insurance Pre-Auth Assistant | Collects docs for private insurance approval, tracks status, notifies patient | Case opened | Checklist → insurer email/portal → status updates | SMTP, OCR, WA | Clinics working with insurers | H | –/✔/– |
| 123 | Doctor Referral Tracker | Inbound referrals logged, referring doctors get outcome feedback (grows referral network) | Referral logged | CRM log → thank-you → outcome report | Sheets/CRM, WA | Specialist clinics | E | ✔/✔/– |
| 124 | Medication Reminder Service | Post-treatment medication/aftercare reminders sequence | Treatment done | Scheduled WA sequence → adherence check-in | WA, DB | Clinics, aesthetics | E | ✔/✔/✔ |
| 125 | Clinic Daily Ops Digest | Owner's morning WhatsApp: yesterday revenue, bookings today, no-show rate, reviews | Daily cron | Query systems → compose → WA | Clinic DB/Clintee, WA, LLM | Clinic owners | E | ✔/✔/✔ |
| 126 | Patient Intake Forms | New patients complete history/consent digitally before arrival; PDF to record | Booking confirmed | WA form link → validate → PDF → chart | WA, PDF, Drive | Clinics | M | ✔/✔/✔ |
| 127 | Emergency Slot Broadcast | Same-day cancellations broadcast to pain/urgent waitlist | Cancellation | Waitlist → WA blast → first-confirm wins | WA, DB | Dentists, clinics | E | ✔/✔/– |
| 128 | Pharmacy Stock & Expiry Watch | Expiring lots and low stock alerts; supplier reorder drafts | Daily cron | Query stock → alerts → PO drafts | Pharmacy DB/1C, TG | Pharmacies | M | ✔/✔/– |

## 6.11 Hospitality — Hotels & Restaurants (12 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 129 | Hotel Guest WhatsApp Concierge | Pre-arrival upsells, check-in info, in-stay requests, late checkout sales | Booking/PMS event | Msg sequence → request routing → upsell PG links | PMS/Fidelio export, WA, LLM, PG | Hotels, aparthotels | H | –/✔/✔ |
| 130 | OTA Review Aggregator | Booking/Google/TripAdvisor reviews into one digest with LLM response drafts | Daily cron | Scrape/API → sentiment → drafts → post queue | HTTP, LLM, Sheets | Hotels | M | ✔/✔/✔ |
| 131 | Direct Booking Rescue Bot | IG/WA inquiries quoted instantly with rates + payment link (beats OTA commission) | WA/IG inbound | LLM → availability check → quote → PG deposit | WA, IG, LLM, PMS/Sheets, PG | Small hotels, guesthouses | M | ✔/✔/✔ |
| 132 | Restaurant Daily P&L Snapshot | iiko/Clopos sales + purchases → daily margin snapshot to owner | Daily cron | POS API pull → compute → WA digest | iiko/Clopos API, WA | Restaurant owners | M | ✔/✔/✔ |
| 133 | Menu Engineering Reporter | Monthly dish-level profitability & popularity matrix with recommendations | Monthly cron | POS data → matrix → LLM insights → PDF | iiko/Clopos, LLM, PDF | Restaurant groups | M | –/✔/✔ |
| 134 | Delivery Aggregator Reconciler | Wolt/Bolt Food payouts vs POS orders reconciled; commission errors flagged | Weekly cron | Fetch reports → match → variance report | Wolt/Bolt reports, POS, Sheets | Restaurants on aggregators | H | –/✔/✔ |
| 135 | Banquet/Event Lead Manager | Wedding/corporate event inquiries → structured quote, menu options, deposit, timeline | WA/IG inbound | LLM qualify → quote PDF → deposit → task timeline | WA, LLM, PDF, PG | Restaurants, venues | M | ✔/✔/– |
| 136 | Staff Shift Filler | Sick shift → broadcast to qualified off-duty staff, first-accept wins | Manual/HR event | Segment staff → WA blast → confirm → rota update | WA, Sheets | Restaurants, hotels | E | ✔/✔/✔ |
| 137 | Supplier Order Automator | Par-level-based daily supplier orders (bread, produce) via WhatsApp with confirmations | Daily cron | Stock check → generate orders → WA suppliers → log | POS/Sheets, WA | Restaurants, cafes | M | ✔/✔/– |
| 138 | Guest Birthday & Loyalty Engine | Regulars recognized, birthday offers, visit-count rewards from POS data | Daily cron | Segment → WA offers → redemption tracking | POS, WA | Restaurants, cafes | E | ✔/✔/✔ |
| 139 | Tour Group Coordinator | Group itineraries, rooming lists, and voucher docs generated and shared with partners | Booking event | Doc gen → partner emails → change propagation | Sheets, PDF, SMTP | DMCs, tour operators | M | ✔/✔/– |
| 140 | Utility & Cost Anomaly Watch | Spikes in daily utilities/purchases vs covers flagged (theft/waste detection) | Daily cron | Compare ratios → alert | Sheets/POS, TG | Restaurant groups, hotels | M | –/✔/– |

## 6.12 Real Estate & Construction (10 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 141 | Listing Syndicator | One property entry → formatted posts for Bina.az-style portals, IG, TG channel | New listing | Format per channel → publish/queue → link log | Sheets, IG, TG, HTTP | Agencies | M | ✔/✔/✔ |
| 142 | Buyer-Listing Matchmaker | New listings matched to buyer criteria DB → instant WA alerts to matching buyers | New listing | Match engine → WA alerts → agent task | DB, WA | Agencies | M | ✔/✔/✔ |
| 143 | Viewing Scheduler & Follow-Up | Viewings booked, reminded, post-viewing feedback collected and logged | WA inbound | Slots → reminders → feedback form → CRM | WA, GCal, Sheets | Agents | E | ✔/✔/✔ |
| 144 | Rent Collection Autopilot | Monthly rent invoices, payment links, late-fee reminders, landlord statements | Monthly cron | Invoice → PG link → dunning → statement PDF | PG, WA, PDF, Sheets | Property managers | M | ✔/✔/✔ |
| 145 | Developer Sales Funnel | New-build project: lead capture from ads, unit availability, price calc, contract docs | Lead inbound | Qualify → unit sheet → quote PDF → CRM stages | Meta Ads, WA, LLM, PDF, B24 | Developers (MTK) | H | –/✔/✔ |
| 146 | Tenant Request Desk | Tenants report issues via WhatsApp with photos → work orders → contractor dispatch | WA inbound | Categorize → work order → assign → status loop | WA, LLM, Sheets | Property/facility mgmt | M | ✔/✔/✔ |
| 147 | Construction Daily Site Report | Foremen submit photo/progress via WhatsApp → structured daily report to PM/client | Daily cron + WA | Collect → LLM compile → PDF → distribute | WA, LLM, PDF | Construction firms | M | ✔/✔/✔ |
| 148 | Subcontractor Payment Tracker | Acts of work, approvals, retention, payment schedule tracked with alerts | Doc event | Register → approval flow → payment calendar | Sheets, WA, OCR | Contractors | M | –/✔/– |
| 149 | Material Procurement RFQ Bot | BOQ items → RFQs blasted to supplier list → quotes collected & compared | Manual trigger | RFQ msgs → parse replies → comparison table | WA/SMTP, LLM, Sheets | Construction | M | ✔/✔/– |
| 150 | Tender Watcher (etender.gov.az) | New state tenders matching CPV/keywords → daily digest + deadline tracker | Daily cron | Scrape/API → filter → TG/WA digest → calendar | HTTP, LLM, TG, GCal | Contractors, suppliers | M | ✔/✔/✔ |

## 6.13 Education & Training (10 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 151 | Course Inquiry → Enrollment Bot | IG/WA course questions answered, trial lesson booked, enrollment + payment completed | WA/IG inbound | LLM → trial booking → PG → onboarding | WA, IG, LLM, PG, Sheets | Training centers | M | ✔/✔/✔ |
| 152 | Tuition Payment Reminder | Monthly fee reminders with payment links; debt list to director | Monthly cron | Segment → WA + link → escalation → report | PG, WA, Sheets | Schools, courses | E | ✔/✔/✔ |
| 153 | Parent Progress Reporter | Attendance + grades compiled into monthly parent WhatsApp reports | Monthly cron | Query LMS/sheets → compose AZ report → WA | Sheets/LMS, LLM, WA | Private schools, courses | M | ✔/✔/✔ |
| 154 | Absence Alert | Student misses class → instant parent notification with makeup options | Attendance event | Detect → WA parent → makeup booking | Sheets, WA | Schools, courses | E | ✔/✔/✔ |
| 155 | Homework & Materials Distributor | Lesson materials/homework auto-sent to group channels per class | Lesson end/cron | Fetch → distribute → submission tracking | TG/WA, Drive | Teachers, centers | E | ✔/–/✔ |
| 156 | Placement Test Grader | Entrance/placement tests auto-graded with level recommendation | Form submission | Grade → LLM level rec → enrollment offer | Forms, LLM, WA | Language schools | M | ✔/✔/– |
| 157 | Student Churn Predictor | Attendance decline + payment lateness → at-risk list with save-offers | Weekly cron | Score → director digest → retention sequence | Sheets, LLM, WA | Training centers | M | –/✔/✔ |
| 158 | Certificate Generator | Course completion → branded PDF certificate + verification code + LinkedIn share | Completion event | PDF merge → registry → delivery | PDF, DB, SMTP/WA | Courses, academies | E | ✔/–/✔ |
| 159 | Group Fill Optimizer | Waiting students matched to forming groups by level/schedule; auto-launch at quorum | New signup | Match → propose → confirm → launch group | Sheets, WA | Language schools | M | –/✔/✔ |
| 160 | Alumni Upsell Campaigner | Graduates offered next-level/adjacent courses at intervals | Cron | Segment → offer sequence → track | Sheets, WA | Training centers | E | ✔/✔/– |

## 6.14 Legal, Compliance & Professional Services (9 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 161 | Contract Intake & Deadline Docket | Contracts OCR'd; parties, terms, renewal/expiry dates into docket with alerts | Doc upload/email | OCR/LLM extract → registry → alerts | OCR, LLM, Sheets, GCal | Law firms, in-house | M | ✔/✔/✔ |
| 162 | Court Hearing Tracker | E-court case events/hearings → calendar + client notifications | Portal poll/cron | Detect changes → GCal → client WA | e-court (RPA), GCal, WA | Law firms | H | –/✔/– |
| 163 | Client KYC/Conflict Checker | New client → registry lookups, sanction list screening, conflict-of-interest check | New client | Query registries → screen → report | HTTP/registries, LLM, Sheets | Law firms, banks-adjacent | H | –/✔/– |
| 164 | Legal Doc Assembly | Standard docs (NDAs, employment, lease) generated via guided WhatsApp/form Q&A + e-sign | Form/WA flow | Q&A → merge → PDF → SİMA sign | LLM, PDF, SİMA | Law firms, SMBs | M | ✔/✔/✔ |
| 165 | Regulatory Watch (AZ) | Monitors e-qanun.az/official gazettes for changes in chosen areas; LLM digests | Daily cron | Scrape → diff → LLM summary → TG/email | HTTP, LLM, TG, SMTP | Lawyers, compliance, accountants | M | ✔/✔/✔ |
| 166 | Billable Time Logger | Lawyers log time via Telegram quick-commands; monthly client invoices assembled | TG inbound | Parse → timesheet → invoice draft | TG, Sheets, PDF | Law firms | E | ✔/✔/✔ |
| 167 | AML Transaction Rule Engine | Rule-based screening of transactions with case queue for compliance officers | Transaction feed | Rules → score → case → audit log | DB/OB, Sheets | Fintechs, exchanges, dealers | X | –/✔/– |
| 168 | Data-Protection Request Handler | Personal-data access/deletion requests tracked to statutory deadlines | Email/form | Register → task flow → response templates → log | SMTP, Sheets, LLM | Larger companies | M | ✔/✔/– |
| 169 | License & Permit Renewal Minder | All company licenses/permits/certificates in registry with renewal workflows | Cron | Alert cascade → doc prep checklist → filing task | Sheets, WA, GCal | All regulated businesses | E | ✔/✔/✔ |

## 6.15 Government, Tenders & Portals (7 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 170 | Tender Intelligence Pro | etender.gov.az + corporate procurement portals monitored; LLM fit-scoring vs company profile | Daily cron | Scrape → score → brief → deadline tracking | HTTP, LLM, TG, GCal | B2G suppliers | M | ✔/✔/✔ |
| 171 | Tender Bid Pack Builder | Standard bid documents (bank guarantees list, references, forms) assembled per tender | Tender selected | Checklist → doc merge → review → package | PDF, Drive, Sheets | Bidders | M | –/✔/– |
| 172 | e-Qaimə Bulk Issuer | Batch invoice issuance prep for high-volume sellers (delivery, utilities-adjacent) | Cron/batch file | Map data → XML batch → portal flow → confirmations | e-taxes, Sheets | High-volume B2B | H | –/✔/✔ |
| 173 | Company Registry Enricher | Enriches counterparty VÖEN (tax IDs) with registry data before contracts/credit | New counterparty | Lookup → risk flags → CRM enrich | HTTP/registries, B24 | B2B finance teams | M | ✔/✔/✔ |
| 174 | Utility Bill Autopilot | Company's Azerishiq/Azersu/Azeriqaz bills fetched, verified vs meters, paid, logged | Monthly cron | Portal fetch (RPA) → verify → pay via PG/OB → ledger | RPA/HTTP, OB, Sheets | Multi-site businesses | H | –/✔/✔ |
| 175 | Government Grant/Program Watcher | KOBİA/IDDA/4SİM programs, grants, trainings digest for SMEs | Weekly cron | Scrape → LLM digest → TG channel | HTTP, LLM, TG | SMEs, consultants | E | ✔/–/✔ |
| 176 | Statistical Report Reminder | Mandatory stat.gov.az report calendar per company profile with prep checklists | Cron | Calendar → reminders → checklist | Sheets, WA | Accountants | E | ✔/✔/– |

## 6.16 DevOps, IT & MSP (12 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 177 | Uptime & SSL Sentinel | Sites/APIs monitored; downtime and expiring SSL/domains → TG/WA alerts | Cron | Probe → alert → incident log | HTTP, TG, WA | Agencies, SMBs, MSPs | E | ✔/✔/✔ |
| 178 | Incident War-Room Bot | Alert → auto-create incident channel, page on-call, status page update, postmortem doc | Prometheus/Grafana webhook | Route → escalate → status → timeline doc | Grafana, TG/Slack, Sheets | IT teams | M | ✔/✔/– |
| 179 | Backup Verification Loop | Verifies backups actually completed & restorable; failures escalate | Daily cron | Check jobs/S3 → test restore ping → alert | S3, DB, TG | MSPs, IT teams | M | ✔/✔/– |
| 180 | Deploy Pipeline Notifier | GitHub/GitLab deploy events → changelog to team + client-facing release notes | CI webhook | Format → notify → LLM release notes | GitHub/GitLab, TG, LLM | Dev teams | E | ✔/–/– |
| 181 | Server Health Digest | Daily CPU/RAM/disk digest across fleet with anomaly flags | Cron | Query Prometheus/agents → digest → TG | Prometheus, TG | MSPs, sysadmins | E | ✔/✔/– |
| 182 | Employee Access Provisioner | Joiner/mover/leaver → AD/LDAP accounts, email, VPN, app access checklist executed | HR event | Create/disable accounts → tasks → audit log | AD/LDAP, SMTP, Jira | 100+ staff, banks | X | –/✔/– |
| 183 | License & SaaS Spend Auditor | Inventory of SaaS subscriptions vs usage; unused seats flagged monthly | Monthly cron | Collect → compare → savings report | APIs/Sheets | Finance+IT | M | ✔/✔/– |
| 184 | Helpdesk WhatsApp Front-End | Staff IT issues via WhatsApp → tickets with LLM triage and known-fix suggestions | WA inbound | LLM triage → Jira ticket → status sync | WA, LLM, Jira | Companies, MSPs | M | ✔/✔/✔ |
| 185 | Patch & Vulnerability Reporter | CVE feeds filtered to client stack; patch task creation with severity SLA | Daily cron | Match stack → tasks → weekly report | CVE feeds, Jira, TG | MSPs, security teams | M | ✔/✔/– |
| 186 | Client Site Report (MSP) | Monthly per-client infrastructure report (uptime, tickets, backups) branded PDF | Monthly cron | Aggregate → PDF → email | Monitoring, PDF, SMTP | MSPs | M | ✔/✔/✔ |
| 187 | Log Anomaly Summarizer | Loki/ELK error spikes summarized by LLM with probable-cause hypotheses | Alert webhook | Pull logs → LLM analyze → TG brief | Loki/ELK, LLM, TG | DevOps | M | ✔/✔/– |
| 188 | Database Job Babysitter | ETL/cron job registry with expected-run windows; silent failures caught | Cron | Heartbeat check → alert → run log | DB, TG | Data/IT teams | E | ✔/✔/– |

## 6.17 Security & Compliance Ops (7 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 189 | Phishing Report Handler | Staff forward suspicious emails → auto-analysis, IOC extraction, org-wide block/warn | Email to security@ | Parse → analyze → verdict → response actions | SMTP, LLM, security APIs | Banks, enterprises | H | –/✔/– |
| 190 | Access Review Campaign | Quarterly manager attestation of staff access rights with evidence trail | Quarterly cron | Generate lists → approval flows → audit report | AD/LDAP, Sheets | Regulated companies | M | –/✔/– |
| 191 | Security Awareness Drip | Monthly micro-trainings + simulated phishing to staff via email/TG with scoring | Monthly cron | Send → track → score → HR report | SMTP, TG, Sheets | Enterprises | M | ✔/✔/✔ |
| 192 | CCTV/Alarm Event Router | Alarm/camera events routed by site to guards' WhatsApp with escalation timers | Device webhook | Route → confirm loop → incident log | HTTP, WA | Security companies | M | ✔/✔/✔ |
| 193 | Visitor & Contractor Pass Flow | Pre-registration, QR passes, host notifications, log-book compliance | Form/WA | Register → QR PDF → notify host → log | PDF/QR, WA, Sheets | Office buildings, factories | E | ✔/✔/✔ |
| 194 | Endpoint Compliance Nagger | Devices missing AV/updates/encryption flagged; users nagged; IT dashboard | Daily cron | Query MDM/agents → nag → report | MDM APIs, TG | IT/security | M | –/✔/– |
| 195 | Incident Register (ISO 27001) | Security incidents logged, classified, tracked to closure with management reports | Form/alert | Register → workflow → metrics | Sheets, LLM, PDF | Companies seeking ISO | M | ✔/✔/– |

## 6.18 Internal Ops & Document Automation (10 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 196 | Approval Matrix Engine | Any request (purchase, discount, leave) routed by amount/type through approval chain in WhatsApp | Form/WA | Route → approvals → execute → log | WA, Sheets | All companies | M | ✔/✔/✔ |
| 197 | Meeting Minutes Agent | Recorded meetings → transcript, decisions, action items assigned with deadlines | Recording upload | STT → LLM minutes → tasks → distribution | STT, LLM, TG/Jira | All companies | M | ✔/✔/✔ |
| 198 | Document Expiry Registry | Corporate docs (POAs, certificates, insurance) tracked with renewal alerts | Cron | Registry → alerts → renewal tasks | Sheets, WA | All companies | E | ✔/✔/✔ |
| 199 | Scanned Archive Digitizer | Legacy paper archives OCR'd, named, indexed, searchable | Batch upload | OCR → LLM classify/name → index → store | OCR, LLM, S3/Drive | Law, accounting, government | M | –/✔/– |
| 200 | Report Compiler | Weekly cross-department KPI collection with nag loops → one management report | Weekly cron | Request → collect → compile → PDF → distribute | Sheets, WA, PDF | Holdings, mid-size | E | ✔/✔/– |
| 201 | Translation Pipeline (AZ/RU/EN) | Documents/content translated with terminology memory and reviewer step | Doc upload | LLM translate → glossary check → review → deliver | LLM, Drive | Companies, agencies | E | ✔/✔/✔ |
| 202 | Data Entry Killer | Any recurring form/portal data entry replicated from structured sources (RPA-style) | Source update | Map → browser automation → verify → log | Browser automation, Sheets | Back offices | H | –/✔/– |
| 203 | Office Asset Tracker | Equipment issue/return via QR + WhatsApp; inventory reports | WA/QR scan | Ledger update → assignment log → audits | WA, Sheets, QR | Companies, schools | E | ✔/–/– |
| 204 | Board Pack Assembler | Monthly board/investor pack from finance + ops data, LLM commentary, PDF | Monthly cron | Pull data → narrative → PDF → distribute | Sheets/1C, LLM, PDF | Holdings, funded startups | M | –/✔/– |
| 205 | Petty Cash Controller | Cash advances requested/approved/closed with receipts via WhatsApp | WA request | Approval → ledger → receipt OCR → close | WA, OCR, Sheets | SMBs | E | ✔/✔/– |

## 6.19 AI Agents & Voice (10 templates)

| # | Template | Description | Trigger | Actions | Integrations | Target | Diff | Sell T/M/S |
|---|---|---|---|---|---|---|---|---|
| 206 | Outbound Voice Reminder Agent | Calls patients/customers with appointment/payment reminders in Azerbaijani, records outcome | Cron | TTS/voice agent call → outcome → CRM log | Voice platform, LLM, CRM | Clinics, banks-adjacent, utilities | H | –/✔/✔ |
| 207 | AI Debt-Collection Caller | Soft-collections calls/messages with negotiated promise-to-pay capture, compliant scripts | Cron on AR | Voice/WA agent → negotiation → PTP ledger | Voice, WA, LLM, Sheets | Lenders, telecoms, utilities | X | –/✔/✔ |
| 208 | AI Mystery Shopper | Periodically tests competitor/own WhatsApp response quality & speed, benchmark report | Weekly cron | Agent conversations → score → report | WA, LLM, Sheets | Chains, franchises | M | –/✔/✔ |
| 209 | Research Agent (AZ Market) | Deep-dive market/competitor research briefs on demand with cited sources | Manual/TG command | Multi-step web research → LLM brief → PDF | HTTP, LLM, PDF | Consultancies, corporates | M | ✔/✔/✔ |
| 210 | AI Sales SDR Agent | Works inbound lead lists: enriches, personalizes outreach, books meetings autonomously | List upload | Enrich → sequence → reply handling → booking | WA/SMTP, LLM, GCal, B24 | B2B companies | H | –/✔/✔ |
| 211 | Document Q&A Agent | "Ask your documents" over contracts/manuals/regulations with citations | TG/WA query | Vector search → LLM answer → source links | LLM, pgvector, Drive | Legal, compliance, ops | M | ✔/✔/✔ |
| 212 | AI Interview Screener | Structured async screening interviews via WhatsApp voice notes, scored transcripts | Candidate applies | Voice Q&A → STT → LLM score → shortlist | WA, STT, LLM | High-volume recruiters | H | –/✔/✔ |
| 213 | Personal Exec Assistant | Owner's WhatsApp assistant: schedule, reminders, dictated tasks, daily brief across systems | WA inbound | LLM router → calendar/tasks/CRM actions | WA, LLM, GCal, B24 | Executives, owners | M | ✔/✔/✔ |
| 214 | AI Quality Auditor (Calls) | All call-center recordings scored vs script/compliance checklist, coaching reports | Recording batch | STT → LLM score → agent dashboards | STT, LLM, Sheets | Call centers, banks | H | –/✔/✔ |
| 215 | Multi-Agent Ops Copilot | Orchestrated agents (finance, support, ops) reporting to one owner chat interface | WA command | Route to specialist agents → aggregate → respond | LLM, all above | Advanced SMBs | X | –/✔/✔ |

---

## Marketplace Packaging Strategy

**Vertical Packs (bundle 8–15 templates, priced 490–1,490 AZN + optional managed service):**
1. **Klinika Paketi** — #1, 4, 7, 8, 9, 10, 119–128
2. **Gözəllik Paketi** (Beauty) — #2, 3, 4, 8, 9, 10, 12, 27, 46, 47
3. **Restoran Paketi** — #15, 55, 132–140
4. **E-ticarət Paketi** — #59–73
5. **Təhsil Paketi** (Education) — #151–160
6. **Əmlak Paketi** (Real Estate) — #141–146
7. **Mühasib Paketi** (Accountant) — #74–86, 176
8. **Logistika Paketi** — #109–118
9. **MSP/IT Paketi** — #177–188
10. **Satış Paketi** (Sales) — #17–31, 99–108

**Horizontal best-sellers to lead marketing with:** #1 (AI Receptionist), #17 (IG Comment Funnel), #68 (Abandoned Cart WA), #76 (AR Chaser), #150 (Tender Watcher), #177 (Uptime Sentinel) — cheap, visual, instantly understandable demos.

**Distribution:** own template store (Azerbaijani-language landing + demo videos), n8n community marketplace (international reach for the non-AZ-specific ~60%), Instagram content marketing showing before/after of each workflow, and partner channel via Bitrix24 integrators and accounting firms.
