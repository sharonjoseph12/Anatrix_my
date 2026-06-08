# Antarix Sales Scripts

> **What this playbook covers.** The literal words the first five sales hires say to a recruiter, a college placement officer, and (for the student self-serve flow) the words we put in the first WhatsApp / email after signup. Every script is paired with a "context" line, the script itself in a blockquote, and a "what to listen for" signal. The scripts are written for a phone-and-Zoom first motion; field sales comes after the first 10 deals. Replace `<!-- TODO -->` markers with real numbers, real customer quotes, and real proof points as you get them — do not invent them.

## 1. Recruiter cold outreach

### 1.1 Email — "The verify-before-you-trust" angle

**Context:** Use for a warm lead (someone who downloaded a guide, attended a webinar, or was referred). The hook is the W3C verifiable credential — most recruiters have never seen one. Tone: short, technical, no marketing fluff.

> Subject: Hire engineers with credentials you can verify yourself
>
> Hi {{first_name}},
>
> Quick question: when a candidate sends you a "9/10 in Python" line on their resume, what do you do? Most talent teams take it on faith, run a screening call, and waste 30 minutes confirming or denying it.
>
> We've built something different. Antarix issues a W3C-standard Verifiable Credential — signed, public, auditable. A candidate's profile says "Python, 87/100" and you can resolve the signature against our public DID Document in 10 seconds, no Antarix account required.
>
> We're working with talent teams at {{customer_1}} and {{customer_2}} to replace the first-round screen with a verified profile read. Average time-to-screen dropped from 12 minutes to 4. <!-- TODO: replace with real customer quotes -->
>
> Open to a 15-minute call next week? I'll show you exactly what the candidate sees and what the recruiter sees, side by side.
>
> {{sales_name}}
> {{sales_email}} · {{sales_phone}}

**What to listen for:**
- "We just spent $40K on a recruiting agency and got 12 bad candidates." → hot signal, accelerate to discovery.
- "Our engineers are stretched on screening." → hot signal, lead with the time-to-screen metric.
- "We're locked into LinkedIn Recruiter for 2 more years." → lukewarm, set a 6-month follow-up.
- No reply in 7 days → one follow-up email, then move to LinkedIn.

### 1.2 Email — "The pilot offer" angle

**Context:** Use when you have a referral or a known fit. The hook is a 30-day, no-card pilot with unlimited views. Tone: friendly, specific, low-friction.

> Subject: 30-day Antarix pilot — unlimited views, no card
>
> Hi {{first_name}},
>
> {{referrer_name}} mentioned you're hiring for {{role}} and are open to better sourcing channels. Wanted to put a specific offer on the table:
>
> 30-day Antarix Pro pilot. Unlimited candidate views. Full filter set. One-click invite. ATS export. No credit card. If you don't find 3 candidates worth interviewing in those 30 days, the pilot is a failure and we'll never email you again.
>
> Two-minute setup. Self-serve at {{pilot_url}}. I'll personally walk you through the first search on a 15-minute call.
>
> Worth 15 minutes next week?
>
> {{sales_name}}

**What to listen for:**
- "Send me the link, I'll try it this week." → buyer is self-serve, do not push a call. Send the link and offer a 15-min "how to run a good first search" call.
- "We don't have budget for new tools this quarter." → ask which quarter. Add to the nurture list with a Q+1 reminder.
- "I'll need to check with {{boss_name}}." → ask for an introduction email. Do not skip the boss.

### 1.3 LinkedIn DM — short version

**Context:** Use when you do not have an email. The hook is the verified credential angle but compressed. No images, no links until the second message.

> Hi {{first_name}} — saw your post about hiring {{role_count}} {{role}}s. We do verified skill screening for entry-level engineers: every candidate's profile is a W3C-signed credential, auditable in 10 seconds. Cutting first-round screen time in half for teams your size. Worth 15 minutes?

**What to listen for:**
- "How is this different from LinkedIn?" → jump to the "we issue a signed credential" answer; do not get into feature lists.
- "Not interested." → one polite acknowledgement, do not push.
- A question about price → ask "what's your team's current monthly spend on entry-level sourcing?" before quoting. If you cannot have that conversation, you are not ready to quote.

### 1.4 LinkedIn DM — referral version

**Context:** Use when a mutual connection is named. The hook is the referral. Always ask permission to name the referrer.

> Hi {{first_name}} — {{referrer_name}} (we work with them on {{use_case}}) suggested I reach out. We do verified skill screening for entry-level engineers; the differentiator is a W3C-signed credential per candidate. {{referrer_name}} said this might be a fit — would you be open to 15 minutes?

