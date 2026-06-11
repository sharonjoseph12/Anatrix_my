# Antarix Pricing Tiers

> **What this playbook covers.** The full pricing model for Antarix at launch: the student tier (free), the three paid recruiter sub-tiers, the three paid college sub-tiers, the company org-wide bundle, the three pricing principles, the explicit list of what's NOT in v1, and the rough cost basis that justifies the gross margin. This is a finance-aligned working doc for the first sales hires and the leadership team — not a public marketing page. Every number is marked as a TODO for finance validation; do not publish any of these prices before the launch finance review.

## 1. The Student Tier — Free. Forever.

| Field | Value |
|---|---|
| Price | **$0 / ₹0** |
| Card required | No |
| Premium features | None (no upsell) |
| Account type | Individual |
| Conversion path | None (students are the supply side) |

**What the student gets for free:**
- GitHub OAuth sign-up and passive tracking (commits, languages, peak hours, streak)
- Optional Google Calendar sync
- Power Mode Chrome Extension (the upgrade, not the requirement)
- AI Coach on WhatsApp + push + dashboard
- Skill Proof Score (0-100) with the public verification page
- Verifiable Credential (W3C VC) export
- Cohort leaderboards
- One-click apply to companies

**What the student does NOT get (and never will):**
- A paid "Pro" student tier. We will not build one in 2026 or 2027. The demand side pays.
- Early access to recruiter search results
- "Boost your credential" features
- A way to pay to be seen first by recruiters (we explicitly reject this — it would corrupt the proof)

**Why free?** Students are the supply side of a two-sided marketplace. Charging them reduces supply, which reduces the value we can sell to recruiters and colleges. Every additional student is a free marginal data point that improves the score model. A student who is asked for a credit card to see their own GitHub data is a student who closes the tab.

## 2. The Recruiter Tier (per-seat)

The recruiter is a named user at a company. Each seat has its own login, search history, and pipeline view. Pricing is per active seat per month; you do not pay for seats you do not provision. Billing is monthly with an annual prepay option that gives two months free (TODO: validate with finance).

### 2.1 Recruiter Free
| Field | Value |
|---|---|
| Price | **$0 / ₹0 per seat per month** |
| Card required | No |
| Candidate views / month | 5 |
| Filters | Skill, batch, location, minimum score |
| Contact button | **No** |
| ATS export | No |
| API access | No |
| Support | Community docs + public help center |

**Purpose:** This is a taste tier, not a sales motion. A recruiter who lands on `/company/signup` without a referral can run five searches to confirm Antarix has the candidates they care about. If they want to message anyone, they upgrade.

**What you cannot do on Free:** save candidates, export search results, contact any student, see a placement prediction, or use the API. The contact button is the explicit paywall.

### 2.2 Recruiter Starter
| Field | Value |
|---|---|
| Price | **$99 / seat / month** `<!-- TODO: validate with finance before publishing -->` |
| India price | **₹8,000 / seat / month** `<!-- TODO: refresh FX rate at launch -->` |
| Candidate views / month | 100 |
| Filters | All Free filters + Power Mode badge, streak, peak window, GitHub language depth |
| Contact button | Yes (one-click invite) |
| ATS export | CSV / JSON (basic schema) |
| API access | No |
| Webhooks | No |
| Analytics | Pipeline view, no historical trend |
| Support | Email, 48-hour first-response SLA |

**What "candidate view" means:** one row opened in detail counts as one view. Search result lists (10 candidates per page) do not count. Free users can browse result lists freely; only opening a profile costs a view. This is the single most important UX choice in the funnel — never gatekeep browsing, only gatekeep action. (TODO: confirm this with product before launch — current spec does not specify the unit.)

**Who this is for:** solo recruiter or 2–3 person talent team at a startup or mid-stage company. Volume is 5–20 entry-level hires per year.

