# Recruiter Onboarding Sequence (Day 0–21)

This sequence covers the 21 days that begin when a recruiter accepts an invite or finishes the company signup form. The goal is two outcomes: a first search that returns real candidates, and a first contact made through the platform. Email is the only channel for v1 — recruiters do not want a WhatsApp message from a vendor they are still evaluating, and the WhatsApp opt-in for recruiters is deferred to a later release. In-app banners run alongside the email for the first week, because the moment a recruiter lands on the dashboard is the moment they are most likely to act. Every message links to the help center, never duplicates it, and is suppressed the moment the recruiter reaches the milestone we are about to teach.

---

## Channels, sender, and frequency

- **Email.** Sender `recruiting@antarix.app`. From name **Arjun at Antarix** (recruiter-facing persona from `3-personas.md`). Reply-to routes to `recruiting@antarix.app`. <!-- TODO: confirm recruiting@ inbox is live; same gap as support@ -->
- **In-app nudge.** A dismissible banner on the recruiter dashboard, controlled by `recruiter_dismissed_banners`. Re-shows after 7 days if still applicable.
- **Frequency cap.** One email per day max; one in-app nudge at a time; never both nudges on the same screen.
- **Send window.** Emails 08:00–10:00 in the recruiter's time zone (from company HQ, falling back to `Asia/Kolkata` for Indian accounts, `America/Los_Angeles` for US, `Europe/London` for UK/EU).

---

## The 7 emails

### Email 1 — Day 0 — Welcome

- **Trigger.** `company_signup_completed` (recruiter clicks **Go to Dashboard** for the first time).
- **Subject variants (A/B/C).** (1) `Welcome to Antarix` · (2) `Filter 500 resumes to 5 interviews` · (3) `Your first search is one click away`
- **Preheader.** `Thirty-day free trial, no credit card, no commitment.`
- **Body.**
  1. Hi {{first_name}} — welcome to Antarix. Antarix is a verified-skill filter for entry-level hiring. You will see proof of work, not claims. Continuous signal, not a 90-minute Saturday coding test. This email takes 60 seconds to read; the rest is up to you.
  2. **Start here.** Open your dashboard, pick one skill (for example, "TypeScript"), set a minimum score band of 60, and click **Search**. The result list will show you the three states your candidates can be in — verified, unverified, claimed. Help: `https://antarix.app/help/recruiters#the-three-search-result-states` <!-- TODO: confirm this URL exists -->.
  3. **What to expect this week.** A welcome email (this one), a 2-minute product tour, and a check-in. No sales call unless you ask. Reply to this email if you want a 15-minute walkthrough.
- **Send-time / Suppression.** 09:00 local, right after `company_signup_completed`. Skip if: unsubscribed, deletion requested, or 1+ contact initiated.

### Email 2 — Day 1 — Your first search

- **Trigger.** `search_not_run_after_24h` (daily 04:00 UTC; `company_signup_completed_at < now() - 24h` and no `recruiter_search` row).
- **Subject variants.** (1) `Run your first search in 60 seconds` · (2) `Your dashboard is set up but empty` · (3) `One filter, one result list`
- **Preheader.** `TypeScript. Score 60–100. Click Search.`
- **Body.**
  1. Hi {{first_name}} — your account is set up but you have not run a search yet. Most recruiters run their first search in the first hour; the ones who do are the ones who hire from Antarix.
  2. **The 60-second search.** Click **New search**, pick one skill, set a score band of 60–100, leave the rest blank, click **Search**. That is the first 5 interviews worth of your funnel.
  3. **Want a tour?** Click **Take the 2-min product tour** in the dashboard banner, or reply and a human will walk you through it. Help: `https://antarix.app/help/recruiters#filters-explained` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 09:30 local. Skip if: 1+ `recruiter_search` row, unsubscribed, deletion requested, or contact initiated.