**What to listen for:**
- "Yes, {{referrer_name}} is great." → fast-track to a discovery call.
- "I don't really know {{referrer_name}} that well." → downgrade to the short version DM.
- Silence for 5 days → send one follow-up: "Following up — happy to send a 2-min Loom if a call is hard to schedule."

## 2. Recruiter discovery call

**Length:** 15 minutes, no exceptions. The point is to qualify, not to demo. A demo without qualification is a free consulting session.

### 2.1 Agenda (15 minutes)

| Minute | Topic |
|---|---|
| 0–2 | Build rapport. Confirm the agenda. "I want to ask 5 questions, then if it makes sense I'll show you the product. If it doesn't, I'll tell you and we can part friends." |
| 2–8 | Discovery (5 questions, §2.2). |
| 8–12 | Demo flow (one of three, §2.3), chosen based on the answer to discovery Q1. |
| 12–14 | Pricing framing (per the pricing tier they appear to fit, never quote a number they have not asked for). |
| 14–15 | Next step. A specific date, a specific deliverable, a specific human. |

### 2.2 The 5 discovery questions

Ask these in order. Do not skip. Do not paraphrase — the wording has been tuned to elicit the honest answer.

1. **"Walk me through what happens when a candidate applies for a {{role}} at {{company}} today. Start from 'resume lands in inbox.'"**
   - Goal: understand their current funnel, the volume, and where the time goes.
   - Signal: if they say "it goes to our ATS and a recruiter screens it" → standard. If they say "it goes nowhere, we mostly source inbound" → they may not be a real hiring shop, qualify out.

2. **"How many entry-level engineers are you hiring in the next 12 months?"**
   - Goal: scope the deal. <5 → probably Free or Starter. 5–50 → Pro. 50+ → Enterprise.
   - Signal: if they cannot answer, they do not have a hiring plan, qualify out (or push them to a 6-month follow-up when they do).

3. **"What does your current entry-level sourcing stack look like? Names and rough monthly cost."**
   - Goal: competitive map. If the answer is "LinkedIn Recruiter + 2 agencies" we know the displacement story. If the answer is "we don't really have one" we know the greenfield story.
   - Signal: do not badmouth competitors in the answer; the trap is to bash LinkedIn and lose the buyer who uses LinkedIn daily.

4. **"Who else is involved in the decision, and what's the approval path?"**
   - Goal: identify the economic buyer, the technical buyer, the champion. If only the recruiter is on the call, the deal is at risk.
   - Signal: if they say "just me, I can sign" → solo buyer, fast-track. If they say "my boss, the CFO, procurement, InfoSec, the head of engineering" → enterprise motion, expect 60–90 days.

5. **"If Antarix worked exactly as advertised, what would change for you and your team in the next 6 months?"**
   - Goal: get the buyer to articulate the value in their own words. This is the line you quote in the proposal.
   - Signal: vague answer = low intent. Specific, measurable answer ("we'd cut our agency spend by 50%" or "we'd open a new Pune office 3 months earlier") = high intent.

### 2.3 The 3 demo flow options

**Do not run a generic demo.** Pick one of the three based on discovery Q1 and Q3.

**Option A — "The side-by-side" (when the buyer uses LinkedIn Recruiter today):**
Show the same candidate search (skill: Python, min score: 80, batch: 2026, location: Bangalore) on LinkedIn Recruiter and on Antarix. Antarix result includes a W3C-verifiable credential and a "last verified" timestamp. LinkedIn result includes a resume. The differentiator is the data, not the UX.

**Option B — "The verify flow" (when the buyer is technical and skeptical):**
Open the verify portal. Show the DID Document. Resolve a credential. Verify the signature manually. This is the buyer who needs to believe the W3C claim is real, not a marketing line. Do not skip steps.

**Option C — "The pipeline view" (when the buyer is a hiring manager, not a recruiter):**
Show a pipeline view for a recent placement. Invite → accepted → interview → offer → hire. Show the source-of-hire attribution. Show the time-to-hire. This is the buyer who cares about outcomes, not screens.

### 2.4 The pricing framing rule

If the buyer asks "what does it cost," answer with a band, not a number. "For a team your size, you're in the $99–$499 per seat per month range. The exact number depends on the features and seat count. Let me put a proposal together for you — I'll have it to you by {{date}}."

**Never** quote a specific number before the proposal is sent in writing. **Never** quote a number to a buyer who has not asked what the price includes. **Never** discount on the first call. (All three are recoverable mistakes but cost momentum.)