### 2.3 Recruiter Pro
| Field | Value |
|---|---|
| Price | **$499 / seat / month** `<!-- TODO: validate with finance before publishing -->` |
| India price | **₹40,000 / seat / month** `<!-- TODO: refresh FX rate at launch -->` |
| Candidate views / month | Unlimited (fair-use cap: 2,000 / month, see §6) |
| Filters | All Starter filters + cohort percentile, specialization depth, GitHub velocity, project completion signals, alumni history |
| Contact button | Yes, with calendar-aware scheduling and peak-window preferred slots |
| ATS export | Full schema + custom field mapping |
| API access | Yes (read + write to your ATS via REST, OAuth2) |
| Webhooks | Yes (placement.outcome, credential.viewed, candidate.interested) — see `docs/webhooks.md` |
| Analytics | Funnel, source-of-hire attribution, time-to-hire, salary-band by cohort, ROI vs. agency spend |
| Support | Email + Slack Connect, 8-hour first-response SLA |

**Who this is for:** dedicated university-hiring team, 5+ recruiters running a full entry-level program, or any company that has already hired 50+ entry-level engineers from India.

**Fair-use cap reasoning:** 2,000 views per seat per month is a soft ceiling. At an average 4 minutes per view (a realistic interview-screening time), that is 133 hours of active screening — more than one full-time employee. We do not believe any human recruiter legitimately needs more. Power users who hit the cap are almost certainly (a) running bot scrapers (forbidden, see ToS §4.3 — TODO: draft with counsel), (b) duplicating searches across a team that should consolidate, or (c) trying to do mass cold-outreach from the platform (we explicitly do not support this). At the cap, we offer a conversation, not a paywall.

### 2.4 Recruiter Enterprise
| Field | Value |
|---|---|
| Price | **Contact sales** (target band: $1,500–$3,000 / seat / month) `<!-- TODO: validate with finance; the band is a guess -->` |
| India price | **Contact sales** (target band: ₹1.25L–₹2.5L / seat / month) `<!-- TODO: validate with finance -->` |
| Everything in Pro | Yes |
| SLAs | 99.9% uptime, 1-hour P1 response, dedicated on-call channel |
| SSO | Yes (SAML 2.0, OIDC) — see `docs/security/vdp.md` |
| Dedicated success manager | Yes (named human, quarterly business review) |
| Custom data exports | Yes (scheduled S3 / GCS / SFTP drop) |
| Procurement | MSA, security questionnaire, InfoSec review, DPA execution |
| Procurement cycle | 30–90 days (this is a feature, not a bug) |

**Why contact-sales, not a posted price:** every Enterprise deal we have modelled requires (a) a security review, (b) a DPA, (c) a procurement signature, and (d) a defined scope of seats. A posted price would lie about the real transaction. The first five sales hires are expected to learn the discovery script in `sales-scripts.md` and run it themselves; pricing is the last thing we discuss.

## 3. The College Tier (per-institution, annual contract)

The institution is the customer. The student is the beneficiary. Pricing is annual, billed in advance, with one free annual renewal for early-pilot customers. (TODO: validate the free-renewal term with finance; we may revert to a 10% renewal discount.)

### 3.1 College Free
| Field | Value |
|---|---|
| Price | **$0 / ₹0 per year** |
| Card required | No |
| Maximum tracked students | 100 |
| Cohort dashboard | Basic (readiness buckets, top 10 leaderboard) |
| Alumni tracking | No |
| Curriculum intelligence | No |
| Company matching | No (read-only directory) |
| SSO | No |
| Support | Community docs |
| Sign-up | Self-serve at `/institution/signup` |

**What the placement officer can do on Free:** sign up their institution, add 100 students, see the three readiness buckets, and see a top-10 leaderboard. Enough to know the data is real. Not enough to run a placement season.

**What Free explicitly does NOT include:** alumni tracking (the highest-value feature for NIRF reporting — see `sales-scripts.md` college close for the sales motion), curriculum intelligence, company matching, or any data export.

### 3.2 College Pro
| Field | Value |
|---|---|
| Price | **$5,000 / institution / year** `<!-- TODO: validate with finance before publishing -->` |
| India price | **₹4,00,000 / institution / year** (4 lakh) `<!-- TODO: refresh FX rate at launch -->` |
| Maximum tracked students | Unlimited (fair-use: 5,000 active students per institution per year) |
| Cohort dashboard | Full (every segment, every batch, every specialization) |
| Alumni tracking | Yes (graduates stay on the dashboard with lifetime tier / salary band / employer where shared) |
| Curriculum intelligence | Yes (skill-gap vs. industry demand, top-3 actionable recommendations) |
| Company matching | Yes (auto-send, named students, not just counts) |
| Leaderboards | Full (with Power Mode and streak indicators) |
| Data export | CSV, JSON, PDF (for NIRF / NAAC reports) |
| SSO | No (add-on, see §6) |
| Support | Email, 24-hour first-response SLA, quarterly business review |
| Onboarding | Included (2-hour workshop, on-site or virtual) |

