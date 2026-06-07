# Antarix College Partnership Playbook

> **What this playbook covers.** The three partnership models (Free, Pro, Strategic), the 8-step process from "found a college" to "fully onboarded," the four pilot success criteria that gate a Pro conversion, the three red flags that kill a deal before they waste sales time, and the first three case-study slots the team should fill in launch quarter. This is the working playbook for the first five sales hires and the customer success manager. It links to `sales-scripts.md` for the literal outreach and discovery scripts and to `pricing-tiers.md` for the per-tier feature list and the one-free-renewal pilot-to-Pro mechanic.

## 1. The 3 Partnership Models

Antarix signs colleges in three modes. Pick the right one before the first email goes out — the wrong mode is recoverable but slow, and a Pro pitch to a placement officer with no decision authority is the single most common first-quarter mistake.

### 1.1 Free Tier — Self-Serve

The bottom of the funnel. The placement officer signs up at `/institution/signup`, adds up to 100 students by uploading a CSV or sending an invite link, and gets the basic cohort dashboard (the three readiness buckets, the top-10 leaderboard). No contract, no MoU, no payment, no alumni tracking.

**Who it is for:** Tier-2 and Tier-3 colleges that want to see whether the data is real before they will sign anything. Also: any college where the placement officer has no decision authority (see §4.1) — the Free tier is the polite way to keep them in the loop without spending sales time on a deal that will not close.

**What the placement officer gets:** up to 100 tracked students, the 3-bucket readiness view (Ready Now / Development Path / Early Stage), the top-10 leaderboard, self-serve help-center docs, and a persistent "upgrade to Pro" nudge after 30 days of active use.

**What the placement officer does NOT get:** alumni tracking, curriculum intelligence, company matching, data export (no CSV, no JSON, no PDF), or any form of human support beyond community docs.

**How it converts:** the placement officer who uses Free for 60+ days and sees the data quality becomes the Pro lead. The sales team monitors Free-tier usage via a daily dashboard and triggers a sales touch when a Free account hits the 60-day mark. The touch is a personal email from the partnerships team, not a drip campaign — the drip feels like spam; the email feels like a follow-up.

### 1.2 Pro Tier — Annual Contract

The workhorse. $5,000 / year (or ₹4,00,000 / year — 4 lakh) per institution, billed annually in advance, signed MoU required, onboarding included. `<!-- TODO: validate both numbers with finance before publishing; the India price was set against an FX band — refresh at launch -->` The pilot-to-Pro conversion is the most important sales motion in the college funnel; see §2 step 7 and the "one free annual renewal" mechanic in `pricing-tiers.md` §3.2.

**Who it is for:** any institution with 500+ engineering students that has completed a successful pilot (see §3) and wants alumni tracking, curriculum intelligence, company matching, data export (CSV / JSON / PDF for NIRF / NAAC), a dedicated success manager, quarterly business reviews, and a 24-hour first-response SLA.

**The MoU:** one master agreement, signed by the principal / registrar / director (placement officers do not sign MoUs, see §4.1). Standard 3-page MoU. Includes data-processing terms (cross-references the DPA in `docs/legal/dpa-template.md`), uptime commitment, termination clause (90 days notice, no penalty), and the alumni-tracking consent mechanism. Legal review by counsel before the first MoU is signed — every subsequent MoU is a copy-paste with the institution name and pricing band changed.

**The onboarding:** 2-hour workshop, virtual or on-site, run by the success manager. Covers dashboard navigation, data export, NIRF/NAAC report templates, and Q&A. Delivered before the institution gets live write access to alumni data. Do not skip the workshop; the cohort-dashboard usage in month 1 is the single best leading indicator of renewal.

### 1.3 Strategic Partnership — Multi-Year

The long game. Multi-year (typically 3 years), negotiated pricing, co-branded research outputs, custom integrations, joint press releases. Pricing is per-engagement; the only thing this tier shares with Pro is the feature set.

**Who it is for:** state-level university systems (a single contract covering 20+ affiliated colleges), institutions that want co-authored research on skill-gap analysis or cohort outcomes, institutions with a custom integration need (campus LMS, internal placement portal, NIRF submission tooling), and institutions where the press release is the point.

