# College Onboarding Sequence (Day 0–30)

This sequence covers the 30 days that begin when a college signs the pilot letter. The goal is three outcomes: the pilot kickoff workshop, 50+ students onboarded in the first two weeks, and at least one cohort dashboard view from the placement officer. The 30 days is the pilot window — not the contract close; conversion to Pro is a separate motion owned by the partnerships team. Email is the channel to the placement officer; we do not email students directly, ever. 1:1 calls with a partnership manager carry the human side. The student-facing email (Day 3) is a template the officer edits and forwards. Every message links to the partnership playbook in `docs/gtm/college-partnership.md`.

---

## Channels, sender, and frequency

- **Email.** Sender `partnerships@antarix.app`. From name **{{partnership_manager_first_name}} at Antarix**. <!-- TODO: confirm partnerships@ inbox is live; same gap as support@ -->
- **1:1 call.** Scheduled in the partnership manager's calendar; agenda in `college-partnership.md` §3.
- **Frequency cap.** One email per week max during pilot; one call per milestone (Day 0, 7, 30). No email on call days.
- **Send window.** Emails 09:00–11:00 in the college's time zone (from institution country; `Asia/Kolkata` for India).

---

## The 6 emails

### Email 1 — Day 0 — Welcome to the pilot

- **Trigger.** `pilot_letter_signed` (officer countersigns the pilot letter).
- **Subject variants (A/B/C).** (1) `Welcome to the Antarix pilot` · (2) `Your pilot kickoff is on the calendar` · (3) `Three things to do before the workshop`
- **Preheader.** `Pilot starts today. Here is the 30-day plan and your partnership manager.`
- **Body.**
  1. Hi {{first_name}} — welcome to the Antarix pilot. It is a 6-month free Pro trial for 50 of your students, with the 4 success metrics from `college-partnership.md` §3 as the gate to a paid renewal. The next 30 days are the kickoff window.
  2. **Your partnership manager** is {{partnership_manager_first_name}}. They will run three calls — kickoff (Day 0), first metrics review (Day 7), pilot-success review (Day 30). Agenda is in the playbook at `https://antarix.app/help/colleges` <!-- TODO: confirm this URL exists -->. Calendar invites are in your inbox.
  3. **Three things before the workshop.** (1) Reply with the 50 students to invite. (2) Confirm the workshop date and time. (3) Forward the student email template to your T&P coordinator (we send it on Day 3).
- **Send-time / Suppression.** 10:00 local, immediately after the trigger. Skip if: pilot already kicked off, officer unsubscribed, deletion requested, or officer has already converted to Pro.

### Email 2 — Day 1 — Workshop prep

- **Trigger.** `pilot_workshop_scheduled` (the partnership manager scheduled the kickoff workshop).
- **Subject variants.** (1) `Your Antarix kickoff workshop` · (2) `Two hours, fifty students, one agenda` · (3) `What we will cover on the call`
- **Preheader.** `Agenda, attendee list, and the 3 links you need before we start.`
- **Body.**
  1. Hi {{first_name}} — the kickoff workshop is on {{workshop_date}} at {{workshop_time}} {{timezone}}. It is two hours, virtual or on-site, and covers dashboard navigation, the data export flow, the NIRF/NAAC report templates, and Q&A.
  2. **What we need before we start.** (1) The 50 student emails (CSV or paste list). (2) One T&P coordinator who can join. (3) The list of placement drives in the next 90 days.
  3. **The 3 links.** Agenda: `https://antarix.app/help/colleges#onboarding-your-cohort` <!-- TODO: confirm this URL exists -->. CSV template: `https://antarix.app/institution/cohort/upload` <!-- TODO: confirm this URL exists -->. Workshop invite: below.
- **Send-time / Suppression.** 10:30 local, the day after the workshop is scheduled. Skip if: pilot already kicked off, workshop completed, officer unsubscribed, or officer has converted to Pro.

### Email 3 — Day 3 — Student invite template (forwardable)