**Who this is for:** any institution with 500+ engineering students that wants to (a) report placement data to NIRF / NAAC with a real, auditable source, (b) use the leaderboard as a placement-season motivator, and (c) get the curriculum-intelligence recommendations into their next academic council meeting.

**The "one free annual renewal" is the pilot-to-Pro conversion mechanic** (see `college-partnership.md` §3). It is the difference between a 12-month pilot and a 24-month lock-in. Pilot = 6 months free, then one free renewal, then 8 paid months. This is a one-time concession per institution.

### 3.3 College Enterprise
| Field | Value |
|---|---|
| Price | **Contact sales** (target band: $25K–$75K / institution / year) `<!-- TODO: validate with finance -->` |
| India price | **Contact sales** (target band: ₹20L–₹60L / institution / year) `<!-- TODO: validate with finance -->` |
| Everything in Pro | Yes |
| Multi-campus | Yes (one contract, multiple campuses, role-scoped admins) |
| SSO | Yes (SAML 2.0, OIDC, including state-government SSO schemes) |
| On-premise option | Yes (single-tenant Supabase project, customer VPC, or full air-gapped; we will scope) |
| Custom data exports | Yes (custom schemas, scheduled SFTP / S3) |
| Dedicated CSM | Yes |
| Custom integrations | Yes (e.g., campus LMS, internal placement portal, NIRF submission tooling) |
| Procurement | MoU, security review, DPA, InfoSec sign-off |
| Procurement cycle | 60–180 days |

**On-premise reality check:** v1 supports Supabase self-hosted in the customer's cloud account (their AWS / GCP project). Full air-gapped requires a separate commercial conversation and is post-launch (Q3 2027 at earliest). Sales should not promise air-gapped to a college before Q3 2027.

## 4. The Company Tier (org-wide)

A "company" is the legal entity — Infosys, Razorpay, the Bangalore-based 50-person startup, etc. The org-admin seat is a separate role from a recruiter seat.

### 4.1 The bundle
The company pays for:
- **N recruiter seats** (priced per the Recruiter tier chosen)
- **1 mandatory Org-Admin seat** — controls billing, SSO, audit log, seat assignment, and the org-level analytics dashboard

| Field | Value |
|---|---|
| Org-Admin seat | **$200 / month** `<!-- TODO: validate with finance before publishing -->` |
| Org-Admin seat (India) | **₹16,000 / month** `<!-- TODO: refresh FX rate at launch -->` |
| Recruiter seats | Priced per the Recruiter tier (Free / Starter / Pro / Enterprise) |
| Org-level analytics | Funnel by recruiter, source-of-hire attribution, time-to-hire, DEI dashboard, custom cohort slicing |
| Audit log | Every seat's every action, exportable, 24-month retention |
| SSO | Yes (SAML 2.0, OIDC, Google Workspace, Okta) — included at the Org-Admin level |
| Dedicated CSM | Only at Enterprise recruiter tier |

### 4.2 Why charge by recruiter headcount, not by company size

We considered the obvious alternative — "charge Infosys $X / year flat, charge Razorpay $Y / year flat." We rejected it. Reasons:
1. **It is misaligned with value.** A 10,000-person company that hires 2 entry-level engineers a year via Antarix is not consuming 5,000x the value of a 50-person company that hires 50.
2. **It creates a procurement-time argument we will lose.** A flat-fee deal will be negotiated to a lower flat fee by procurement, who have nothing else to optimise for.
3. **It hides the consumption signal.** Per-seat usage tells us which seats are active, which companies are growing their entry-level hiring, and which companies are churning a seat every quarter (a leading indicator of churn).
4. **It is operationally simple.** Finance does not have to maintain a price list indexed by company size band.

