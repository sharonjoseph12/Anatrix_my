# Feature Specification: 11/10 — Defensible Moat & Global Scale

**Feature Branch**: `004-eleven-of-ten`
**Created**: 2026-06-06
**Status**: Draft
**Builds on**: 001 (foundation) + 002 (verified skill platform) + 003 (engage & showcase)
**Input**: User vision to convert Antarix from "8/10 product" to "11/10 defensible moat" via 13 enhancements grouped under five themes: integrity, reach, enterprise, ecosystem, and engagement.

## Why this exists

001-003 delivered a working three-portal SaaS with passive verification, AI Coach, and DSA + public profile. The product is good but not yet defensible. The Skill Proof Score will be gamed within 12 months without active anti-cheat; recruiters will not adopt without ATS sync; colleges will not commit without SAML SSO and outcome-based pricing; tier-2/3 students will not stay without Hindi/regional language; and the moat will not compound without a faculty layer, a hackathon loop, and a public API.

This feature converts the existing platform into the **default credential layer for Indian tech hiring** with three explicit deferrals captured for v2 (mobile RN, ClickHouse, native group-video assessments).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Anti-cheat keeps the Skill Proof Score trustworthy (Priority: P1)

A student syncs a GitHub account that contains 14 forked repositories with no commit history, 6 repos generated entirely by an AI tool, and 1 genuine project. The Skill Proof Score must reflect the 1 genuine project only; the cheat signal must be surfaced to the student transparently (with an appeal flow) and recorded for college-admin audit.

**Why this is P1**: Without this, the entire trust narrative collapses within a year. Every other enterprise sale depends on the score being defensible.

**Independent test**: Seed a synthetic GitHub account with the 21-repo distribution above. Run `github-anticheat` edge function. Assert: contribution_signals row created, suspicious_score ≥ 0.6, score recompute excludes flagged repos, student notification fired, audit log row written.

**Acceptance scenarios**:
1. **Given** a student with 14 forks and zero commits in those forks, **when** anti-cheat runs, **then** all 14 forks contribute 0 to score, the cheat signal is `fork_no_commits`, and the student sees the explanation card in `/dashboard/skills`.
2. **Given** a repository whose commit times cluster within a 30-minute window and whose code matches a public AI-output fingerprint, **when** anti-cheat runs, **then** the signal is `ai_generated_suspect` with confidence ≥ 0.7 and the repo is quarantined pending student appeal.
3. **Given** a student appeals a quarantine with evidence (commit chain or video walkthrough), **when** a college mentor approves the appeal, **then** the repo is restored to scoring and the audit row records the override.

---

### User Story 2 — Recruiter receives verified candidates in their existing ATS (Priority: P1)

A recruiter at a mid-sized tech company uses Greenhouse as their primary ATS. They open Antarix once, configure their Greenhouse API key, and define a saved search (e.g. `react AND verified_score ≥ 75`). Whenever 5+ new students match, Antarix pushes them to a designated Greenhouse pool with the Skill Proof Score embedded as a custom field. The recruiter never logs into Antarix again.

**Why this is P1**: Recruiters live in their ATS. Asking them to switch UIs is the #1 deal killer. ATS sync inverts the burden.

**Independent test**: Mock Greenhouse API. Configure 1 saved search. Trigger 6 matching student profiles. Assert: 6 Greenhouse candidate POSTs with `custom_fields.antarix_score` populated, 1 push notification to recruiter, 1 row in `ats_sync_log` with status=success.

**Acceptance scenarios**:
1. **Given** a recruiter with a configured Greenhouse integration and a saved search, **when** 5+ students newly match, **then** Antarix POSTs candidates to Greenhouse within 5 minutes and notifies the recruiter via email.
2. **Given** a recruiter using Lever instead of Greenhouse, **when** they configure their Lever integration, **then** the same flow uses the Lever API and writes the score to a Lever tag.
3. **Given** an ATS API call fails 3 times, **when** the system reaches the failure threshold, **then** the sync is paused, the recruiter is notified, and the saved search status shows `paused — credential issue`.

---

### User Story 3 — Tier-2/3 student receives AI Coach in their first language (Priority: P1)