## 3. Recruiter close — 3 objection handlers

### 3.1 "We already use LinkedIn Recruiter."

> **The trap to avoid:** bashing LinkedIn. The buyer uses LinkedIn daily. Calling it bad is calling them bad.
>
> **The response:** "Totally hear you — LinkedIn is the default and it's not going anywhere. The question is whether it solves the part of the funnel that hurts most. Where do you lose the most time — sourcing candidates, or screening the ones who apply?"
>
> **Then:** shut up and let them answer. If they say "sourcing" → LinkedIn wins and we are not the right tool, qualify out gracefully. If they say "screening" → "that's exactly where Antarix fits. The verified profile cuts the first-round screen in half, and you keep LinkedIn for sourcing. The two tools are complementary, not competitive."
>
> **What to listen for:** the word "complementary" is the unlock. If they accept it, the deal moves. If they push back with "we want one tool, not two" → they are not in-market for a second tool; set a 6-month follow-up.

### 3.2 "We don't hire entry-level."

> **The response:** "Got it — what level do you hire at? And do those hires ever come in laterally from non-traditional backgrounds — career switchers, bootcamp grads, self-taught engineers?"
>
> **Then:** shut up. If they say "we only hire senior with 7+ years" → we are not the right tool, qualify out. If they say "mostly senior, but we do take laterals sometimes" → "Antarix is built for the entry-level and early-career segment. If you ever do a campus program or a lateral program, that's the use case. Want me to add you to the quarterly product update list?"
>
> **What to listen for:** the phrase "we don't" is a soft signal, not a hard no. Most teams do occasionally hire entry-level. The question is whether the volume is enough to justify a seat.

### 3.3 "We can't justify the per-seat cost at our volume."

> **The response:** "Fair. What does your current cost-per-hire look like, and what does your current time-to-hire look like?"
>
> **Then:** shut up. If they cannot answer → "let me show you the math. If you're hiring 10 entry-level engineers a year, and your current cost-per-hire is $X, and Antarix cuts that by 30%, the per-seat cost is rounding error. Let me send you a one-pager with the numbers."
>
> **If they push back with "we're only hiring 3 this year":** "At 3 hires a year, the per-seat math probably doesn't work. What I'd suggest is starting on the Free tier — 5 candidate views a month is enough to keep Antarix in your toolbox for when the volume picks up. No card, no commitment. Worst case you have a better sourcing channel for next year."
>
> **What to listen for:** the word "yet" or "next year" → low volume now, nurture. The phrase "our CFO won't approve it" → economic buyer is not on the call, ask for an introduction.

## 4. College cold outreach

### 4.1 Email to the placement officer — "The NIRF audit" angle

**Context:** Use for a state or private university with 500+ engineering students and a placement officer whose name you have confirmed. The hook is the NIRF / NAAC placement-data audit pain. Tone: respectful, specific, no startup-speak.

> Subject: Placement data your NIRF auditor can verify
>
> Dear {{placement_officer_name}},
>
> I lead partnerships at Antarix. We're a verified-skill platform used by {{target_university_1}} and {{target_university_2}} (CS and Data Science cohorts, 2026) to give placement officers a live placement-readiness dashboard — with named students, not just aggregate counts. <!-- TODO: confirm with team; treat as target until pilot is signed -->
>
> The problem we solve: every NIRF cycle, placement offices spend 4–6 weeks reconciling data across emails, spreadsheets, and HR portals. The data is 6 months old by the time it's filed, and the auditor flags the gaps.
>
> Antarix is different in two ways:
> 1. The data is auditable per-student. A placement officer can show the auditor: "this student was placement-ready on this date, here's the verified skill data, here's the credential."
> 2. The data is live, not retrospective. The placement officer sees the readiness buckets (Ready Now / Development Path / Early Stage) in real time, every day of the year.
>
> We're offering a 6-month pilot to a small number of Indian engineering colleges — free Pro tier, 50 students, no payment, full onboarding. The only ask is that the placement officer commits to a 2-hour kickoff workshop and a 30-minute monthly review.
>
> Open to a 30-minute discovery call the week of {{date_range}}? I'd be happy to share the dashboard with a 5-minute screen share.
>
> Best,
> {{sales_name}}
> {{sales_email}}

**What to listen for:**
- A specific NIRF cycle deadline mentioned → hot signal. Place the discovery call before the deadline if possible.
- "We already have a placement partner" → ask which one. If it's a generic ERP (like TCS iON), it is not a competitor. If it's a placement-specific platform (like Superset or HireMee), treat as a competitive deal.
- "The dean would need to approve this" → ask for the introduction, do not push.

