# Help Center — Colleges

This page is for the placement officer, the HOD, the TPO, and the dean. It covers onboarding your cohort, reading the cohort dashboard, drilling into a student, and the legal ground rules for handling student data. If something is broken, jump to [Troubleshooting](troubleshooting.md). If a word is unfamiliar, see the [Glossary](glossary.md). The legal basis for processing student data in India is in the [DPDP Act Notice](../legal/dpdp-act-notice.md); the global rules are in the [Privacy Notice](../legal/privacy-notice.md).

## Onboarding your cohort

You have three ways to add students. Pick the one that matches the size of your batch.

1. **Bulk CSV invite.** From the college dashboard, click **Cohort → Invite students → Upload CSV**. The file must have one row per student with the headers `email,full_name,roll_no,batch,branch` (in that order). Drag the file in. Antarix sends a magic-link invite to every email. No passwords are created up front.
2. **Magic link.** From **Cohort → Invite students → Send magic link**, paste a list of emails (one per line) and click **Send**. Each student gets a one-click sign-up link that expires in 14 days. <!-- TODO: confirm the magic-link expiry is 14 days -->
3. **Manual entry.** For a handful of students, click **Add student** and fill the form. This is the slowest path and is intended for one-off additions.

In all three cases, the student must opt in to Antarix tracking before any of their data shows up on your dashboard. Opt-in happens at the student's first dashboard visit.

## The cohort dashboard

The cohort dashboard is the landing page after you sign in. It has five charts. Read them in order; they are designed to answer the next obvious question.

1. **Placement readiness (stacked bar).** A three-bucket segmentation of your opted-in students: **Ready Now**, **Development Path**, **Early Stage**. The buckets sum to the total opted-in count, never the total enrolled. The thresholds are documented in the [Spec §US6 acceptance scenario 1](../../specs/002-antarix-definitive-vision/spec.md).
2. **Score distribution (histogram).** The distribution of Skill Proof Scores across your opted-in students, bucketed in 10-point bands. Use it to spot whether your cohort is clustered at the low end (curriculum gap) or the high end (strong batch).
3. **Streak leaders (top-10 table).** The ten students with the longest current active streak. A long streak is a leading indicator of placement readiness. Use this list for kudos, not for exclusion.
4. **At-risk students (table).** The students whose streak broke in the last 7 days **and** whose score dropped more than 5 points in the last 30 days. These are the students most likely to need a one-on-one conversation.
5. **Top 10 (table).** The ten highest-scoring students in the cohort, with their current score, Power-Mode status, and last-active timestamp. Use this for the company-match auto-send flow.

## Drilling into a student

Click any name in any of the tables to open that student's drill-down page. The page respects the student's individual privacy choices. The rules are simple and strict.

**You can see:** the student's name, declared branch and batch, current Skill Proof Score, score history (a line chart, not a raw table), per-skill proficiency breakdown, current streak length, Power-Mode status, placement prediction (if generated and not opted out of), public credential URL, and the date they last connected each data source.

**You cannot see:** the student's email address, the student's phone number, the student's private repositories, the student's calendar event titles or descriptions, the student's WhatsApp message content, or any other student's individual data. If a student has opted out of company search, they are also excluded from every cohort aggregate that could leak their presence — see [Privacy Notice §FR-016](../legal/privacy-notice.md).

If you need to contact a student from the drill-down page, click **Message**. Antarix brokers the first message; you do not see the student's contact details.

## Curriculum intelligence

The **Curriculum** tab answers the question: "What should we teach next?"

The recommendation engine compares the **skill supply** in your cohort (the per-skill proficiency breakdown aggregated across opted-in students) against the **industry demand** signal derived from the verified skills of placed Antarix students in the same tier. The output is a ranked list of skill gaps with a recommended next-week action: "add a 2-week module on PostgreSQL", "schedule a mock interview on system design", "introduce a Docker-based project in week 5".

The full model is described in [research.md §Decision B](../../specs/002-antarix-definitive-vision/research.md). Recommendations refresh weekly, alongside the placement prediction refresh.

## Leaderboards

The **Leaderboard** tab shows the live ranking of opted-in students by Skill Proof Score, per batch. Tie-breakers, in order: higher current streak, more recent last-active timestamp, then alphabetical by slug. The full tie-breaker list is in the [Spec A-012](../../specs/002-antarix-definitive-vision/spec.md).

**How to enable.** Leaderboards are off by default. To turn them on, go to **Settings → Cohort → Leaderboards** and toggle **Show batch leaderboards to students**. Enabling this does not share scores with any other batch.

**How to disable.** Toggle the same switch off. Leaderboards hide within an hour across all student views.

**Fairness considerations.** Leaderboards are an extrinsic motivator. They can help strong students and they can hurt struggling students. The published guidance is to pair a leaderboard with an opt-out for any student who finds it demotivating; the toggle lives in **Settings → Privacy → Leaderboard visibility** for each student. <!-- TODO: confirm the per-student leaderboard opt-out ships in v1 -->

## Alumni tracking

When a batch graduates, students transition into the alumni view automatically at the end of the configured academic year. The alumni view shows lifetime metrics: placements (if the alumnus has opted in to share them), tier at placement, salary band (if shared), and a link to their public credential.

**Privacy opt-out.** Alumni can opt out of any or all of the above at any time from **Settings → Privacy → Alumni visibility**. An opted-out alumnus is excluded from every aggregate count that could leak their presence, including the batch's placement-rate numerator and denominator. The full rule is in [Privacy Notice §FR-019](../legal/privacy-notice.md).

## DPDP compliance

If you are onboarding Indian students, you are processing personal data under the DPDP Act 2023, and Antarix is your Data Processor.

- **Parental consent for under-18 students.** Antarix is an 18+ service. We do not knowingly collect data from anyone under 18, and we delete any under-18 account within 7 days of discovery. **Verifiable parental consent is not yet supported** — see the [DPDP Act Notice §3](../legal/dpdp-act-notice.md). If your college has students under 18, do not include them in the bulk invite until the parental-consent flow ships.
- **Data localization.** Indian students' personal data is stored in the Mumbai region. Cross-border transfers to non-negative-list destinations are documented in [DPDP Act Notice §6](../legal/dpdp-act-notice.md).
- **Breach notification.** In the event of a personal-data breach that is likely to cause harm, Antarix will notify the Data Protection Board of India within 72 hours and notify affected data principals without unreasonable delay. See [DPDP Act Notice §7](../legal/dpdp-act-notice.md).

The full Data Processing Addendum template is in [dpa-template.md](../legal/dpa-template.md). Sign and return it to `privacy@antarix.app` before processing begins.

## Roster sync

There is no first-party LMS integration in v1. The two ways to keep your roster in sync are:

- **Manual re-upload.** Re-export your LMS roster as CSV and re-upload it. The system dedupes by email. This works for any LMS.
- **Public API.** Use the Antarix public API to push roster updates programmatically. Authentication is via a per-company API key. The reference is in [docs/api-verification.md](../api-verification.md) and the OpenAPI spec at `specs/003-engage-and-showcase/openapi.yaml`. <!-- TODO: link the LMS sync doc when it lands -->

If you are evaluating a first-party integration (Moodle, Canvas, Google Classroom, an internal SIS), email `partnerships@antarix.app`.

## Troubleshooting

Something broken? See [Troubleshooting](troubleshooting.md). The most common college-side issues — CSV upload errors, missing students in the cohort, leaderboard toggle not propagating — are covered there.