A student at a Tier-3 college in Tamil Nadu prefers Tamil for daily nudges. They select Tamil in `/settings/language`. The next morning, the daily-morning nudge arrives in Tamil via Discord (their selected free channel). The placement-prediction explanation card and the public profile remain in English (international-recruiter facing), but every coach surface and on-platform notification is rendered in Tamil.

**Why this is P1**: Tier-2/3 colleges are 70% of the addressable Indian engineering student market. English-only doubles churn.

**Independent test**: Seed 1 student with `locale=ta`. Trigger `nudge-dispatch-extended`. Assert: rendered template uses Tamil catalog, Discord webhook POST body contains Tamil text, no English fallback unless the key is missing from the Tamil catalog (and missing keys log a translation gap).

**Acceptance scenarios**:
1. **Given** a student with `locale=hi`, **when** the daily-morning nudge dispatches, **then** the message body is rendered from the Hindi catalog and contains the student's first name unaltered.
2. **Given** a translation key is missing from the Marathi catalog, **when** the renderer runs, **then** it falls back to English AND writes a row to `i18n_missing_keys` for the translator queue.
3. **Given** a student switches their language in settings, **when** they receive the next nudge, **then** it is rendered in the newly selected language within one nudge cycle (no caching of the old locale).

---

### User Story 4 — College admin signs in via SAML; faculty grade contributes to score (Priority: P2)

A college admin from a partner institution clicks "Sign in with SSO," is redirected to their college Identity Provider (Okta / Azure AD), authenticates, and lands on the college dashboard with their role auto-mapped. Once inside, faculty members at the same college can grade student assignments and capstone projects through Antarix; verified faculty grades contribute a deterministic weight to the Skill Proof Score.

**Why this is P2**: Unlocks enterprise college deals but only after P1 trust + reach are solid.

**Independent test**: Configure a mock SAML IdP (WorkOS test mode). Authenticate `[email protected]`. Assert: user row created with `role=college_admin` and `institution_id` correctly linked, session cookie set, `/college/dashboard` loads. Then, with a faculty account, grade an assignment and assert the score recompute reflects the new `faculty_grade` weight.

**Acceptance scenarios**:
1. **Given** a college with a configured SAML connection, **when** an admin authenticates via the IdP, **then** they are signed in within 3 seconds and their role is set from the SAML attribute mapping.
2. **Given** a faculty member with `is_verified_faculty=true`, **when** they grade an assignment 0–100, **then** the grade contributes a documented weight to the student's score within the next score recompute cycle (≤ 6 hours).
3. **Given** a student receives a faculty grade, **when** they view their Skill Proof breakdown, **then** the faculty contribution is shown as a separate, attributable line ("Graded by Prof. X, MIT-AOE, on 2026-06-01").

---

### User Story 5 — Recruiter posts a hackathon; students compete; top performers get fast-tracked (Priority: P2)

A recruiter posts a 48-hour hackathon problem ("Build a recommendation API in Python") with a prize structure. Students opt in; submissions are auto-evaluated against test cases plus AI-rubric review. Top 5% are fast-tracked into the recruiter's interview pipeline; all participants receive a hackathon-participation credential added to their verified profile.

**Why this is P2**: Creates a recruiting funnel AND content marketing loop. Each hackathon generates evidence for the Skill Proof Score AND a marketing artifact (leaderboard, winner reels).

**Independent test**: Create 1 hackathon with 1 test case. Submit 3 student solutions (1 passing, 2 failing). Assert: passing submission auto-graded, hackathon_participation credential issued, recruiter sees top-1 fast-track suggestion.

**Acceptance scenarios**:
1. **Given** a hackathon with public test cases and a 48-hour window, **when** a student submits valid code, **then** the submission is graded within 60 seconds and the score is shown on the live leaderboard.
2. **Given** the hackathon ends, **when** the recruiter views results, **then** the top 5% are flagged for fast-track invitation with one click.
3. **Given** a participant did not win, **when** they view their public profile, **then** a "Hackathon: <Name>" badge appears with the rank and the verified code link.

---

### User Story 6 — Developer integrates Antarix verified scores into their own product via Public API (Priority: P3)

A third-party career platform wants to display Antarix Skill Proof Scores on their job postings. Their developer generates an API key, subscribes to a `score.updated` webhook, and pulls a student's public credential JSON via `GET /v1/public/profiles/<slug>`. Rate limits, API key revocation, and webhook signature verification all work as documented.