### 4.2 Email to the placement officer — "The student outcomes" angle

**Context:** Use for an institution that has already shown a pattern of caring about student outcomes (recent NAAC accreditation, recent NIRF improvement, public placement data). The hook is the alumni-tracking + curriculum-intelligence features, which are the highest-value features for the placement officer's day-to-day.

> Subject: A placement dashboard your students would actually open
>
> Dear {{placement_officer_name}},
>
> Following up on the student-outcomes conversation at {{event_name}} {{date}}. <!-- TODO: replace with real event when known -->
>
> Antarix is a verified-skill platform for engineering colleges. The short version: every student gets a Skill Proof Score (0–100) derived passively from their GitHub and calendar. Your placement office gets a live dashboard of the cohort — readiness buckets, leaderboards, skill gaps vs. industry demand, company matches, and alumni tracking after graduation.
>
> The differentiator is that students actually open it. We push a daily morning nudge on WhatsApp. In our pilot cohort, 73% of onboarded students open the dashboard at least once a week. <!-- TODO: validate with pilot data -->
>
> We're offering a 6-month pilot at no cost to {{target_institution}} — 50 students, full Pro tier, full onboarding. The pilot-to-Pro conversion rate is on us; if the pilot succeeds, the first year of Pro is included.
>
> 30-minute discovery call this month?
>
> {{sales_name}}

**What to listen for:**
- "We have a placement officer who would love this" → ask for the direct email. Do not pitch through a gatekeeper.
- "Our NIRF ranking is more important than a dashboard" → reposition as a NIRF data source, not a dashboard. The hook is "the data is auditable per student."
- No reply in 14 days → one follow-up, then a 90-day nurture. College sales cycles are measured in months, not weeks.

## 5. College discovery call

**Length:** 30 minutes. The first 5 minutes are rapport; the next 20 are discovery; the last 5 are the next step. Do not demo on the first call unless the buyer asks — the demo is the proposal, not the pitch.

### 5.1 Agenda (30 minutes)

| Minute | Topic |
|---|---|
| 0–5 | Rapport. "I want to ask 8 questions, and if it makes sense, I'll send you a 2-minute video of the dashboard. If it doesn't, I'll tell you." |
| 5–20 | Discovery (8 questions, §5.2). |
| 20–25 | Demo flow (one of four, §5.3), chosen based on the answer to discovery Q2. |
| 25–28 | Pilot framing. The 6-month free pilot, the 50-student commitment, the success criteria. |
| 28–30 | Next step. A specific date, a specific MoU signer, a specific human. |

### 5.2 The 8 discovery questions

1. **"Walk me through a typical day for the placement office during placement season. Who's involved, what tools, what data?"**
2. **"What are the 3 metrics you report up to the principal / director / vice-chancellor?"**
3. **"How do you track readiness today — by CGPA, by company-visit history, by gut feel, or something else?"**
4. **"What's the most painful part of the NIRF / NAAC data collection?"**
5. **"Do you have a placement officer, a separate T&P office, or is it handled by the HODs?"**
6. **"How are your industry-company relationships structured — do you have a placement-partner MoU, a separate company-relations team, or both?"**
7. **"If a student is on track for a Tier-1 placement, how do you know today? How did you know 3 months ago?"**
8. **"If Antarix worked exactly as advertised, what would change for the placement office in the next 12 months?"**

### 5.3 The 4 demo flow options

**Option A — "The readiness dashboard":** Show the three-bucket view (Ready Now / Development Path / Early Stage) for a real-looking pilot cohort. Show the leaderboard. End by clicking a single student profile to show the data depth.

**Option B — "The curriculum intelligence view":** Show a sample skill-gap report: "you have 8 students who know DevOps, industry needs 40. Recommendation: add a DevOps elective." This is the line that wins HODs.

**Option C — "The NIRF data export":** Show a PDF export of the kind the placement officer would attach to a NIRF submission. The data is per-student, auditable, and timestamped. This wins the data-quality buyer.

**Option D — "The student-facing app":** Show the student app + the WhatsApp nudge. The placement officer will be skeptical that students will actually use a placement tool. Showing a real WhatsApp screenshot of a daily nudge is the fastest way to prove the engagement.

### 5.4 The pilot framing rule

The pilot is the proposal, not the demo. The 6-month free Pro pilot is the offer; the demo is the supporting evidence. The 8-step partnership process (see `college-partnership.md`) is the deal structure.

## 6. College close — 3 objection handlers

