# Student Onboarding Sequence (Day 0–14)

This sequence covers the 14 days that begin when a student finishes the Antarix signup form. The goal is two outcomes: a first signed Skill Proof credential, and that credential shared to one external surface (LinkedIn, a recruiter, a college form, an email signature). Email is primary; WhatsApp is secondary and fires only after explicit opt-in. The sequence is short on purpose: placement season is loud, our job is to be the one message that gets read, not the tenth. Every message links to the help center, never duplicates it, and is suppressed the moment a student reaches the milestone we are about to teach.

---

## Channels, sender, and frequency

- **Email.** Sender `hello@antarix.app`. From name **Antarix**. Reply-to routes to `support@antarix.app`. <!-- TODO: confirm support@ inbox is live before first send; B-2 / F-1 both flagged this as a gap -->
- **WhatsApp.** Only if the student has clicked **Connect WhatsApp** in **Settings → Notifications**. Never text first; never text a non-opted-in user.
- **Frequency cap.** One email per day max. One WhatsApp message every other day max. Never both on the same day.
- **Send window.** Emails fire 08:00–10:00 local (from profile locale, falling back to `Asia/Kolkata`). WhatsApp fires 09:00–19:00 local.

---

## The 7 emails

### Email 1 — Day 0 — Welcome

- **Trigger.** `signup_completed` (first **Go to Dashboard** click).
- **Subject variants (A/B/C).** (1) `Welcome to Antarix` · (2) `Your Skill Proof starts today` · (3) `Three minutes to your first proof`
- **Preheader.** `Connect GitHub now and your dashboard will be live in 60 seconds.`
- **Body.**
  1. Hi {{first_name}} — welcome to Antarix. We turn the work you already do on GitHub into a signed, shareable credential. It is free for students, it takes three minutes, and your first proof is ready by the end of this email.
  2. **Do this next.** Open your dashboard and click **Connect GitHub**. We read your public commits, languages, and active streak. We do not read issue content, code diffs, or anything beyond the first 200 characters of a commit message. Your credential is signed by our published key, not edited by you.
  3. Once connected, you will see a real Skill Proof Score within two hours. Guide: `https://antarix.app/help/students` <!-- TODO: confirm this URL exists -->. Reply to this email if anything feels off; a human reads it.
- **Send-time / Suppression.** 08:15 local, right after the trigger fires. Skip if: `github_connected_at` set, 1+ verified credential, unsubscribed, or deletion requested.

### Email 2 — Day 1 — Connect GitHub

- **Trigger.** `github_not_connected_after_24h` (daily 04:00 UTC; `signup_completed_at < now() - 24h` and `github_connected_at IS NULL`).
- **Subject variants.** (1) `Link GitHub to see your score` · (2) `Your dashboard is waiting` · (3) `One click, real data`
- **Preheader.** `Sixty seconds of OAuth. We will not read your code, issues, or messages.`
- **Body.**
  1. Hi {{first_name}} — your dashboard is set up, but it is still empty. Without a data source, your Skill Proof Score is zero. The fastest fix is to link GitHub; the second-fastest is to start a manual session.
  2. **What we read.** Your user ID, username, public commit metadata, repository language and star count, and pull request status. We do not read code, issues, or log in on your behalf. Full list: `https://antarix.app/legal/privacy-notice` <!-- TODO: confirm this URL exists -->.
  3. **What you get back.** A score, a per-skill breakdown, a streak counter, and the option to mint a verifiable credential once the score is above zero. Connect now: `https://antarix.app/settings/sources` <!-- TODO: confirm this URL exists -->. Help: `https://antarix.app/help/students#connecting-github` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 08:30 local. Skip if: same as Email 1, or a manual session was started (product-understanding signal).

### Email 3 — Day 3 — Your first insights