**Why this is P3**: Long-term moat. Becomes the protocol everyone integrates with.

**Independent test**: Create an API key. Make 100 authenticated requests; assert success. Make 101st request; assert 429 rate-limit. Subscribe to webhook; trigger a score update; assert webhook POST received with valid HMAC signature.

**Acceptance scenarios**:
1. **Given** a valid API key with `read:public_profile` scope, **when** a GET request is made to a public profile endpoint, **then** the response returns within 500ms with verified profile JSON and a `Cache-Control: public, max-age=300` header.
2. **Given** an API key exceeds 100 req/min, **when** the 101st request arrives, **then** the response is 429 with a `Retry-After` header.
3. **Given** a webhook subscription, **when** a subscribed event fires, **then** the POST body is signed with HMAC-SHA256 and the subscriber can verify the signature using the documented shared secret.

---

### User Story 7 — Mock technical interview with LLM voice/chat scoring (Priority: P2)

A student starts a mock interview from `/dashboard/practice/mock-interview`. They choose a topic (e.g. "system design — URL shortener"). An LLM-powered interviewer asks open-ended questions via chat (voice optional, behind a flag). At the end, the student receives a structured rubric score (clarity, depth, correctness) plus a transcript. Scores from validated mock interviews contribute a small weight to the Skill Proof Score (with a strict cap to prevent grinding).

**Why this is P2**: Closes the active-validation gap that purely passive GitHub/DSA sync leaves open.

**Independent test**: Start a mock interview session. Submit 3 chat responses. Assert: session row created, LLM responses streamed, final rubric persisted, score contribution capped per week.

**Acceptance scenarios**:
1. **Given** a student starts a mock interview, **when** they submit a response, **then** the LLM follow-up question arrives within 5 seconds.
2. **Given** a student completes a mock interview, **when** the rubric is computed, **then** they receive scored feedback within 30 seconds and the result appears in `/dashboard/practice/history`.
3. **Given** a student attempts a 5th mock interview in 7 days, **when** the system checks the rate limit, **then** they may complete it but no additional score weight is granted beyond the weekly cap.

---

### User Story 8 — Public profile is rendered in the student's chosen language with PWA offline support (Priority: P3)

A student installs the PWA on their phone. They open the app while on a flaky Tier-3 college Wi-Fi connection; the dashboard loads from the service-worker cache, the AI Coach inbox shows the last-synced messages, and any score-update queue is held until connectivity returns.

**Why this is P3**: Removes the "needs mobile app" objection without the cost of a React Native build, and is a direct unblock for tier-2/3 reach.

**Independent test**: Build PWA, install to a desktop Chrome instance, disconnect network, navigate to dashboard. Assert: dashboard renders from cache, queued mutations sync on reconnect.

**Acceptance scenarios**:
1. **Given** a PWA-installed student goes offline, **when** they open the dashboard, **then** they see the last-cached state with an offline banner.
2. **Given** they take an action offline (e.g. mark a nudge read), **when** connectivity returns, **then** the action is replayed via background sync.
3. **Given** a student installs the PWA, **when** a critical nudge fires, **then** a native OS push notification appears (using existing web-push infrastructure).

---

### User Story 9 — Outcome-based pricing contract for college (Priority: P3)

A college admin selects an "outcome-based" plan: instead of paying per seat, the college pays a flat fee per placement-secured event (defined as: student accepted a verified offer through Antarix). The contract page shows live placement counts and live billing. This unlocks colleges that won't commit to per-seat pricing upfront.

**Why this is P3**: Pricing innovation, not a technical feat. Mostly schema + billing UI.

**Independent test**: Create an outcome-based contract for College X with rate ₹X per placement. Mark 3 placements as secured. Assert: billing row shows 3 placements × ₹X.

**Acceptance scenarios**:
1. **Given** a college on an outcome-based plan, **when** a verified offer is accepted, **then** the placement counter increments and the billing preview updates within 1 hour.
2. **Given** a billing cycle closes, **when** the invoice is generated, **then** it itemises each placement with the student's anonymised reference and the offer date.
3. **Given** a placement is disputed and reversed within 30 days, **when** the dispute closes in the student's favour, **then** the billing entry is reversed in the next cycle.

---