### Email 3 — Day 3 — You might be missing these candidates (human touch for Pro+ only)

- **Trigger.** `search_run_no_contact_72h` (daily 04:00 UTC; `recruiter_search` has rows, no `recruiter_invite` row, `company_signup_completed_at < now() - 3 days`).
- **Subject variants.** (1) `Three candidates your filters missed` · (2) `A quick look at your result set` · (3) `Loosen one filter, see ten more`
- **Preheader.** `We ran your last filter set against today's cohort. Here is who you did not see.`
- **Body.**
  1. Hi {{first_name}} — you ran **{{search_count}}** search{{search_count_plural}} in your first three days. Good. We ran your last filter set against today's cohort and found **{{missing_count}}** candidates who would have matched a slightly wider filter.
  2. **The one filter to try.** Drop your minimum score by 10 points, or remove the location filter, or both. The three highest-fit candidates in the wider set are {{candidate_1_handle}}, {{candidate_2_handle}}, and {{candidate_3_handle}} — all verified, all {{tier}} tier.
  3. **Open the wider search now.** `https://antarix.app/recruiter/search?clone={{last_search_id}}&widen=1` <!-- TODO: confirm this URL exists -->. If you are on a Pro+ plan, a recruiting partner will email you separately today to offer a 15-minute walkthrough.
- **Send-time / Suppression.** 10:00 local. Skip if: 1+ `recruiter_invite` row, unsubscribed, deletion requested.
- **Human touch (Pro+ only).** Same trigger, gated on `company.plan IN ('pro', 'strategic')`. A 1:1 email from a named recruiting partner: personal signature with first name, title, mobile, and a Calendly link with **two specific time slots**. Body references the recruiter's actual search: *"I noticed you filtered on TypeScript with a 70+ score band — happy to walk through widening it for your next 5 interviews."* Suppressed for Free/Starter and for Strategic (CSM-owned). Suppression rules: contact initiated, unsubscribed, deletion requested.

### Email 4 — Day 7 — A 15-minute walkthrough (human touch for Pro+)

- **Trigger.** `recruiter_still_no_contact_at_7d` (daily 04:00 UTC; `company_signup_completed_at < now() - 7 days`, no `recruiter_invite` row, 1+ `recruiter_search` row).
- **Subject variants.** (1) `A 15-minute walkthrough, on us` · (2) `Can I show you the recruiter view?` · (3) `A quick call before you decide`
- **Preheader.** `I have two slots open this week. Pick one or reply with your own.`
- **Body.**
  1. Hi {{first_name}} — it has been a week. You have run **{{search_count}}** search{{search_count_plural}}, but no first contact yet. That is the part of the funnel most recruiters want a human to walk through. I would like to be that human.
  2. **Two slots open this week.** {{slot_1}} or {{slot_2}}. Pick one. The call is 15 minutes, screen-share, no slides — I open your dashboard, you tell me what you are looking for, I show you where the filters break.
  3. **Reply with the slot you want** or pick a different time. If a call is too much, reply with the one question that is blocking you and I will answer in writing.
- **Send-time / Suppression.** 10:00 local. Skip if: 1+ `recruiter_invite` row, unsubscribed, deletion requested, or CSM-owned (Strategic — see §Suppression rule 3).
- **Human touch (Pro+ only).** Same trigger. For **Pro**, sent by a named recruiting partner (signature, mobile, Calendly with 2 slots). For **Strategic**, fully suppressed — CSM owns the relationship and runs a weekly check-in. Suppressed for Free/Starter.

### Email 5 — Day 10 — Outcomes, not resumes