- **Trigger.** `github_connected` (fires within 2h of OAuth + first sync). Day 3 is the scheduled send; the trigger fires the eligibility check.
- **Subject variants.** (1) `Your first Skill Proof is live` · (2) `Here is what we saw` · (3) `Score, streak, and your top 3 skills`
- **Preheader.** `Your dashboard is filled in. Here is how to read it.`
- **Body.**
  1. Hi {{first_name}} — your first sync is in. You have {{commit_count}} commits in the last 90 days, your top language is {{top_language}}, and your streak is {{streak_days}} days. Your Skill Proof Score is **{{score}} / 100**.
  2. **How to read the score.** It is a weighted average of coding volume, problem-solving, consistency, and peer review. Full formula: `https://antarix.app/help/glossary#skill-proof-score` <!-- TODO: confirm this URL exists -->. Drill into each input on the dashboard.
  3. **Next step: a credential.** A credential is a signed, public URL that proves your score to anyone with the link. Click **Credential → Generate** — ten seconds, URL is yours forever. Open: `https://antarix.app/dashboard` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 09:00 local on Day 3 (or 24h after first sync, whichever is later). Skip if: 1+ verified credential, unsubscribed, deletion requested, or `github_connected_at` is null (Email 2 fires instead).

### Email 4 — Day 5 — Your credential is ready

- **Trigger.** `credential_eligible_no_credential` (daily 04:00 UTC; `score > 0`, `verifiable_credentials` empty, `signup_completed_at < now() - 4 days`).
- **Subject variants.** (1) `Mint your first credential` · (2) `Proof, in one click` · (3) `A signed URL recruiters can verify`
- **Preheader.** `A credential is a public, signed proof. It takes ten seconds.`
- **Body.**
  1. Hi {{first_name}} — five days on Antarix. You have a real Skill Proof Score and you are eligible for a credential. Most students mint theirs in week one; the ones who do are the ones recruiters see first.
  2. **What a credential is.** A public URL of the form `https://antarix.app/verify/{{slug}}` plus a W3C DID identifier. Anyone with the link verifies the signature against our published key, no Antarix account required. The signature is not yours to edit.
  3. **What it is not.** A portfolio or a list of claims. It is a single signed number plus a timestamp, the minimum that lets a recruiter trust the score. Generate: `https://antarix.app/credential/new` <!-- TODO: confirm this URL exists -->. Help: `https://antarix.app/help/students#getting-your-first-credential` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 09:15 local. Skip if: 1+ verified credential, unsubscribed, deletion requested, or credential page opened in the last 7 days (soft intent signal).

### Email 5 — Day 7 — Your weekly recap

- **Trigger.** `weekly_recap_eligible` (weekly, Sunday 06:00 user-local). Uses the **weekly recap template** (§Templates).
- **Subject variants.** (1) `Your week in numbers` · (2) `Seven days, {{commit_delta}} commits` · (3) `The week that was`
- **Preheader.** `Streak, score, and one thing to try next week.`
- **Body.**
  1. Hi {{first_name}} — here is your week. **{{commit_count}}** commits across **{{repo_count}}** repos. Streak: **{{streak_days}}** days. Skill Proof Score: **{{score}}** ({{score_delta}} vs last week).
  2. **What was strong.** {{top_skill}} moved up {{skill_delta}} points. {{repo_highlight}} got the most commits. **Try next week:** {{suggestion}}. The AI Coach can keep you on track — opt in from **Settings → Notifications → WhatsApp**.
  3. Dashboard: `https://antarix.app/dashboard` <!-- TODO: confirm this URL exists -->. Help: `https://antarix.app/help/students#solving-problems-on-the-platform` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** Sunday 09:00 local. Skip if: unsubscribed, deletion requested, no data source, or recap disabled in Settings.

### Email 6 — Day 10 — Share your credential