### User Story 10 — Next-best-skill recommendation based on placed-alumni paths (Priority: P3)

A student opens their dashboard and sees: "Students with a profile like yours who got placed at <Company> added <Skill> next." Clicking expands into a learning path with curated free resources and milestone tracking.

**Why this is P3**: Retention + product-led growth loop, but not on the critical-trust path.

**Independent test**: Seed 100 alumni profiles with placement outcomes. Run `next-best-skill` recommender for a sample student. Assert: at least 1 actionable recommendation produced, source profiles count ≥ 5, recommendation reasoning is auditable.

**Acceptance scenarios**:
1. **Given** a student with ≥ 3 verified skills, **when** they open the dashboard, **then** at least 1 next-best-skill recommendation is shown with the reasoning (number of similar placed alumni who added that skill).
2. **Given** a student adds the recommended skill (e.g. completes a project), **when** the recompute runs, **then** the recommendation list refreshes with the next priority.
3. **Given** the recommender finds no statistically significant signal (< 5 similar alumni), **when** the dashboard loads, **then** the section is hidden (no low-signal noise).

---

### Edge Cases

- **Anti-cheat false positive** → Student appeal flow (US1.3) is the safety valve. Audit log every appeal decision.
- **ATS rate-limit overflow** → Exponential backoff with per-recruiter pause; never block other recruiters.
- **i18n missing keys** → Always fall back to English AND log to `i18n_missing_keys` for translator queue.
- **SAML attribute mapping drift** → If the SAML payload lacks the role attribute, fail closed (deny login) and surface an admin alert.
- **Hackathon code submission abuses platform** → Sandbox execution in disposable Supabase Edge container, hard CPU/memory caps, no network.
- **API key abuse** → Per-key rate limit (default 100 req/min), automatic revocation on > 1000 4xx/hr.
- **Mock interview LLM cost runaway** → Per-student weekly token cap, per-tenant monthly cap, escalation on breach.
- **PWA stale cache** → Service worker uses `stale-while-revalidate` for dashboard data; critical routes use `network-first` with 1s timeout.
- **Outcome-based pricing dispute** → 30-day reversal window; legal contract template captures dispute process.
- **Faculty grade inflation** → Per-faculty grading-distribution monitoring; outliers flagged for college-admin review.

## Requirements *(mandatory)*

### Functional Requirements

#### Anti-cheat (P1)
- **FR-AC-001**: System MUST compute an `anticheat_score` ∈ [0,1] for every synced GitHub repo using these signals: fork-with-no-commits, commit-cluster-time, AI-generated-fingerprint, and copied-content-overlap.
- **FR-AC-002**: Repos with `anticheat_score ≥ 0.6` MUST be quarantined from score recompute.
- **FR-AC-003**: Students MUST be able to appeal a quarantine with a free-text explanation and optional video link.
- **FR-AC-004**: College mentors MUST be able to approve or reject appeals; every decision MUST be logged in `anticheat_audit`.
- **FR-AC-005**: Anti-cheat signals MUST also apply to DSA sync (e.g. impossible velocity, contest-rating delta beyond physical limits).

#### ATS Sync (P1)
- **FR-ATS-001**: System MUST support outbound integration with Greenhouse v1 and Lever v1 APIs.
- **FR-ATS-002**: Recruiters MUST be able to configure 1+ saved searches per ATS connection.
- **FR-ATS-003**: System MUST push newly-matching students to the configured ATS within 5 minutes of match.
- **FR-ATS-004**: Every push MUST include the Skill Proof Score and a public profile URL.
- **FR-ATS-005**: Failed pushes MUST retry with exponential backoff (max 3 attempts), then pause the sync and notify the recruiter.

#### i18n (P1)
- **FR-I18N-001**: System MUST support 5 locales for AI Coach + UI: `en` (default), `hi`, `ta`, `te`, `mr`.
- **FR-I18N-002**: Every nudge template MUST be available in all 5 locales before production dispatch.
- **FR-I18N-003**: Missing keys MUST fall back to English AND log to `i18n_missing_keys`.
- **FR-I18N-004**: Public profile + verifiable credential public page MUST remain English-only (recruiter audience).
- **FR-I18N-005**: Student locale preference MUST be stored in `users.locale` and respected within one nudge cycle of change.