**What is negotiable:** pricing (often 20–40% off the Pro list for a 3-year commit `<!-- TODO: validate the discount band with finance; this is a guess -->`), co-branded research, custom integrations (scoped per a separate Statement of Work), joint press releases, logo rights, and a named success engineer in addition to the success manager.

**What is NOT negotiable:** data ownership (the student owns the data; the institution gets a license to view aggregated insights per the DPA), the pilot success criteria (see §3 — a strategic partner who cannot clear them is the wrong partner), and decision authority (the principal / registrar / director still signs).

**Decision authority:** the CEO signs strategic MoUs. No exceptions. Deals close through partnerships → CEO → legal → counterparty, in that order.

## 2. The 8-Step Partnership Process

The literal sequence. Follow it in order. Skipping a step is the most common cause of stalled deals and failed pilots — every stalled deal in the first quarter will trace back to a skipped step in this list.

### Step 1 — Identify the right contact
Contact priority: (a) placement officer, (b) T&P (Training and Placement) head, (c) HOD of CS / IT, (d) dean of academics, (e) principal / director. The placement officer is the buyer; the HOD is the influencer; the principal is the signer. The dean is a last resort — too senior to be useful as a champion. Always confirm the name and current role on LinkedIn before sending the first email; getting the name wrong is a 30-day cycle reset.

### Step 2 — Cold outreach
Use the email templates in `sales-scripts.md` §4 (the NIRF-audit angle and the student-outcomes angle). Pick the angle based on the institution's recent NIRF / NAAC activity — mid-cycle NIRF → lead with the data-audit pain; stable → lead with student engagement. A 14-day no-reply triggers one follow-up, then a 90-day nurture. College sales cycles are measured in months.

### Step 3 — Discovery call
30 minutes, agenda in `sales-scripts.md` §5.1. The 8 discovery questions in §5.2 are tuned to surface the red flags in §4. Do not demo on the first call — the demo is the proposal, not the pitch.

### Step 4 — Pilot offer
The standard offer is a 6-month free Pro pilot for 50 students. Non-negotiable in v1; the offer is the same for every college, no exceptions. The pilot includes 50 student seats, the full Pro dashboard, NIRF/NAAC export, a 2-hour kickoff workshop, a 30-minute monthly review, and a dedicated Slack Connect channel. Signed by the placement officer on a 1-page pilot letter. No payment, no MoU — keep the legal short; the institutional legal team will not engage on a pilot.

### Step 5 — Pilot kickoff
The success manager runs the 2-hour workshop within 14 days of the pilot-letter signature. On-site is preferred for any institution within 200 km of a major city — on-site workshops have a meaningfully higher pilot-completion rate than virtual ones (TODO: validate with pilot data once the first 3 pilots close). Attendance is the leading indicator of success; a workshop with < 60% attendance is a flag, not a failure — re-run within 30 days.

### Step 6 — Pilot success metrics
Define these upfront, in writing, in the pilot letter. The four metrics in §3 are the standard. A metric defined mid-pilot is a metric that will be argued about.

### Step 7 — Conversion to Pro
At month 5, the success manager and the partnerships team run a joint review. If the pilot clears, the partnerships team sends the Pro proposal with the one-free-renewal mechanic (`pricing-tiers.md` §3.2); the proposal goes to the principal / registrar for signature. If it does not clear, the success manager writes a short retro, and the team decides whether to extend the pilot by 3 months (the only exception to the 6-month standard) or to close.

Conversion target: 80% of pilot cohorts converting to Pro. The 20% who do not fall into two buckets: (a) the pilot cleared but the institution's budget cycle is wrong — extend free for 3 more months and re-pitch in the next cycle; (b) the pilot did not clear — close and write a retro. Do not chase a (b) into a second pilot; the same inputs produce the same outputs.

### Step 8 — Annual renewal
Owned by the success manager. The first renewal is automatic (the free renewal in the pilot-to-Pro mechanic). Subsequent renewals: 90-day pre-renewal business review, 60-day notice of any price change, 30-day renewal kickoff. Tracked as Net Revenue Retention (NRR) by institution, quarterly. Declining usage gets a "save" motion 60 days before renewal; stable or growing usage gets an expansion motion (multi-campus, additional seats, alumni-tracking tier upgrade).