- **Trigger.** `credential_minted_not_shared` (daily 04:00 UTC; `verifiable_credentials` has rows, `credential_share_events` empty, `signup_completed_at < now() - 9 days`).
- **Subject variants.** (1) `Recruiters cannot see it if you do not share it` · (2) `Three places to paste your link` · (3) `One share, one callback`
- **Preheader.** `The credential is signed. The next step is showing it to a human.`
- **Body.**
  1. Hi {{first_name}} — you minted your credential. Good. The next step is sharing it. A credential that nobody has clicked on is the same as a credential that does not exist.
  2. **Three places to paste the link.** (1) LinkedIn **Licenses & Certifications** — the one-click share button does this for you. (2) Your college placement form, if it has a "portfolio URL" field. (3) Your email signature, on days you write to recruiters directly.
  3. **What a recruiter sees.** Name, score, top three skills, cohort percentile, and a "last verified" timestamp — nothing you have not opted to share. Share: `https://antarix.app/credential/share` <!-- TODO: confirm this URL exists -->. Verifier: `https://antarix.app/help/recruiters#verifying-a-credential` <!-- TODO: confirm this URL exists -->.
- **Send-time / Suppression.** 09:30 local. Skip if: 1+ `credential_share_events` row, unsubscribed, deletion requested, or 0 credentials (Email 4 fires instead).

### Email 7 — Day 14 — Two weeks in

- **Trigger.** `day_14_milestone` (daily 04:00 UTC; `signup_completed_at` is 14 days ago ± 12h). Body switches branches (see **"we miss you" template** in §Templates).
- **Subject variants.** (1) `Two weeks on Antarix` · (2) `You are ahead of {{percentile}}% of students` · (3) `Your credential, your call`
- **Preheader.** `A short note on what we have seen and what is next.`
- **Body — celebrate branch** (credential + 1+ share): Hi {{first_name}} — two weeks in, you have a signed credential and it has been viewed **{{view_count}}** times. That is real distribution. Keep the streak alive and add one more signal — install Power Mode from `https://antarix.app/power-mode` <!-- TODO: confirm this URL exists --> for session-level accuracy. You are ahead of **{{percentile}}%** of students at your stage.
- **Body — we-miss-you branch** (no credential, no share): Hi {{first_name}} — it has been two weeks. Your dashboard is set up but you have not minted a credential yet. That is fine; it is a ten-second action. We will not email you about this again — from here, the only messages you get are the weekly recap (if you want it) and the AI Coach (if you opt in). If Antarix is not for you, no hard feelings; stop the recap from **Settings → Notifications**. Reply and tell us what put you off; we read every one.
- **Send-time / Suppression.** 09:00 local. Skip if: unsubscribed, deletion requested, or dormant (14 days silent AND 14 days without email open — pause the recap instead).

---

## The 4 WhatsApp messages (opt-in only)

These fire only if the user has clicked **Connect WhatsApp** in Settings. Every message ends with the standard opt-out footer. **No emoji in the first message.** 1–2 emoji in messages 2–4 is fine if the user has used emoji in their replies.

### WhatsApp 1 — Day 2 — Acknowledge the opt-in

- **Trigger.** `whatsapp_connected` (fires 24h after the user clicks Connect WhatsApp; offset to avoid overlapping with the Day 1 GitHub email).
- **Message.**
  Hi {{first_name}} — this is Antarix on WhatsApp. We will send you short, useful notes about your score, your streak, and your peak coding hours. We will not spam you.
  Reply `STATS` any time for your current numbers. Reply `PAUSE` to stop. Reply STOP to unsubscribe.
- **Send-time.** Day 2, 10:00 local.

### WhatsApp 2 — Day 4 — Streak check-in

- **Trigger.** `streak_risk_at_48h` (hourly; fires if the user has a 3+ day streak and the last counted signal was 36–60h ago).
- **Message.**
  Hey {{first_name}} — your streak is at {{streak_days}} days, and the last commit was {{hours_since}} hours ago. A short session today keeps it alive. Push a commit or start one from the dashboard. Reply `STATS` for the full picture. Reply STOP to unsubscribe.
- **Send-time.** Day 4, 17:00 local.

### WhatsApp 3 — Day 8 — Peak window nudge