**The 1-org-admin-seat is mandatory, not optional.** It is the seat that controls seat assignment, sees seat-level usage, and handles off-boarding. Without it, you have orphaned seats and a security hole. A company with 1 recruiter still pays for the org-admin — there is no "free for 1-seat companies" tier.

### 4.3 What we explicitly do not offer at launch
- A "company-wide flat fee with unlimited seats" — this is a procurement-friendly phrase that hides consumption and creates budget fights. If a 1,000-person company wants 1,000 seats, they pay for 1,000 seats. (We can revisit this in 2028 if a Fortune-500 demand signal appears.)
- A "pay per hire" model. We considered it. It is in the kill list — see §6.4.
- A "pay per contact" model. See §6.5.

## 5. The Three Pricing Principles

These are the rules the sales team uses to defend any pricing question. They are not marketing copy — they are the model.

### Principle 1: Students never pay.
**Reason:** Students are the supply side of the marketplace. Charging them reduces supply, which reduces the value we can sell to recruiters and colleges. A student who is asked for a credit card to see their own data is a student who closes the tab. The marginal cost of one more student is approximately zero (incremental Supabase storage, incremental Edge Function invocations, both well under $0.10 / student / year). Charging $5 / month for a "Pro" student tier would generate maybe $2.4M ARR at 40K paying students — and would shrink the supply pool by an unknown factor that we cannot model accurately. The asymmetry of risk (small upside, large unknown downside) is decisive.

### Principle 2: Recruiters pay per-seat, not per-search.
**Reason:** Aligns incentives correctly. A recruiter's job is to find good candidates and hire them. Per-search pricing punishes them for doing their job well (more searching = more cost). Per-seat pricing rewards them for being thorough and only costs them when they expand the team. It also matches the way recruiters' budgets are approved (headcount, not search volume). The only metric that should drive recruiter cost is recruiter count.

### Principle 3: Colleges pay per-institution, not per-student.
**Reason:** The institution is the customer; the student is the beneficiary. A college has one placement office, one NIRF report, one academic council, and one procurement department. Per-student pricing would force the institution to do a headcount dance every year and would create a perverse incentive to under-report student count to reduce cost. Per-institution pricing is operationally simple and aligns the institution's incentive with ours (we want every student tracked, because every tracked student is a richer data point and a better placement season, which is what the college is buying).

## 6. What's NOT in the Pricing (v1)

This is the list of pricing motions we considered, decided against for v1, and committed to revisit later. The list is explicit so that a customer request for one of these features gets a clear "not in v1, here's when" answer instead of a vague "we'll think about it."

### 6.1 Enterprise SSO as a paid add-on
Enterprise SSO (SAML 2.0, OIDC, custom IdP) is included in:
- Recruiter Enterprise
- College Enterprise
- The Company Org-Admin seat

It is **not** included in Recruiter Pro, Recruiter Starter, College Pro. A Pro-tier customer who needs SSO must upgrade to Enterprise, OR pay a flat SSO add-on (TODO: validate SSO add-on price with finance; placeholder is $300 / month for recruiters, ₹25,000 / month for colleges). The reason to gate it: SSO requires a sales-engineering engagement (metadata exchange, IdP config, support escalation paths) that we cannot do at $99 / month prices.

### 6.2 Bulk recruiter seat discounts
A company buying 50+ recruiter seats does not get a per-seat discount in v1. Reason: the per-seat price already drops significantly between Starter ($99) and Pro ($499) — the natural upsell is "consolidate your team on Pro, not "buy 50 Starter seats at $70 each." We will revisit volume discounts in 2027 if a customer actually needs them; we are not building the billing logic in v1.

### 6.3 Non-profit / academic discounts
Non-profits, government research institutions, and academic consortia do not get a discount in v1. Reason: we have not validated that the discount motion is operationally tractable (it usually requires a 501(c)(3) check, an MoU, an annual re-verification, and a "what counts as a non-profit" policy). The only exception: any institution in the pilot programme (see `college-partnership.md`) gets the pilot's free 6 months. Otherwise, we'll add the non-profit track in 2027.