#### Enterprise SSO + Faculty Layer (P2)
- **FR-SSO-001**: System MUST support SAML 2.0 SSO via WorkOS as the IdP broker.
- **FR-SSO-002**: SAML attribute mapping MUST set `role` and `institution_id` from configurable IdP attributes.
- **FR-SSO-003**: Faculty MUST be verifiable via institution_id + email domain + admin confirmation.
- **FR-SSO-004**: Verified faculty MUST be able to grade assignments 0-100 with a comment.
- **FR-SSO-005**: Faculty grades MUST contribute a documented weight (default 10%) to the Skill Proof Score.
- **FR-SSO-006**: Per-faculty grading distribution MUST be monitored; outlier graders flagged.

#### Hackathon Platform (P2)
- **FR-HK-001**: Recruiters MUST be able to create hackathons with title, problem statement, test cases, prize tiers, and a 24-168 hour window.
- **FR-HK-002**: Students MUST be able to submit code that runs against public + hidden test cases.
- **FR-HK-003**: Submission execution MUST be sandboxed (no network, 30s CPU cap, 256MB memory).
- **FR-HK-004**: A live leaderboard MUST update within 60 seconds of any new submission.
- **FR-HK-005**: Hackathon participation MUST issue a verifiable credential to all participants and a rank-specific credential to top 10%.
- **FR-HK-006**: Top 5% MUST be fast-track-eligible for the recruiter's pipeline with one-click invitation.

#### Mock Interview (P2)
- **FR-MI-001**: Students MUST be able to start a mock interview from a curated topic list (system design, DSA, behavioural).
- **FR-MI-002**: LLM responses MUST stream and the next question MUST arrive within 5s of student submission.
- **FR-MI-003**: Each session MUST produce a rubric scoring clarity, depth, and correctness on 0-10.
- **FR-MI-004**: Validated mock interview results MUST contribute a capped weight (max 5% of total score per week).
- **FR-MI-005**: LLM costs MUST be capped per-student (weekly token limit) and per-tenant (monthly).

#### Public API (P3)
- **FR-API-001**: System MUST expose a versioned public API under `/v1/public/*`.
- **FR-API-002**: API access MUST require an API key with declared scopes (`read:public_profile`, `read:verifiable_credential`, `webhook:subscribe`).
- **FR-API-003**: Rate limits MUST default to 100 req/min per key with `429` + `Retry-After` on overage.
- **FR-API-004**: Webhook subscriptions MUST support these events: `score.updated`, `credential.issued`, `placement.confirmed`.
- **FR-API-005**: Webhook payloads MUST be signed with HMAC-SHA256; secret rotates on user demand.

#### Next-best-skill Recommender (P3)
- **FR-NBS-001**: System MUST compute a next-best-skill list for every student with ≥ 3 verified skills.
- **FR-NBS-002**: Recommendations MUST cite the source signal (e.g. "8 of 12 alumni placed at <Company> added <Skill> after your current stack").
- **FR-NBS-003**: Recommendations MUST be hidden when source-alumni count < 5 (no low-signal noise).
- **FR-NBS-004**: A recommendation MUST be re-computed within 24h of a verified-skill change.

#### PWA + Offline (P3)
- **FR-PWA-001**: System MUST ship a PWA manifest and service worker with `network-first` strategy for API routes and `stale-while-revalidate` for static dashboard content.
- **FR-PWA-002**: PWA MUST register for push notifications on install.
- **FR-PWA-003**: Critical user actions taken offline (e.g. mark-nudge-read) MUST be queued and replayed on reconnect.

#### Outcome-based Pricing (P3)
- **FR-OBP-001**: Colleges MUST be able to opt into an `outcome` pricing plan at any time.
- **FR-OBP-002**: Each verified-offer-accepted event MUST create a billing row at the contracted rate.
- **FR-OBP-003**: Disputes within 30 days MUST reverse the billing row in the next cycle.

### Key Entities