- **Trigger.** `day_3_student_template` (daily 04:00 UTC; `pilot_letter_signed_at` is 3 days ago ± 12h, workshop not yet completed).
- **Subject variants.** (1) `The student invite template, ready to forward` · (2) `Three paragraphs to copy into your T&P mail` · (3) `Forward to your cohort today`
- **Preheader.** `We wrote it, you edit it, your students get the real one.`
- **Body.**
  1. Hi {{first_name}} — the student invite template is below. It is yours to edit and forward through your T&P channel (newsletter, WhatsApp group, student portal). We do not email your students directly, ever.
  2. **The template is three paragraphs.** It explains what Antarix is, why your college partnered, and how to sign up. The full template is in the playbook at `https://antarix.app/help/colleges#onboarding-your-cohort` <!-- TODO: confirm this URL exists --> and a copy is below.
  3. **One tip from the playbook.** Colleges that hit ≥70% onboard-in-30-days send the invite through a personal channel (the T&P officer's own email, a class WhatsApp group with the officer's name on it), not a broadcast. Personal-channel invites convert at roughly 2×.
- **Send-time / Suppression.** 11:00 local. Skip if: workshop completed, officer unsubscribed, deletion requested, or pilot ended without conversion.

### Email 4 — Day 7 — First metrics review (before the call)

- **Trigger.** `day_7_metrics_review` (daily 04:00 UTC; `pilot_letter_signed_at` is 7 days ago ± 12h).
- **Subject variants.** (1) `Your first 7 days, in numbers` · (2) `Pilot metrics: where you are` · (3) `What to expect on tomorrow's call`
- **Preheader.** `Onboarded, credentials, streak leaders, at-risk — the four numbers from §3.`
- **Body.**
  1. Hi {{first_name}} — your first week is in. The four pilot metrics from `college-partnership.md` §3: **onboarded** {{onboarded}}/50 ({{onboarded_pct}}%), **credentials** {{credentials}}/50, **streak leaders** {{streak_leaders}}, **at-risk** {{at_risk}}.
  2. **How you compare.** The median pilot cohort at this stage is {{benchmark_onboarded}}% onboarded and {{benchmark_credentials}}% credentialed. If above, no action. If below, the workshop notes from {{partnership_manager_first_name}}'s call are the most useful next step.
  3. **Tomorrow's call** is the 30-minute first metrics review. Agenda: the four numbers, one thing that surprised you, one thing you would change about the dashboard.
- **Send-time / Suppression.** 10:00 local, the day before the scheduled Day 7 call. Skip if: pilot ended without conversion, officer unsubscribed, deletion requested, or officer has already converted to Pro.

### Email 5 — Day 14 — Onboarding check-in

- **Trigger.** `day_14_onboarding_check` (daily 04:00 UTC; `pilot_letter_signed_at` is 14 days ago ± 12h, `onboarded_count < 50`).
- **Subject variants.** (1) `Halfway through your pilot kickoff` · (2) `Two weeks, {{onboarded}} onboarded` · (3) `The students you have not reached yet`
- **Preheader.** `A short note on closing the onboarding gap before Day 21.`
- **Body.**
  1. Hi {{first_name}} — two weeks in. You have onboarded **{{onboarded}}** of 50 students ({{onboarded_pct}}%). The Day 21 cohort dashboard view is the next milestone; if you are below 50, the dashboard will be sparse.
  2. **The most common reason for a slow kickoff.** The student invite goes out, but the T&P coordinator does not follow up. A two-line reminder in the next T&P newsletter ("Antarix signup closes Friday — 5 minutes, free credential, your placement officer will see the result") closes roughly 80% of the gap.
  3. **What we can do.** {{partnership_manager_first_name}} can join your next T&P staff meeting for 10 minutes, or send a blurb you can paste into the newsletter.
- **Send-time / Suppression.** 10:00 local. Skip if: `onboarded_count >= 50`, pilot ended, officer unsubscribed, deletion requested, or officer has converted to Pro.

### Email 6 — Day 21 — The cohort dashboard is live