### 6.4 Pay-per-hire
Considered. Decided no. Reason: pay-per-hire is the most adversarial pricing model we could choose. It says to the customer "we do not trust that you will find value unless we measure the value as a successful hire." It also creates an attribution fight on every deal — "did Antarix source this hire, or did we source it via LinkedIn and Antarix just made the screening faster?" The number of attribution conversations we would have to staff is unmanageable. The number of customers who would refuse to pay is high. We are not in the staffing business; we are in the screening business. Pricing aligns with screening.

### 6.5 Pay-per-contact
Considered. Decided no. Reason: pay-per-contact would distort search behavior. A recruiter on pay-per-contact would never run a broad search — they would only search for the exact candidate they already want. This kills the discovery value of the platform, which is the single most important reason a recruiter pays. (We watched a competitor try this. Their recruiter retention collapsed in 6 months. We are not repeating the experiment.) 

### 6.6 Freemium student paid features
There are no paid student features. See Principle 1. Do not add any, ever, without a CEO-level conversation.

## 7. The Cost Basis (rough, finance to validate)

These are the rough unit economics behind the pricing. They are deliberately conservative. The actual numbers should come from the Supabase + observability + email + Edge Function spend dashboard before launch.

### 7.1 Recruiter seat
| Cost component | Estimated monthly cost |
|---|---|
| Supabase DB (candidate_profiles, sessions, skills tables — a recruiter seat reads maybe 200 rows / month) | $1.50 |
| Edge Function invocations (recruiter-search, recruiter-invite, interview-schedule — estimated 1,500 invocations / seat / month) | $0.80 |
| Observability (logs, errors, traces from those invocations) | $0.70 |
| Email (transactional, low volume per seat) | $0.20 |
| WhatsApp (only if recruiter triggers a student WhatsApp nudge — usually $0) | $0.50 (averaged) |
| Webhook delivery (outbound webhooks for Pro/Enterprise) | $0.50 (Pro), $0.00 (Starter) |
| Storage (resume attachments, where applicable) | $0.30 |
| **Total per seat / month** | **~$4.50–$5.50** |
| Starter price | $99 / month |
| **Gross margin (Starter)** | **~95%** |
| Pro price | $499 / month |
| **Gross margin (Pro)** | **~99%** |

### 7.2 College Pro tier
| Cost component | Estimated annual cost |
|---|---|
| Supabase DB (a college has 2,000+ opted-in students, each generating 50+ rows / year) | $80 |
| Edge Function invocations (college-aggregate, college-curriculum-intel, college-leaderboard — estimated 50K invocations / college / year) | $25 |
| Observability | $20 |
| Email (weekly summary to placement officer, monthly to students) | $15 |
| WhatsApp (only if the college triggers a student nudge, rare) | $10 |
| Webhook delivery (rare for colleges) | $5 |
| Storage | $25 |
| Onboarding workshop (2 hours, virtual; on-site adds travel) | $20 (virtual), $400 (on-site) |
| **Total per college Pro / year** | **~$200 (virtual) / ~$600 (on-site)** |
| Pro price | $5,000 / year |
| **Gross margin (Pro, virtual)** | **~96%** |
| **Gross margin (Pro, on-site)** | **~88%** |

### 7.3 What this means for the launch forecast
- Both products have **≥ 88% gross margin at list price** across the realistic delivery mix.
- A blended 90% gross margin implies that a $1M ARR run rate produces $900K of gross profit before sales-and-marketing.
- The bottleneck on profitability is therefore sales, not infrastructure. (See `sales-scripts.md` for the headcount plan.)

### 7.4 What finance needs to validate before launch
1. The $5 / seat / month number — pull from the actual Supabase + observability dashboard, not the estimate.
2. The $200 / college / year number — same source.
3. The 95% / 99% gross margins — confirm what overheads we are not allocating (the CEO's time, the legal review on the DPA, the security questionnaire handling, the customer-success team) and confirm we are not double-counting.
4. The blended 90% — confirm against the actual delivery mix forecast, not the 50/50 assumption.
5. The $300 / month SSO add-on placeholder — confirm with finance and product.
6. The annual prepay "2 months free" discount on recruiter seats — confirm against cash-flow needs.
7. The India pricing in ₹ — confirm with finance that we are not creating an FX risk on annual contracts. (Recommendation: India contracts are billed in ₹ with annual repricing tied to a published FX band; USD contracts are billed in USD and not repriced mid-term.)