## 3. The Pilot Success Criteria

These are the four metrics that gate a pilot-to-Pro conversion. They are written into the pilot letter and reviewed at month 3 and month 5. All four must clear for a clean Pro conversion.

1. **≥ 70% of invited students onboard within 30 days.** Onboarding = GitHub OAuth completed, Skill Proof Score computed, and a login after that. Below 70% is a signal that the placement officer is not actively forwarding the invite — fix by getting them to commit to a weekly nudge in their T&P newsletter.
2. **≥ 50% of onboarded students have at least one verified credential within 90 days.** A "verified credential" is a W3C VC signed and resolved (see `docs/w3c-vc-impl.md`). Below 50% means the cohort is not engaging with the Power Mode flow — fix with a 1-hour "what is a credential" workshop.
3. **≥ 80% of pilot students would recommend Antarix to a peer.** Measured by a 1-question NPS-style survey at month 5. Below 80% is product/UX friction that a workshop will not fix — escalate to product within 7 days.
4. **The placement officer reports ≥ 1 actionable insight from the cohort dashboard per month.** Measured by a 1-question monthly check-in. Below 1/month means the placement officer is not using the dashboard — fix with a 30-minute monthly walkthrough, not a workshop.

A pilot that clears 3 of 4 is reviewed by the partnerships team and the success manager together; the default is a 3-month pilot extension with a specific remediation plan for the failing metric. A pilot that clears 2 or fewer is closed; do not extend twice.

## 4. The 3 Red Flags That Kill a Partnership

These are the deal-killers. If any is true after the discovery call, the partnership team walks away (politely, with a 6-month nurture).

### 4.1 The placement officer does not have decision authority
A placement officer who cannot sign an MoU, cannot approve a budget, and cannot convene the principal is not the buyer. The polite close: "this is the right conversation, but I need 30 minutes with the principal or registrar to make progress. Can you introduce us?" If they cannot, walk away. A placement officer who cannot introduce you to their own principal is a placement officer who is not buying.

### 4.2 The institution already has an exclusive MoU with a competitor
An exclusive MoU is a hard blocker. The discovery question ("do you have an active MoU with a placement or skill-verification platform, and is it exclusive?") is asked in the first 10 minutes. If the answer is yes, the deal is dead. Do not try to win a deal against an active exclusive — the institution will not breach, and asking them to is unprofessional. Add to a 12-month nurture; check back when the MoU expires. The script for this close is in `sales-scripts.md` §6.1.

### 4.3 The cohort is fewer than 30 students
Below 30 students, the cohort dashboard is statistically meaningless, the placement-prediction model is not reliable, and the leaderboard has fewer than 3 ranks. Walk away, or (rare exception) offer the Free tier and revisit in 12 months. A pilot on a 20-student cohort is a pilot that will not produce publishable metrics.

## 5. The First 3 Case Studies

Case studies the marketing team should write in launch quarter. The names are placeholders until the pilots sign and the success metrics clear. Do not name real institutions without written permission and a signed quote release.

1. **Target University #1** — Tier-1 private university, CS cohort 2026, 50-student pilot. Lead with: NIRF audit data, alumni-tracking, curriculum-intelligence recommendation. `<!-- TODO: confirm with team; do not name without pilot signature + signed quote release. -->`
2. **Target University #2** — State-level engineering college, CS and IT cohorts 2026, 50-student pilot. Lead with: student engagement (WhatsApp nudge), the 70% onboard-in-30-days metric, the curriculum-intelligence insight. `<!-- TODO: confirm with team; do not name without pilot signature + signed quote release. -->`
3. **Target University #3** — Tier-2 autonomous college, Data Science cohort 2026, 50-student pilot. Lead with: placement-readiness bucket accuracy, the month-1 "saved a student from a development path" anecdote, the HOD engagement. `<!-- TODO: confirm with team; do not name without pilot signature + signed quote release. -->`

**Format:** 1-page PDF, 3 sections (problem, what Antarix did, measurable outcome). One quote from the placement officer, one quote from a student, one screenshot of the cohort dashboard. Approval: placement officer signs off on the placement-officer quote, the student signs off on the student quote, the success manager signs off on the metrics. No case study ships without all three.