- **Trigger.** `peak_window_nudge` (hourly; fires if the user has at least 7 days of session data and the current hour matches the user's top-2 active hours).
- **Message.**
  {{first_name}}, this is your peak window based on the last 7 days. A 50-minute focused session now is worth three scattered ones later. Start one: https://antarix.app/dashboard Reply STOP to unsubscribe.
- **Send-time.** Day 8, in-window (12:00–20:00 local).

### WhatsApp 4 — Day 12 — Credential share prompt

- **Trigger.** `credential_minted_wa_optin` (fires on Day 12 if the user has a credential but no `credential_share_events`, **and** has WhatsApp opted in).
- **Message.**
  {{first_name}} — your credential is ready and signed. The next step is one share: LinkedIn, email signature, or a recruiter message. It takes 30 seconds. Share it: https://antarix.app/credential/share Reply STOP to unsubscribe.
- **Send-time.** Day 12, 11:00 local.

**Opt-out handling (all four).** Any reply containing STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, or QUIT routes to the `whatsapp-webhook` opt-out handler; the user is marked `opted_out_at = now()` and removed within a minute. PAUSE is a temporary pause, not an opt-out. If the user has not opened the last 3 WhatsApp messages, the streak and peak-window nudges are auto-suppressed (treated as a quiet user).

---

## The 3 milestones

1. **GitHub connected by Day 3.** Target 60% of signups. Driven by Email 1, Email 2, WhatsApp 1.
2. **First credential issued by Day 10.** Target 25% of signups. Driven by Email 3, Email 4.
3. **First credential shared by Day 14.** Target 15% of signups. Driven by Email 6, Email 7.

Measurement: count users where `milestone_field < signup_completed_at + N days`, pulled weekly by the growth team.

---

## The 4 "we stopped sending" rules

The platform auto-suppresses a user from this sequence the moment any of the following is true:

1. **Unsubscribed.** Hard stop on every email. WhatsApp only stops on an explicit STOP reply; email unsubscribe does not auto-WhatsApp-opt-out.
2. **Has 1+ verified credential.** Email 4 stops; Email 5 and 6 still fire unless the recap is disabled in Settings.
3. **Has shared 1+ credential.** Email 6 stops; Email 7 still fires with the celebrate branch.
4. **Account deletion requested.** Hard stop on every channel. Per [Privacy Notice §6](../legal/privacy-notice.md), the 90-day retention window begins; all sends are blocked until the account is purged.

---

## The 3 templates

### Template A — Weekly recap

Reused at Email 5 and every Sunday thereafter (subject to the recap toggle in Settings).

**Subject / Preheader.** `Your week in numbers` / `Streak, score, and one thing to try next week.`

**Body.** See Email 5. Variables: `first_name`, `commit_count`, `repo_count`, `streak_days`, `score`, `score_delta`, `top_skill`, `skill_delta`, `repo_highlight`, `suggestion`. `suggestion` comes from the largest negative skill delta in the last 7 days, falling back to "Schedule one 50-minute Power Mode session" if no skill movement, falling back to "Keep your streak alive" if the streak is at risk.

### Template B — Your credential is ready

Reused at Email 4 and re-fired from a `credential_eligible` server-side event (event-anchored, not day-anchored).

**Subject / Preheader.** `Mint your first credential` / `A credential is a public, signed proof. It takes ten seconds.`

**Body.** See Email 4. Variables: `first_name`, `credential_url`. On the second-or-later fire, swap paragraph 2 to: *"You may have seen our last note about this — the credential is still waiting."*

### Template C — We miss you

Reused at Email 7 (we-miss-you branch) and on any 30-day inactivity trigger, capped at one send per 30 days.

**Subject / Preheader.** `Your Antarix dashboard, waiting` / `A short note on what we have seen and what is next.`

**Body.** See Email 7 we-miss-you branch. Variables: `first_name`, `last_active_at`, `streak_days`, `score`. If 0 connected data sources, paragraph 2 becomes: *"Connect GitHub or Calendar when you are ready. Until then, the weekly recap will not run."*