- **Trigger.** `recruiter_no_invite_at_10d` (daily 04:00 UTC; no `recruiter_invite` row, `company_signup_completed_at < now() - 10 days`).
- **Subject variants.** (1) `What you would see if you placed someone` · (2) `Antarix is a filter, not a placement service` · (3) `What changes when you invite a candidate`
- **Preheader.** `A short note on what Antarix does and does not do.`
- **Body.**
  1. Hi {{first_name}} — quick honesty note. Antarix is the part of the funnel where you go from 500 resumes to 5 interviews. It is not a placement service, and the score is not a guarantee. The interview is still yours.
  2. **What changes when you click Contact.** The candidate sees your role, your company, and a one-line "why" — the message you typed. They reply in their Antarix inbox (and on WhatsApp, if they opted in). You see their reply, and a yes/no moves to your saved pipeline. No resume PDF, no email, no phone number until they consent.
  3. **If you have not placed anyone yet, that is fine.** Day 10 is the average time-to-first-invite across our pilot. Reply with what is in your way and I will help — no sales call required. Help: `https://antarix.app/help/recruiters#the-contact-button` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 10:30 local. Skip if: 1+ `recruiter_invite` row, unsubscribed, deletion requested.

### Email 6 — Day 14 — Your team has invited you

- **Trigger.** `recruiter_solo_at_14d` (daily 04:00 UTC; `company_signup_completed_at < now() - 14 days`, `company.seat_count = 1`, no `recruiter_invite` row).
- **Subject variants.** (1) `You are the only seat at {{company_name}}` · (2) `Invite your team in two clicks` · (3) `Two seats are better than one`
- **Preheader.** `Your colleagues can join without a separate signup.`
- **Body.**
  1. Hi {{first_name}} — you are the only seat at {{company_name}}. The recruiters who get the most out of Antarix invite at least one colleague within the first two weeks — the second pair of eyes is the difference between a search that finds good candidates and one the team will actually act on.
  2. **Two clicks.** Click **Team → Invite**, paste a colleague's work email, pick a role (Recruiter or Hiring Manager). They get a one-click join link, no separate signup, and they land in the dashboard you have already configured.
  3. **Seat math.** Your plan includes {{seat_limit}} seats; you have used {{seat_used}}. Adding a seat does not change billing until renewal. Invite: `https://antarix.app/company/team` <!-- TODO: confirm this URL exists -->. Help: `https://antarix.app/help/recruiters` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 10:00 local. Skip if: `company.seat_count > 1`, 1+ `recruiter_invite` row, unsubscribed, deletion requested.

### Email 7 — Day 21 — Three weeks in (or: how it is going)

- **Trigger.** `recruiter_21d_checkin` (daily 04:00 UTC; `company_signup_completed_at` is 21 days ago ± 12h).
- **Subject variants.** (1) `Three weeks on Antarix` · (2) `How is it going?` · (3) `Your first 21 days, in numbers`
- **Preheader.** `A short note on what we have seen and what is next.`
- **Body.**
  1. Hi {{first_name}} — three weeks in. You have run **{{search_count}}** search{{search_count_plural}}, contacted **{{contact_count}}** candidate{{contact_count_plural}}, and received **{{response_count}}** response{{response_count_plural}}. Of those, **{{placement_count}}** have been reported as a placement.
  2. **If you have a placement, the next step is a case study.** We will write it with you, you approve the final version, and we will not name the candidate without their written consent. Two case studies gets you a 6-month waiver on the Strategic tier discount.
  3. **If not, that is fine.** Reply with the one thing that would have made the last 21 days work better — a missing filter, a confusing UI, a placement officer you wish we had a partnership with. I read every reply. Help: `https://antarix.app/help/recruiters#troubleshooting` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 10:00 local. Skip if: unsubscribed, deletion requested, or account churning (paused, downgrade initiated).

---

## The 2 in-app nudges

Dismissible banners on the recruiter dashboard, each with a **Take the 2-min product tour** CTA. Re-show after 7 days if dismissed without action. The CTA points to `/recruiter/tour`. <!-- TODO: confirm /recruiter/tour exists -->

### Nudge A — Day 1 — Take the tour

