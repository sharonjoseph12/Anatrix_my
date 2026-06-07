# Help Center — Students

This page covers everything you can do as a student on Antarix: signing up, connecting your accounts, reading your Skill Proof Score, getting your first verifiable credential, and controlling what gets shared. It is written for the student, not the recruiter or the placement officer. If you want to fix something specific right now, jump to [Troubleshooting](troubleshooting.md). If a word in this page is unfamiliar, see the [Glossary](glossary.md).

## Getting started

You can go from "I just heard about Antarix" to "I have a real dashboard with my own data" in under three minutes. You do not need to install anything to get value.

1. Open `https://antarix.app/signup`. Click **Continue with GitHub**. If you do not have a GitHub account, click **Sign up with email** instead and create a password.
2. Read and accept the Privacy Notice. You can leave at any time. The minimum we need is your email and your goals.
3. On the profile screen, pick your goals (DSA, web, ML, etc.) and your self-declared skill level. Click **Go to Dashboard**.
4. The dashboard will load with real, GitHub-derived insights within about 60 seconds: your total commits in the last 90 days, your top three languages with percentages, your peak coding hours, and your first Skill Proof Score. <!-- TODO: add screenshot after UI is finalized -->
5. Optional: from the dashboard, click **Connect Google Calendar** and **Install Power Mode** to unlock more accurate scoring and the AI Coach. Both are optional. The product works fully without them.

## Connecting GitHub

Connecting GitHub is the fastest way to give the platform real data. You only do it once.

1. From the dashboard, click **Connect GitHub**. You will be redirected to GitHub's official OAuth screen.
2. Approve the requested scopes. Antarix asks for `read:user` and access to your public repositories. You may optionally grant access to private repos.
3. You will be redirected back to Antarix. Within two hours of a fresh sync, your commits, languages, and active streak will appear on the dashboard.

**What we read:** your user ID, username, public commit metadata (hash, repo, branch, author, timestamp, file counts, additions, deletions), repository metadata (name, primary language, stars, forks, public flag, README/CI/releases presence), and pull request metadata. **What we do not read:** issue content, issue comments, discussion posts, code diffs, or anything beyond the first 200 characters of a commit message. We never log into GitHub on your behalf.

**How to revoke:** go to **Settings → Sources → GitHub** and click **Disconnect**. Then revoke the OAuth grant from your GitHub account at `https://github.com/settings/applications`. Antarix stops syncing within an hour. See [Privacy Notice](../legal/privacy-notice.md) for the data retention rules.

## Connecting calendar

Connecting Google Calendar is optional. It lets the AI Coach respect your class schedule and exam weeks, and it makes the placement prediction aware of your free time.

1. From the dashboard, click **Connect Google Calendar**. You will be redirected to Google's OAuth screen.
2. Approve the requested scopes. We only ask for read access to events.
3. You will be redirected back to Antarix. Your class schedule, deadlines, and free time windows appear on the dashboard within six hours.

**What we track:** event IDs, start and end times, titles, attendee count, and your RSVP status. We compute derived flags: `is_class`, `is_deadline`, `is_study_group`, `is_free_window`. **What we ignore:** event descriptions, attachments, conference links, the email addresses of other attendees, and any free-text content. We never create, modify, or delete events on your calendar.

## Solving problems on the platform

Antarix is built around a single idea: a "problem" is a coding challenge you attempt on the platform, and your **Skill Proof Score** is the proof that you can solve them.

1. From the dashboard, click **Start a session**. Pick a category: DSA, Coding, Project, Learning, or Research.
2. The session timer starts. The extension (if installed) samples your active window and tab focus.
3. When you finish, click **End session**. Give yourself a 1–5 focus rating and (optionally) a short note. The session is queued for sync.
4. After sync, your Skill Proof Score recomputes within about an hour, and you can see the new score plus a delta on the dashboard.