### 6.1 "We have an MoU with {{competitor}}."

> **The response:** "Totally hear you — and {{competitor}} is great at {{their_specialty}}. The question is whether they solve the part of the funnel that hurts most. Where do you lose the most time — collecting placement data, or getting students to actually engage with the data?"
>
> **Then:** shut up. If they say "collecting data" → we are not the right tool, qualify out. If they say "engagement" → "that's exactly where Antarix fits. {{competitor}} is a placement office tool. Antarix is a student-engagement tool that the placement office can also use. The two are complementary."
>
> **What to listen for:** an exclusive MoU is a hard blocker. A non-exclusive MoU is workable. Ask "is the MoU exclusive on placement data, or on the company-relations side?" The answer determines whether the deal is alive.

### 6.2 "Our NIRF ranking depends on data we don't control."

> **The response:** "Right — and that's the problem we solve. NIRF ranks you on placement data, higher-ed outcome data, and perception. The first two are data you have; the third is a survey. Antarix gives you a real-time, auditable, per-student data source for the first two. The NIRF submission goes from a 4-week data-reconciliation exercise to a 1-day export."
>
> **Then:** "would it help if we shared a sample NIRF-style export from a pilot cohort? Happy to send under NDA."
>
> **What to listen for:** "Our NIRF deadline is {{date}}" → hot signal. Time the pilot kickoff to land data in front of the NIRF submission.
- "We don't trust outside data for NIRF" → mild signal, ask who they do trust, build the case from there.
- "NIRF is not a priority" → reframe to NAAC, AICTE, or state-level reporting. Every institution reports to someone.

### 6.3 "We tried something similar 2 years ago and it failed."

> **The response:** "What did you try, and what made it fail?"
>
> **Then:** shut up and listen. The failure is almost always one of:
> 1. The students did not use it (engagement failure). Antarix's WhatsApp nudge + GitHub OAuth solves this.
> 2. The placement officer did not use it (workflow failure). Antarix's data-export-to-PDF solves this.
> 3. The data was not real (signal failure). Antarix's verifiable credentials solve this.
>
> Match your response to the failure mode they describe. Do not pretend the past failure did not happen.
>
> **What to listen for:** the specific failure mode is the unlock. A placement officer who says "the students didn't open it" is telling you exactly what to prove. Show them the WhatsApp nudge and the engagement metric. The buyer has just handed you the success criterion.

## 7. Self-serve student flow

The student flow is in-product, not sales-led. The "script" is the first email and the first WhatsApp message after signup.

### 7.1 First email after signup

**Trigger:** User completes GitHub OAuth and lands on the dashboard for the first time.

> Subject: Your Skill Proof Score is ready
>
> Hey {{first_name}},
>
> Welcome to Antarix. While you were reading this email, we analysed your GitHub activity:
>
> 📊 **{{commit_count}} commits** across {{repo_count}} repos
> 💻 Top languages: {{lang_1}} ({{lang_1_pct}}%), {{lang_2}} ({{lang_2_pct}}%)
> 🔥 Active streak: {{streak_days}} days
> 🎯 **Skill Proof Score: {{score}}/100**
>
> This score updates every time you push. The leaderboard in your college cohort ({{cohort_name}}) updates hourly.
>
> **Two things you can do in the next 60 seconds:**
> 1. Connect your Google Calendar (we'll show you your peak focus windows and free study time)
> 2. Install the Power Mode Chrome Extension (10x richer data, a ⚡ badge on your profile)
>
> [Open my dashboard →] {{dashboard_url}}
>
> Questions? Reply to this email — a real human reads it.
>
> — {{founder_name}} and the Antarix team

### 7.2 First WhatsApp message

**Trigger:** User opts in to WhatsApp from the dashboard.

> 🌅 Hey {{first_name}}! Welcome to Antarix on WhatsApp.
>
> From now on, I'll send you one message every morning at 8 AM:
> - What you did yesterday
> - What's on your plate today
> - One concrete suggestion for the next 2 hours
>
> Reply **START** to log a work session without opening the app.
> Reply **STATS** any time for a quick read.
> Reply **HELP** for the full command list.
>
> To stop, reply **PAUSE** any time. No hard feelings.
>
> — {{founder_name}}

**What to listen for in the WhatsApp reply rate:**
- **STATS within 24 hours** → high engagement, candidate for a "top 10% of your cohort" nudge at day 7.
- **PAUSE within 7 days** → quiet signal, do not re-engage for 30 days.
- **No reply at all** → standard, do not interpret as churn. The morning nudge is the engagement metric.