- **Trigger.** `day_21_dashboard_live` (daily 04:00 UTC; `pilot_letter_signed_at` is 21 days ago ± 12h, 1+ `cohort_dashboard_view` row).
- **Subject variants.** (1) `Your cohort dashboard is live` · (2) `Three things to look at first` · (3) `Day 21: what to read on the dashboard`
- **Preheader.** `A 2-minute tour of the five charts in the cohort view.`
- **Body.**
  1. Hi {{first_name}} — your cohort dashboard is live with **{{onboarded}}** onboarded students. The five charts (placement readiness, score distribution, streak leaders, at-risk, top 10) are at `https://antarix.app/institution/cohort` <!-- TODO: confirm this URL exists -->. Help: `https://antarix.app/help/colleges#the-cohort-dashboard` <!-- TODO: confirm this URL exists -->.
  2. **The three things to look at first.** (1) The **at-risk** table — students most likely to need a one-on-one. (2) The **streak leaders** — useful for kudos. (3) The **top 10** — candidates to flag for company-match.
  3. **Day 30 is the pilot-success review.** {{partnership_manager_first_name}} will email the agenda 48 hours before. Reply with three time slots if you would like a dashboard walk-through before then.
- **Send-time / Suppression.** 10:00 local. Skip if: pilot ended without conversion, officer unsubscribed, deletion requested, or officer has converted to Pro.

---

## The 3 "human touch" calls

Each call is 30 minutes, scheduled in the partnership manager's calendar, agenda lifted from `docs/gtm/college-partnership.md` §3. The manager sends a calendar invite; this sequence does not email on call days.

### Call 1 — Day 0 — Kickoff

- **Trigger.** `pilot_letter_signed`; scheduled within 48 hours.
- **Attendees.** Officer + T&P coordinator (optional) + partnership manager.
- **Agenda (`college-partnership.md` §3, item 1).** (1) Confirm the 50-student cohort, the workshop date, the data-export format. (2) Walk through the 4 success metrics. (3) Set the 1:1 cadence (weekly for month 1, then bi-weekly). (4) Q&A.
- **Output.** Signed workshop date, CSV of 50 students, the officer's preferred 1:1 slot.
- **Skip if.** Officer opted out of voice calls; the call becomes a written exchange instead.

### Call 2 — Day 7 — First metrics review

- **Trigger.** `pilot_letter_signed_at` is 7 days ago; the call is scheduled inside the Day 7 email window.
- **Attendees.** Officer + partnership manager.
- **Agenda (`college-partnership.md` §3, item 2).** (1) The four numbers from Email 4. (2) One thing that surprised the officer. (3) One change the officer would make. (4) Plan for Week 2.
- **Output.** A 1-paragraph retro the manager writes and shares in the next email.
- **Skip if.** Pilot ended, officer converted to Pro, or officer opted out of voice calls.

### Call 3 — Day 30 — Pilot-success review

- **Trigger.** `pilot_letter_signed_at` is 30 days ago; scheduled 48 hours ahead.
- **Attendees.** Officer + partnership manager + (optional) the principal/registrar if conversion is on the table.
- **Agenda (`college-partnership.md` §3, item 3).** (1) The 4 success metrics at 30 days. (2) Conversion proposal (Pro tier, one-free-renewal from `pricing-tiers.md` §3.2). (3) Decision timeline and signature path. (4) If conversion is off the table, close-and-retro.
- **Output.** A signed Pro letter, a 3-month pilot extension, or a close-and-retro document.
- **Skip if.** Pilot ended, officer converted to Pro (CSM owns the next call), or officer opted out of voice calls.

---

## The 1 student-facing email (Day 3)

The placement officer forwards this to their cohort. We provide it as a template; the officer edits and sends through whatever channel they own (T&P newsletter, class WhatsApp group, student portal). We do not email students directly. The full template is in `docs/gtm/college-partnership.md` §4. A copy is in Email 3.

**Subject (officer-editable).** `{{college_name}} has partnered with Antarix — your free Skill Proof is one click away`

**Body.**