- **Trigger.** `dashboard_view` event on Day 1 (hours 18–30 after `company_signup_completed`).
- **Copy.**
  > **New here?** Take the 2-minute product tour. We will walk you through your first search, the three result states, and the contact button. **[Take the 2-min product tour →]**
- **Suppression.** Skip if: tour completed, dismissed and 7 days not yet elapsed, contact initiated, or recruiter is on Strategic (CSM owns onboarding).

### Nudge B — Day 5 — Refine your last search

- **Trigger.** `dashboard_view` event on Day 5 (hours 114–126 after `company_signup_completed`), and 1+ `recruiter_search` row exists.
- **Copy.**
  > **You ran a search.** Most recruiters find 30% more candidates by dropping the minimum score by 10 points. See what you missed, or take the 2-min product tour. **[Take the 2-min product tour →]** · **[See missing candidates →]**
- **Suppression.** Skip if: tour completed, contact initiated, dismissed and 7 days not yet elapsed, or recruiter is on Strategic.

---

## The 3 milestones

1. **First search run by Day 1.** Target 90% of signups. Driven by Email 1, Email 2, in-app Nudge A.
2. **First contact initiated by Day 7.** Target 40% of signups. Driven by Email 3, Email 4 (human touch), Email 5.
3. **First placement reported by Day 90.** Target 5% of signups. **Not measured inside this 21-day sequence**; measured by the success team as a 90-day lagging indicator. Email 7 begins the case-study loop if a placement has happened by Day 21.

---

## The 4 suppression rules

The platform auto-suppresses a recruiter the moment any of the following is true:

1. **Unsubscribed.** Hard stop on every email and every in-app nudge (gated by `marketing_opt_in`).
2. **1+ contact initiated.** All "first contact" emails (3, 4, 5) stop. Email 7 still fires.
3. **CSM-owned (Strategic tier).** If the company is on Strategic, a CSM owns onboarding and runs a weekly 1:1; this sequence is fully suppressed. Pro gets the human-touch emails; Starter and Free get the regular emails.
4. **Account deletion requested.** Hard stop on every channel. Per [Privacy Notice §6](../legal/privacy-notice.md), the 90-day retention window begins; all sends are blocked until purged.

---

## The 3 templates

### Template A — Your first search

Reused at Email 2 and re-fired from a `dashboard_view_no_search` event if the recruiter dismisses Nudge A and still has not searched by Day 3.

**Subject / Preheader.** `Run your first search in 60 seconds` / `TypeScript. Score 60–100. Click Search.`

**Body.** See Email 2. Variables: `first_name`. Hard-coded filter (TypeScript, score 60–100) is the default; on a second-or-later fire, swap to the recruiter's last-used filter. On the second-or-later fire, paragraph 2 becomes: *"You searched for {{last_filter}} last time — try the same filter with the score band dropped to 50."*

### Template B — You might be missing these candidates

Reused at Email 3 and re-fired weekly for the first 6 weeks, capped at one fire per 7 days.

**Subject / Preheader.** `Three candidates your filters missed` / `We ran your last filter set against today's cohort.`

**Body.** See Email 3. Variables: `first_name`, `search_count`, `search_count_plural`, `missing_count`, `candidate_1_handle`, `candidate_2_handle`, `candidate_3_handle`, `tier`, `last_search_id`. If `missing_count < 3`, the body shortens to: *"Your filters caught everyone we could see — try widening anyway, or take the 2-min product tour to learn the next set of filters."*

### Template C — Your team has invited you

Reused at Email 6 and re-fired if the company grows from 1 seat to 2+ and back to 1 within 60 days.

**Subject / Preheader.** `You are the only seat at {{company_name}}` / `Your colleagues can join without a separate signup.`

**Body.** See Email 6. Variables: `first_name`, `company_name`, `seat_limit`, `seat_used`. If `seat_limit - seat_used <= 1`, add: *"You are close to your seat limit — talk to your admin before adding more."*