**How scoring works.** Your Skill Proof Score is a 0–100 composite of coding volume (commits, PRs, sessions), problem-solving (DSA submissions, project completions), consistency (your active streak), and peer review (PRs reviewed, comments). The weights are documented in the [Spec §FR-005](../../specs/002-antarix-definitive-vision/spec.md) and change when you install Power Mode (session quality replaces the calendar-context weight). See the [Glossary entry on Skill Proof Score](glossary.md#skill-proof-score).

**The consistency streak.** Your streak is the number of consecutive days with at least one counted signal (a commit, a session, or a calendar event flagged as a study block). Miss a day, the streak resets to zero. Streak loss triggers a risk alert nudge if you have streak-at-risk alerts turned on. See [SC-014](../../specs/002-antarix-definitive-vision/spec.md) for the documented behaviour.

## Getting your first credential

A verifiable credential is a public, signed proof of your Skill Proof Score. Anyone with the link can verify it, with no Antarix account required.

1. Reach the eligibility threshold: at least one sync cycle with GitHub connected, and a Skill Proof Score above zero. There is no minimum activity period for the *first* credential, only for the placement prediction.
2. From the dashboard, click **Credential**. Click **Generate credential**. A snapshot of your current score is taken.
3. Your credential gets a public URL of the form `https://antarix.app/verify/{your-slug}` and a W3C DID identifier of the form `did:web:antarix.app:c/{uuid}`. The slug is yours forever.
4. Click **Download PDF** for a printable, signed copy. Click **Download QR** for a QR code that points at the URL.
5. Click **Share to LinkedIn**. This opens LinkedIn with a pre-filled URL in the "Licenses & Certifications" field.
6. Anyone who clicks the link — a recruiter, a college admin, your parents — sees your name, institution, current score, per-skill proficiency, cohort percentile, and a "last verified" timestamp. You can revoke the credential by deleting your account.

The full cryptographic model is documented in [docs/w3c-vc-strategy.md](../w3c-vc-strategy.md). The public verifier is described in [docs/api-verification.md](../api-verification.md).

## The AI Coach and WhatsApp

The AI Coach is a daily message that tells you what to do now or what to do next. It works on WhatsApp (primary) and on web/extension push (fallback).

**How to opt in.** From the dashboard, click **Settings → Notifications → WhatsApp**. Click **Connect WhatsApp**. A `wa.me` deep link opens WhatsApp on your phone. Send the pre-filled message. You will be marked opted-in within a minute. **What messages look like.** A typical daily morning nudge is short, three to four lines, and references your real data: "Hey Priya — your streak is at 12 days, you shipped 8 commits yesterday, and you have a free window at 4 PM. Want to start a 90-minute DSA session?" Real-time nudges fire inside your peak window and reference a specific project. Weekly summaries fire on Sunday.

**How to opt out.** Reply `PAUSE` to any WhatsApp message, or go to **Settings → Notifications → WhatsApp** and click **Disconnect**. We will stop sending within a minute. You can re-opt-in at any time. See [docs/whatsapp-setup.md](../whatsapp-setup.md) for the operator-side details.

## The placement prediction

The placement prediction is a 0–100% probability that you will land a placement in your declared tier, plus an estimated time-to-ready and a top-3 list of skill gaps. It is a learning aid, not a verdict.

**What it is.** A weekly refresh of a heuristic scorer that uses your current Skill Proof Score, your 90-day score trajectory, your cohort percentile, your project completion rate, your consistency score, and a Power-Mode bonus. The full input list is in [research.md §Decision B](../../specs/002-antarix-definitive-vision/research.md).

**What it is not.** It is not used to make adverse decisions (no loans, no credit, no insurance). It does not appear on your credential. It is not shared with recruiters or colleges unless you opt in.

**How to opt out.** Go to **Settings → Privacy → Placement prediction** and toggle it off. The rest of the product, including the Skill Proof Score and the credential, remain fully functional.

**"Why this?" link.** On the placement card, click **Why this?** to see the exact inputs that fed the prediction. We surface every input so you can challenge it and improve it.

## Privacy controls

All of your privacy controls live under **Settings → Privacy**.

- **Visibility.** Toggle your profile to public, unlisted (only people with the link), or private.
- **Searchability.** Opt in or out of company search. Opted-out students are excluded from every search result and from every aggregate count that could leak their presence. See [Privacy Notice §FR-016](../legal/privacy-notice.md).
- **Data export.** Click **Export my data**. We will email you a JSON archive of your account, profile, connections, score history, and credentials within 30 days. <!-- TODO: confirm the export link exists after the marketing site ships -->
- **Account deletion.** Click **Delete my account**. Personal data is purged within 30 days, and any verifiable credential is invalidated within 24 hours. Aggregated, non-identifying metrics may persist. See [Privacy Notice §6](../legal/privacy-notice.md) and [DPDP Act Notice](../legal/dpdp-act-notice.md).

## Power Mode

Power Mode is the optional Chrome Extension. It upgrades (never gates) the experience. If you never install it, everything else still works.

**What it is.** A small extension that lets you start and stop categorized work sessions, samples your active window and tab focus, computes a session-level focus quality (HIGH/MEDIUM/LOW), and syncs sessions to the backend hourly.

**How to enter.** From the dashboard, click **Install Power Mode**. You are taken to the Chrome Web Store listing. Approve the install. The extension sends a heartbeat to Antarix, and a ⚡ badge appears on your profile within 24 hours.

**How to leave.** Uninstall the extension from `chrome://extensions`. The badge is removed within 24 hours of the last heartbeat. Historical sessions remain visible (with a "last seen" timestamp), and the score weighting reverts to passive-only. <!-- TODO: add screenshot after UI is finalized -->

**What changes.** With Power Mode active, your score uses the Power-Mode weighting (session quality replaces the calendar-context weight), the badge appears in recruiter search results, and the AI Coach can reference your real session data. You can see the difference between passive-only and Power-Mode scores on demand from the score card.

## Troubleshooting

Something broken? See [Troubleshooting](troubleshooting.md). The most common issues — score did not update, credential share link 404, WhatsApp not delivering — are covered there.

## Glossary

Stuck on a word? See the [Glossary](glossary.md) for short definitions of Skill Proof Score, peak window, W3C Verifiable Credential, cohort, and 35+ more.