> Hi {{student_first_name}} — {{college_name}} has partnered with Antarix, a verified-credentials platform that turns the work you already do on GitHub into a signed proof recruiters and placement officers can audit. It is free, it takes three minutes, and your placement officer will see your credential on the cohort dashboard.
>
> Here is why we partnered: the placement process is noisy, and we want a signal that is auditable, not a list of self-reported skills. Antarix reads your public GitHub commits, your active streak, and (optionally) your Power Mode sessions. It does not read your code, your issues, or anything beyond the first 200 characters of a commit message. You sign up with your college email; you can disconnect Antarix from GitHub at any time.
>
> **Sign up at `{{signup_link}}` with your `{{college_email}}` email.** Click **Connect GitHub** on the dashboard. Your first Skill Proof Score will be ready within an hour. Questions: reply to {{tpo_first_name}}, the T&P coordinator for this cohort.
>
> — {{tpo_first_name}}, T&P Coordinator, {{college_name}}

**Officer-edit checklist (sent as a comment block in Email 3).** Replace `{{college_name}}`, `{{student_first_name}}`, `{{signup_link}}`, `{{college_email}}`, `{{tpo_first_name}}` with the officer's values. The three paragraphs are designed to be lifted as-is; the officer should only edit names, links, and the college-specific reason for the partnership.

---

## The 4 milestones

1. **Pilot kicked off by Day 3.** Target 100% of pilot signups. Driven by Email 1, Email 2, Call 1.
2. **≥50 students onboarded by Day 14.** Target 60% of pilot cohorts. Driven by Email 3, Email 5, the T&P-coordinator nudge.
3. **≥1 cohort dashboard view by Day 21.** Target 90% of pilot signups. Driven by Email 6.
4. **Pilot-success review completed by Day 30.** Target 80% of pilot cohorts convert to Pro. Driven by Call 3, the proposal email, the signature path.

Each milestone is recorded in `pilot_metrics` and pulled weekly by partnerships.

---

## The 4 suppression rules

The platform auto-suppresses an officer the moment any of the following is true:

1. **Officer unsubscribed.** Hard stop on every email. The human-touch calls are owned by the partnership manager and continue unless the officer cancels them.
2. **Pilot already kicked off.** Email 1 and Email 2 are skipped if the kickoff workshop is completed. The rest continues.
3. **Officer has already converted to Pro.** Hard stop on this 30-day sequence. The CSM owns the relationship from that point.
4. **Pilot ended without conversion.** Hard stop on every email and every future call. The manager writes a close-and-retro and adds the officer to a 12-month nurture list per the playbook §4.2.

---

## The 3 templates

### Template A — Welcome to the pilot

Reused at Email 1; re-fired from a `pilot_letter_resent` event (event-anchored).

**Subject / Preheader.** `Welcome to the Antarix pilot` / `Pilot starts today. Here is the 30-day plan.`

**Body.** See Email 1. Variables: `first_name`, `partnership_manager_first_name`. On a second-or-later fire, paragraph 2 becomes: *"You signed the pilot letter on {{original_sign_date}}; we are picking up the sequence from where it left off."*

### Template B — Your pilot metrics

Reused at Email 4; re-fired weekly for the first 6 weeks, capped at one fire per 7 days, until the Day 30 call.

**Subject / Preheader.** `Your first 7 days, in numbers` / `Onboarded, credentials, streak leaders, at-risk — the four numbers from §3.`

**Body.** See Email 4. Variables: `first_name`, `onboarded`, `onboarded_pct`, `credentials`, `streak_leaders`, `at_risk`, `benchmark_onboarded`, `benchmark_credentials`, `partnership_manager_first_name`. On a second-or-later fire, paragraph 1 becomes: *"Week {{week_n}} of the pilot. Onboarded {{onboarded}}/50 ({{onboarded_pct}}%), credentials {{credentials}}/50."*

### Template C — Ready to convert to Pro

Reused at Call 3; re-fired from a `pilot_conversion_proposal_sent` event if the officer requests more time.

**Subject / Preheader.** `Your Antarix Pro proposal, ready to sign` / `One free annual renewal, the 4 success metrics, and the next 12 months.`

**Body.**

> Hi {{first_name}} — thanks for the call. Attached is the Pro proposal with the one-free-annual-renewal mechanic from `pricing-tiers.md` §3.2. The four success metrics carry over from the pilot, the price is locked for 12 months, and the signature path is principal-or-registrar. Reply with any questions; {{partnership_manager_first_name}} will get on a call the same day.

**Variables.** `first_name`, `partnership_manager_first_name`. No personalisation branches.