- **anticheat_signals** — one row per (repo or dsa_record) per detected signal; columns: `entity_type`, `entity_id`, `signal`, `confidence`, `evidence_url`, `detected_at`.
- **anticheat_appeals** — student appeal of a quarantine; columns: `signal_id`, `student_id`, `explanation`, `evidence_url`, `status` (pending/approved/rejected), `mentor_id`, `decided_at`.
- **anticheat_audit** — every quarantine, appeal decision, manual override; immutable.
- **ats_connections** — recruiter's ATS API credentials (encrypted); columns: `recruiter_id`, `provider` (greenhouse/lever), `api_key_encrypted`, `pool_id`, `created_at`, `status`.
- **ats_saved_searches** — recruiter's persisted search criteria; columns: `connection_id`, `query_json`, `min_score`, `active`.
- **ats_sync_log** — every outbound sync attempt; columns: `connection_id`, `student_id`, `status`, `error`, `pushed_at`.
- **i18n_missing_keys** — translator queue; columns: `locale`, `key`, `first_seen_at`, `seen_count`.
- **sso_connections** — per-institution SAML config (managed by WorkOS); columns: `institution_id`, `workos_connection_id`, `status`.
- **faculty_grades** — faculty assessment of student work; columns: `faculty_id`, `student_id`, `assignment_id`, `grade`, `comment`, `graded_at`.
- **hackathons** — recruiter-created challenges; columns: `recruiter_id`, `title`, `problem`, `test_cases_url`, `starts_at`, `ends_at`, `prize_structure_json`, `status`.
- **hackathon_submissions** — student code submissions; columns: `hackathon_id`, `student_id`, `code_url`, `test_results_json`, `score`, `submitted_at`.
- **mock_interviews** — student sessions; columns: `student_id`, `topic`, `transcript_url`, `rubric_json`, `score_contribution`, `started_at`, `completed_at`.
- **api_keys** — third-party API access; columns: `subject_id`, `name`, `key_hash`, `scopes`, `rate_limit_rpm`, `revoked_at`.
- **webhook_subscriptions** — subscriber endpoints; columns: `api_key_id`, `event`, `target_url`, `secret_hash`, `active`.
- **webhook_deliveries** — every delivery attempt; columns: `subscription_id`, `event_id`, `status`, `attempt`, `last_error`.
- **outcome_contracts** — outcome-based pricing agreements; columns: `institution_id`, `rate_per_placement`, `currency`, `started_at`, `ends_at`, `status`.
- **outcome_billing_events** — per-placement billing rows; columns: `contract_id`, `student_id`, `offer_id`, `amount`, `disputed`, `confirmed_at`.
- **next_best_skills** — per-student recommendation rows; columns: `student_id`, `skill`, `source_count`, `confidence`, `computed_at`.

## Out of Scope (Deferred to v2)

These were considered and explicitly deferred:

1. **React Native / Expo mobile app** — Defer until PWA engagement is measured. PWA + web-push covers 90% of mobile UX at 10% of the cost.
2. **ClickHouse / BigQuery migration** — Defer until telemetry exceeds 100M rows. Postgres + `pg_partman` + materialized views handle current scale through 2027.
3. **Native group-video assessments** — Defer; requires LiveKit/Daily SDK integration and adds substantial moderation/abuse complexity.
4. **LinkedIn auto-apply automation** — Permanently deferred (ToS violation). Auto-draft + human-in-the-loop one-click apply is the legal alternative.

## Success Criteria *(mandatory, measurable)*

### Measurable Outcomes

- **SC-AC-001**: Anti-cheat detects ≥ 90% of seeded synthetic cheat patterns with ≤ 2% false-positive rate.
- **SC-ATS-001**: 50% of active recruiters configure at least 1 ATS connection within 30 days of launch.
- **SC-I18N-001**: ≥ 30% of new student signups select a non-English locale within 60 days.
- **SC-SSO-001**: ≥ 3 colleges complete SAML setup within 90 days.
- **SC-FAC-001**: ≥ 20% of partner-college faculty grade at least 1 assignment per month.
- **SC-HK-001**: ≥ 5 hackathons run in the first quarter; ≥ 60% participation among invited students.
- **SC-MI-001**: ≥ 25% of P1-tier students complete at least 1 mock interview per month.
- **SC-API-001**: ≥ 5 external developers create API keys within 90 days.
- **SC-PWA-001**: PWA install conversion ≥ 15% of mobile sessions.
- **SC-OBP-001**: ≥ 1 college signs an outcome-based contract within 90 days.
- **SC-NBS-001**: ≥ 30% of students with ≥ 3 verified skills click a next-best-skill recommendation within their first week of exposure.
