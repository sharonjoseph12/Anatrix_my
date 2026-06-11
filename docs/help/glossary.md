# Help Center — Glossary

This page defines the words and acronyms that show up across Antarix — in the dashboard, in the help center, in the legal notices, and in the public API. Terms are grouped by topic, not alphabetical, so the related words sit next to each other. If a word is missing here, email `support@antarix.app` and we will add it. <!-- TODO: confirm support@antarix.app inbox is monitored before launch -->

For step-by-step "how to" content, see the persona pages: [Students](students.md), [Recruiters](recruiters.md), [Colleges](colleges.md), and [Companies](companies.md). <!-- TODO: confirm companies.md exists or remove the link -->

## Core platform

1. **Skill Proof Score** — A 0–100 composite of your coding volume, problem-solving, consistency, and peer review. The four weights are fixed at 40 / 25 / 20 / 15 in v1. Updated nightly at 02:00 UTC. See [Spec §SC-003](../../specs/002-antarix-definitive-vision/spec.md).
2. **Power Mode** — A 14-day focused period where your score updates more frequently and you get a badge on your profile. With Power Mode active, the session-quality weight replaces the calendar-context weight. See [Students → Power Mode](students.md#power-mode).
3. **Peak Window** — Your typical high-focus hours, derived from your commit and session history. The AI Coach times nudges to your peak window, and recruiters see it on your profile card. See [Students → The AI Coach and WhatsApp](students.md#the-ai-coach-and-whatsapp).
4. **Streak** — The number of consecutive days with at least one counted signal (a commit, a session, or a study block). A streak resets to zero if you miss a day. Streak length is one input to the Skill Proof Score's consistency component. See [Students → Solving problems on the platform](students.md#solving-problems-on-the-platform).
5. **AI Coach** — The daily WhatsApp and web-push service that sends a personalized suggestion of what to do next. You can opt in or out at any time. Reply `PAUSE` to any WhatsApp message to stop. See [Students → The AI Coach and WhatsApp](students.md#the-ai-coach-and-whatsapp).
6. **Nudge** — A short, single-action message from the AI Coach, typically 3 to 4 lines. Nudges fire inside your peak window and reference a specific project or skill. Real-time nudges fire on a 90-minute cadence during peak hours.
7. **Placement Prediction** — A 0–100% probability that you will land a placement in your declared tier, plus an estimated time-to-ready and a top-3 list of skill gaps. Refreshed weekly. Not shared with recruiters unless you opt in. See [Students → The placement prediction](students.md#the-placement-prediction).

## Verifiable credentials

8. **W3C Verifiable Credential** — An open standard for digital credentials that any third party can verify cryptographically, without contacting the issuer. Antarix issues every credential as a W3C VC v2.0 envelope. See [W3C VC Strategy](../w3c-vc-strategy.md).
9. **did:web** — A W3C DID method that derives a DID from a web domain. Antarix uses `did:web:antarix.app:c/<uuid>` for credentials and `did:web:antarix.app` for the issuer. Any third party can resolve the DID over HTTPS. See [W3C VC Strategy](../w3c-vc-strategy.md).
10. **EdDSA** — Edwards-curve Digital Signature Algorithm. Antarix signs every credential with EdDSA over Curve25519, using a key published at the well-known `did.json` endpoint. See [W3C VC EdDSA Rollout](../w3c-vc-eddsa-rollout.md).
11. **Verifiable Presentation** — A signed bundle of one or more Verifiable Credentials that a holder shares with a verifier in a single envelope. Antarix v1 issues single-credential presentations, not bundles.
12. **Credential Slug** — The short, human-readable identifier at the end of your public credential URL, for example `priya-2026-cs`. The slug is yours forever, even if you re-issue. See [Students → Getting your first credential](students.md#getting-your-first-credential).
13. **Slug** — A short, URL-safe identifier. Used for credential slugs, college slugs, and company slugs. Slugs are 3 to 32 characters, lower-case, and globally unique within Antarix.

## Recruiter-side terms

14. **Search-Visible** — A student-side privacy toggle that controls whether your profile appears in recruiter search results. Opted-out students are excluded from every aggregate count that could leak their presence. See [Students → Privacy controls](students.md#privacy-controls).
15. **Fit/Match Score** — A 0–100 score that blends your Skill Proof Score with the recruiter's filter weights, shown on each search result row. It is a soft signal, not a hard cut. See [Recruiters → Signing up and your first search](recruiters.md#signing-up-and-your-first-search).
16. **One-Click Invite** — A single action that sends a candidate a role-specific message via Antarix. Each send costs one credit, regardless of the candidate's response. The candidate's email is never revealed. See [Recruiters → The contact button](recruiters.md#the-contact-button).
17. **Seat** — A licensed user inside a company account. Each seat is one recruiter. Adding a seat is a billing event; removing a seat is a proration event. See [Recruiters → Pricing and credits](recruiters.md#pricing-and-credits).
18. **Search Credit** — A unit of search consumption. One credit is consumed per result page (25 candidates). Credits reset on the first of each month at 00:00 UTC. See [Recruiters → Pricing and credits](recruiters.md#pricing-and-credits).
19. **ATS Integration** — A webhook connector that pipes Antarix events (invites, responses, outcomes) into a company's Applicant Tracking System. Greenhouse, Lever, and Workday have first-class connectors. See [Companies → ATS integration](companies.md#ats-integration). <!-- TODO: confirm companies.md ships with this anchor -->
20. **LPA** — Lakhs Per Annum, the Indian salary unit (1 LPA = 100,000 INR per year). Used in the recruiter salary-band filter. Candidates self-declare their LPA band. See [Recruiters → Filters explained](recruiters.md#filters-explained).

## College-side terms

21. **Cohort** — The set of students from a single college, batch, and branch that a placement officer can see on the college dashboard. A cohort is the unit of analysis for placement readiness and curriculum intelligence. See [Colleges → Onboarding your cohort](colleges.md#onboarding-your-cohort).
22. **Cohort Percentile** — Your Skill Proof Score's percentile rank within your declared cohort (college + batch + branch). A score of 75 means you are in the top 25% of your cohort. See [Spec §FR-007](../../specs/002-antarix-definitive-vision/spec.md).
23. **Roster** — The list of students that a college invites to Antarix. The roster is the source of truth for cohort membership and is uploaded via CSV or pushed via the public API. See [Colleges → Roster sync](colleges.md#roster-sync).
24. **Leaderboard** — A ranked view of opted-in students by Skill Proof Score, per batch. Off by default. The leaderboard shows the top 10 by default and can be expanded to the top 50. See [Colleges → Leaderboards](colleges.md#leaderboards).
25. **Curriculum Intelligence** — The weekly recommendation engine that compares your cohort's skill supply to industry demand and suggests a curriculum change. Recommendations refresh alongside the placement prediction. See [Colleges → Curriculum intelligence](colleges.md#curriculum-intelligence).
26. **Placement Readiness Bucket** — One of three segments: **Ready Now**, **Development Path**, or **Early Stage**. The cohort dashboard splits opted-in students across these three buckets based on a heuristic score. See [Spec §US6](../../specs/002-antarix-definitive-vision/spec.md).

## Authentication & access

27. **Magic Link** — A one-time, email-based sign-in link that bypasses passwords. Magic links expire in 14 days and can be used once. Used in the bulk-invite flow. See [Colleges → Onboarding your cohort](colleges.md#onboarding-your-cohort).
28. **TOTP (2FA)** — Time-based One-Time Password, the standard for two-factor authentication. Generated by apps like Google Authenticator, 1Password, and Authy. Required for any recruiter account that issues invites. See [Recruiters → Signing up and your first search](recruiters.md#signing-up-and-your-first-search).
29. **OAuth Scope** — A permission that a third-party app requests from a data source. Antarix only requests read-only scopes (`read:user`, `public_repo`, `calendar.readonly`). We never ask for write access to GitHub, Google Calendar, or any other source. See [Students → Connecting GitHub](students.md#connecting-github).
30. **API Key** — A per-company token used to authenticate public API calls. API keys are issued from the company dashboard, can be rotated at any time, and never expire. See [API Verification](../api-verification.md).
31. **Service Role Key** — A Supabase admin key that bypasses RLS. Used only by Edge Functions and migrations, never shipped to the browser or to user devices. Rotated quarterly. See [Observability](../observability.md).

## Infrastructure

32. **Edge Function** — A Deno-based serverless function deployed to Supabase's global edge. Antarix runs roughly 30 Edge Functions, including credential issuance, webhook delivery, and the AI Coach. See [Observability](../observability.md).
33. **Rate Limit** — A per-user, per-function cap on how many requests a client can make in a window. The default is 60 requests per second. The cap is enforced server-side and returns 429 with a `Retry-After` header. See [Rate Limiting](../rate-limiting.md).
34. **Cron Job** — A scheduled task. Antarix runs nightly score recomputes, hourly webhook retries, and daily rate-limit garbage collection. Cron jobs are defined in SQL migrations and scheduled with `pg_cron`.
35. **RLS (Row Level Security)** — A Postgres feature that filters rows based on the calling user's identity. Antarix uses RLS to enforce per-tenant data isolation — every table has RLS enabled, and most have no policies (service-role only). See [W3C VC Strategy](../w3c-vc-strategy.md).
36. **VAPID** — Voluntary Application Server Identification, a web-push standard. Antarix uses VAPID for browser notifications, with a per-environment key pair. iOS Safari does not support VAPID in v1.
37. **Webhook Signature** — An HMAC-SHA256 header (`X-Antarix-Signature: t=<unix>,v1=<hex>`) that lets a partner verify a webhook came from Antarix. The signature uses a per-endpoint secret, generated with 32 bytes of entropy. See [Webhooks](../webhooks.md).
38. **Webhook Delivery** — A single attempt to POST a webhook event to a partner's endpoint. Retried up to 5 times on failure, with exponential back-off. The minimum interval between attempts is 30 seconds. See [Webhooks](../webhooks.md).

## Legal & compliance

39. **DPDP Act** — India's Digital Personal Data Protection Act, 2023. Sets the rules for processing the personal data of Indian data principals. See [DPDP Act Notice](../legal/dpdp-act-notice.md).
40. **Data Fiduciary** — The entity that decides the purpose and means of processing personal data. Antarix is a Data Fiduciary for its own data and a Data Processor for college and company data. Colleges are Data Fiduciaries for their students' data. See [DPDP Act Notice](../legal/dpdp-act-notice.md).
41. **Data Processor** — An entity that processes data on behalf of a Data Fiduciary. Antarix is a Processor for any data a college or company uploads about a candidate. Processors must follow the Fiduciary's instructions and sign a Data Processing Addendum. See [DPDP Act Notice](../legal/dpdp-act-notice.md).
42. **Grievance Officer** — The person designated under the DPDP Act to receive and resolve data-principal complaints within 30 days. The current Grievance Officer is listed in the [DPDP Act Notice §8](../legal/dpdp-act-notice.md). Complaints can also be escalated to the Data Protection Board of India.
