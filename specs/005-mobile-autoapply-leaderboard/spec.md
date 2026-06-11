# Feature Specification: 005 — Mobile, Auto-Apply, Leaderboard

**Feature Branch**: `005-mobile-autoapply-leaderboard`
**Created**: 2026-06-07
**Status**: Draft
**Migrations**: `051_mobile_autoapply.sql` (main), `052_cron_005.sql` (cron consolidation)
**Builds on**: 001 (foundation) + 002 (verified skill platform, `users`, `verifiable_credentials`, `student_applications`, W3C VC) + 003 (engage & showcase, nudges, streaks, public profile) + 004 (PWA service worker + web-push infra, public API, configurable LLM, weekly/monthly cost-cap pattern) + 006 (privacy center, signals/privacy surface, biometric aggregations) + 007 (mentor list, curriculum today) + 008 (collab room join, `VideoRoomProvider`).
**Input**: User vision to convert Antarix from a desktop/PWA product into (a) a **first-class mobile app** that students will keep installed, (b) an **auto-apply agent** that turns the verified skill credential into real job applications, and (c) a **cross-college global leaderboard** that gives every cohort a public rank to compete for. The deferred items from 004 (React Native mobile, ClickHouse leaderboard warehouse) and the new product moves (auto-apply, e-sports UI) all land here.

## Why this exists

001-004 produced a high-trust, high-signal, multi-portal SaaS — but three things limit compounding adoption:

1. **Mobile install conversion is below 10%** of monthly active students. PWA + web-push carries 90% of the engagement, but college students in 2026 live in native app stores; install = retention. A Tier-3 student in Tamil Nadu with a flaky campus Wi-Fi connection does not keep a browser tab pinned — they keep an app icon. 004 explicitly deferred RN to v2; the user has reversed that call.
2. **The verified credential is decorative unless it converts into job applications.** A 78 Skill Proof Score sits on a public page; a click on "Apply" is still a manual form. Auto-apply (LLM cover-letter + Playwright form filler) inverts this: the credential becomes the application.
3. **The lack of a public, ranked ladder eliminates a viral loop.** Students tell friends "I ranked #42 on LeetCode"; they do not say "I scored 78 on Antarix". A cross-college leaderboard gives them a shareable, comparable, citable rank. The 004-considered ClickHouse plan is replaced with a Postgres materialized view per the user's deferral.

This feature therefore ships three new product surfaces — mobile, auto-apply, leaderboard — and a gamified UI shell that unifies them under a streak, tier, and share-card identity. 004's PWA, 006's privacy/audit, 007's mentor/curriculum, and 008's collab video are consumed as **read-mostly dependencies**; the mobile app reuses them through the same web APIs.

## Why a native app is now justified (vs the 004 PWA decision)

004 concluded "PWA covers 90% of mobile UX at 10% of the cost." That conclusion holds for the **stages** of the funnel it measured (engagement, not conversion). For 005 the calculus changes:

- **Push reliability.** Web-push on iOS Safari still has < 70% delivery vs APNs ≥ 96% in the same period. Streak-at-risk nudges lose half their signal in the browser.
- **App store discoverability.** "Antarix — Skill Proof" appearing in the iOS App Store and Google Play search for "skill proof" is a free acquisition channel PWA cannot match.
- **Background biometric ingestion (006).** HealthKit and Google Fit require a native bridge; the PWA `Web APIs` will not get there in 2026.
- **Native share sheet + claim-card image.** E-sports style share cards need `UIActivityViewController` / `Intent.ACTION_SEND` for one-tap posting; the web `navigator.share` is still a 60% coverage surface.
- **Job application form filler (auto-apply).** Playwright runs server-side; the mobile app's job of delivering the **embedded browser view** to the student for the final "Submit" click is materially better with a `WKWebView`/`Chrome Custom Tab` than with a PWA in-app browser.

The PWA is not deprecated — students who cannot install the app get the same surface, and 004's service worker continues to power both.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — React Native + Expo Mobile App (Priority: P1)

A first-year CS student at a Tier-3 college in Bihar installs Antarix from the Play Store after seeing a friend's shared leaderboard card on LinkedIn. On first launch, the Expo `Linking` handler picks up the deep link from the web → resumes the onboarding flow that started in the browser → prompts biometric login. They land on a dashboard that mirrors the web one: Skill Proof Score with a 7-day sparkline, "next-best-skill" recommendation, today's 3 curriculum lessons (from 007), 2 pending mentor requests, and a "your global rank: #1,247" leaderboard card. The signals/privacy surface (from 006) is reachable in two taps. A streak fire animation plays on app open because they have a 14-day streak. A push notification for "streak at risk — open app before midnight" arrives via APNs (iOS) / FCM (Android) when their push token is registered; if APNs/FCM is unavailable the legacy web-push channel from 003 is used as fallback. Mentor list and curriculum today screens call the 007 API; collab room join calls the 008 API.

**Why this is P1**: Without the app, the leaderboard (US3) and auto-apply (US2) are also-maybes; with the app, the install is the conversion event. Mobile is the unlock for everything else in this feature.

**Independent test**: Build the EAS `development` profile. Launch on an iOS Simulator and an Android emulator. Authenticate via Supabase. Assert: dashboard renders within 3s, the seven-tile grid (score, skills, mentor, curriculum, collab, signals, leaderboard) is interactive, deep link `https://antarix.app/launch?resume=<token>` opens the app cold-start and continues onboarding, and a manual `expo push:send` from EAS reaches the device within 5s. The `apps/mobile/package.json` is registered in `pnpm-workspace.yaml`; `pnpm --filter @antarix/mobile start` boots Expo Go locally.

**Acceptance scenarios**:
1. **Given** a student opens `https://antarix.app/launch?resume=<token>` on iOS Safari, **when** the page is loaded, **then** the JS detects Expo Go presence via `Linking.getInitialURL()`/a custom universal-link handler, the user is deep-linked into the app, and the onboarding continues from the saved `resume_token` step.
2. **Given** the app is running in the foreground on iOS, **when** the AI Coach dispatches a real-time peak nudge, **then** an APNs push notification arrives within 5s with a deep link to the corresponding dashboard tile; if the device is offline, the notification is queued in APNs (24h TTL) and the in-app inbox shows it once reconnected.
3. **Given** the same scenario on Android, **when** the push is sent, **then** FCM delivers within 5s; on FCM unavailability (e.g. Huawei device without GMS), the app falls back to the 003 web-push channel via a server-side `push_token_fallback` flag.
4. **Given** a student with a 14-day streak, **when** the app is cold-started, **then** the streak-fire animation (3s, Reanimated 3, ≤ 5MB memory) plays once, the streak counter on the dashboard increments to 14, and no animation replays within the same cold-start session.
5. **Given** a student taps the "Collab" tile, **when** the join URL is opened, **then** the 008 `collab_rooms` page is loaded inside an authenticated session and the LiveKit/Meet entry flow runs identically to web (no Expo-specific code path required).
6. **Given** a recruiter opens the iOS app via the (company) portal, **when** they land on the ATS dashboard, **then** the layout matches the web with no iOS-specific exceptions; ATS saved searches, sync log, and Greenhouse/Lever connection management are 1:1 with web.

---

### User Story 2 — Auto-Apply Agent (Priority: P1)

A final-year student at a Tier-2 NIT in Maharashtra has a Skill Proof Score of 81 with verified Python, SQL, FastAPI, and 3 W3C-VC credentials. They open the Antarix mobile app, navigate to `/jobs`, see a list of 24 matched openings (sourced from the 002 `job_matches` table), and tap "Apply" on a Razorpay SDE-1 posting. The auto-apply agent (a) calls `POST /api/auto-apply/cover-letter` with the job description + the student's verified Skill Proof summary, the LLM (Groq primary, OpenAI fallback per 004) returns a 280-word tailored cover letter; (b) the student reviews/edits and clicks "Save & apply" — the letter is stored against the `student_applications` row. On a different job ("Stripe — Backend Intern"), the student clicks "Auto-apply (verified)" and a server-side Playwright headless browser launches: it navigates to the company ATS, prefills the form from the student's verified W3C VC + confirmed profile (name, email, phone, education, projects, GitHub), and renders the prefilled page in an **embedded browser view** inside the app. The student reviews the prefilled fields, makes a small edit to the "Why Stripe?" free-text field, and clicks "Submit" themselves. The agent **never** auto-submits. Every step — navigate, fill field X, fill field Y, screenshot, render preview — is logged to `auto_apply_log` in real time. If a domain is on the kill-switch list (`auto_apply_templates.disabled_for_domain`), the auto-apply button is hidden for that domain.

**Why this is P1**: This is the **monetizable** surface. The verified credential becomes an actual job application with a real recruiter on the other end. The 004 deferral of "LinkedIn auto-apply automation" stays in effect (ToS violation); Antarix-owned ATS forms are the legal alternative.

**Independent test**: Seed a verified student with VC-issued credentials, GitHub handle, and a real test job listing (a test Stripe/Workday form). POST `/api/auto-apply/cover-letter`; assert ≤ 400-word letter, deterministic structure, `tokens_used ≤ 4000`. Then POST `/api/auto-apply/session`; assert a headless Playwright session is created, navigates to the test form, prefills 8+ fields, emits ≥ 10 `auto_apply_log` rows tagged with step names, returns an `embed_url` that loads the live headless view. Click "Submit" in the embed; assert the form is posted and `student_applications.status='submitted'`. Confirm the agent never auto-submitted (assert the submit call is gated on user click via a Playwright event handler registered in the page context, not in the agent's main code path).

**Acceptance scenarios**:
1. **Given** a student with 4 verified credentials, **when** they click "Apply" on a job, **then** `POST /api/auto-apply/cover-letter` returns within 8s with a cover letter ≤ 400 words, the letter is editable in the UI, and clicking "Save & apply" persists the letter to `student_applications.cover_letter_text` and increments `student_applications.status='draft_saved'`.
2. **Given** the same student has already saved 5 drafts today, **when** they click "Apply" on a 6th job, **then** the API returns 429 with `code='daily_draft_cap_exceeded'` and the UI shows "You've drafted 5 of 5 — try again at 00:00 local." The cap is reset at the user's local midnight (per `users.timezone`).
3. **Given** a student clicks "Auto-apply (verified)" on a Stripe posting, **when** `POST /api/auto-apply/session` is called, **then** a headless Playwright session is provisioned within 5s, navigates to the ATS, prefills name/email/phone/education/projects/GitHub from the verified VC + `users` row, the embed URL is returned, and `auto_apply_log` shows the first 10 step entries in real time.
4. **Given** the agent has prefilled the form, **when** the student clicks "Submit" in the embedded view, **then** the form is posted to the ATS, the response is captured, and `student_applications.status='submitted'` is written; if the student closes the embed without clicking Submit, no submission occurs and the session is marked `abandoned` after a 5-minute idle timeout.
5. **Given** a domain is on the kill-switch list (`auto_apply_templates.disabled_for_domain ILIKE '%linkedin.com%'`), **when** the student views a job from that domain, **then** the auto-apply button is hidden and only "Save & apply (manual cover letter)" is offered; the kill-switch is per-domain, configured by `app_admins` only, and updates propagate to the client within 60s.
6. **Given** the headless browser is navigating a form, **when** it encounters a CAPTCHA, **then** the agent pauses, emits `auto_apply_log.step='captcha_detected'`, and the embed view shows "Please solve this CAPTCHA in the browser — the agent is paused until you continue." The session is resumable from the same embed URL.

---

### User Story 3 — Global Cross-College Leaderboard (Priority: P1)

A second-year CS student at a Tier-1 college (IIT-B) opens `/leaderboards/global` on the web or `/leaderboard` on the mobile app. They see the **weekly** tab by default, with a top-100 list ordered by verified Skill Proof Score (already net of 004 anti-cheat deductions and the 006/008 score caps). They are ranked #312. Tabs include **weekly** (resets Sunday 00:00 UTC), **monthly** (resets 1st of month UTC), and **all-time**. Each row shows: rank, anonymous handle or first-name + college + year, verified score, streak days, and the top 3 most-relevant achievements (badges, credentials, mentorship count). The student is opted-in by default. They navigate to `/settings/leaderboard`, toggle "Show me on the public leaderboard" OFF, and refresh `/leaderboards/global` — they are no longer in the list, the response is 1 row shorter, and the API `count_total` shows 49,999 other opted-in students. A recruiter inside the (company) portal filters by college, year, and specialization to find 8 candidates with verified score ≥ 75 and a relevant specialization — the recruiter sends a "fast-track" invite to all 8 via the existing 002/004 ATS-sync flow.

**Why this is P1**: The leaderboard is the **viral loop** that turns Antarix from a tool into a sport. Done right, every share card is a free acquisition; done wrong, the leaderboard is a privacy liability. The opt-out semantic and RLS enforcement are load-bearing.

**Independent test**: Seed 50 students across 5 colleges with varied verified scores, streaks, and credentials. Refresh the materialized view `mv_cross_college_leaderboard` via the nightly cron. Hit `GET /api/v1/public/leaderboard/global?period=weekly&limit=100` — assert 50 rows, ordered desc by score, and a `count_total` integer. Toggle 10 students' opt-out, refresh, hit the API again — assert 40 rows. Recruiter login → `GET /api/leaderboards/global?college_id=<X>` — assert RLS filters the recruiter to the colleges they have access to (per existing company/college membership).

**Acceptance scenarios**:
1. **Given** a student with `leaderboard_opt_outs.user_id = me` and `opted_out = true`, **when** any public or recruiter-facing leaderboard query runs, **then** the student's row is excluded from the result, the `count_total` is one less than the opted-in count, and the student cannot be found by slug, name, or college.
2. **Given** a recruiter with a partner-college membership, **when** they call `GET /api/leaderboards/global?college_id=<X>&year=3&specialization=ai_ml`, **then** the response returns up to 100 students matching all three filters, ordered by verified score, with RLS enforced so a recruiter from Company A cannot see College Y's students unless they have an explicit partnership.
3. **Given** a student ranked in the top-100 weekly, **when** they tap "Claim this rank", **then** the server-rendered PNG (1200×630, @vercel/og) is generated within 3s with their rank, score, handle, college, the Antarix logo, and a "Verified by Antarix — antarix.app/verify/<slug>" footer; the share-sheet on iOS/Android opens with the PNG pre-attached for Twitter, LinkedIn, WhatsApp, Instagram Stories.
4. **Given** a student has a 14-day streak and the app is cold-started, **when** the leaderboard card on the dashboard is rendered, **then** the streak-fire animation plays (3s, ≤ 5MB), the card shows "🔥 14-day streak" and a tier badge (Bronze/Silver/Gold/Platinum/Diamond) computed from the student's percentile.
5. **Given** the materialized view is being refreshed, **when** a query lands, **then** it blocks for at most 500ms (REFRESH MATERIALIZED VIEW CONCURRENTLY is used; if a lock fails, the query returns the previous refresh's data and a header `X-Leaderboard-Staleness: <seconds>`).

---

### User Story 4 — E-Sports Style Gamified UI (Priority: P2)

A Tier-2 student at the start of a 7-day streak opens the mobile app for the first time. The leaderboard card shows a "Welcome to the ladder — Bronze tier" prompt. After 7 consecutive days, confetti fires (3s, react-native-skia, ≤ 5MB memory) and the tier badge animates from Bronze to Silver. After 30 days, Silver → Gold, and so on. The "Claim this rank" button generates a server-rendered share card (1200×630 PNG via @vercel/og for web / `react-native-view-shot` for mobile), posts it to Twitter/LinkedIn via the OS share sheet. A weekly digest push notification ("You're #247 this week, up 32 spots — keep going") arrives Sunday 18:00 local. The streak-fire animation on app open is gated behind a 7+ day streak threshold; below 7 days, the standard Antarix splash is shown.

**Why this is P2**: Visual polish and tier animations are the **retention** and **word-of-mouth** engine. They are the difference between a leaderboard that students check and one they share. P2 reflects that the leaderboard (US3) is the load-bearing product; the e-sports chrome on top of it is the growth loop.

**Independent test**: Seed a student with a 14-day streak and a verified score in the 90th percentile. Render `/leaderboards/global` and the mobile `/leaderboard` screen. Assert: tier badge reads "Silver", confetti animation is wired (skia canvas mounts), "Claim this rank" returns a PNG within 3s with all 6 required elements (rank, score, handle, college, logo, footer), and the share-sheet call opens with the PNG pre-attached. Toggle to a 35-day streak — assert tier badge reads "Platinum". Below 7 days — assert no confetti and no streak-fire animation.

**Acceptance scenarios**:
1. **Given** a student with a 7-day streak, **when** the leaderboard card renders, **then** a confetti animation (3s, ≤ 5MB memory, no more than 60 particles on screen at once) plays once per session, the tier badge animates from Bronze to Silver with a 200ms ease-out, and the animation does not replay on subsequent navigations within the same session.
2. **Given** a student ranked in the top-100 weekly, **when** they tap "Claim this rank", **then** the server-rendered PNG (1200×630) is generated within 3s and the OS share-sheet opens with the PNG pre-attached for at least Twitter, LinkedIn, WhatsApp, and Instagram Stories.
3. **Given** Sunday 18:00 local time, **when** the weekly digest cron runs, **then** every opted-in student with a verified profile receives one push notification summarising their rank delta, tier, and streak status; the notification is rate-limited to 1/week per student.
4. **Given** a student with a 35-day streak and a verified score in the 95th percentile, **when** they open the mobile app, **then** the streak-fire animation (3s, Reanimated 3, ≤ 5MB) plays once, the dashboard tile highlights "🔥 35-day streak", and tapping the tile deep-links into the streak detail screen.
5. **Given** the share-card PNG is generated, **when** a third-party platform (Twitter, LinkedIn) crawls the share URL, **then** the Open Graph metadata (`og:image`, `og:title`, `og:description`) is server-rendered with the student's claim (rank, score, college) and the Antarix verify slug is in the canonical link.

---

### Edge Cases

- **No Expo Go installed** → The web page shows a CTA "Get Antarix on the App Store / Play Store" with the deep link preserved in clipboard; the user can resume from the web once they install.
- **APNs/FCM token rotation** → The mobile app re-registers the device token on every cold start; the `mobile_device_tokens` table enforces `UNIQUE(user_id, device_id, token)`; old tokens are soft-deleted after 30 days inactive.
- **Playwright session timeout** → A 5-minute idle timeout closes the headless session; the embed view shows "Session expired — please re-open the job to continue" and the auto_apply_log captures the timeout step.
- **Job form has 2FA / SSO** → The agent detects a non-fillable SSO redirect (`window.location.href` matches a known SSO pattern) and emits `auto_apply_log.step='sso_required'`; the embed view pauses and asks the student to log in manually, then resumes.
- **Leaderboard view with only 1 student** → The page renders with a "be the first to share" empty state; no top-100 truncation, no fake data.
- **Materialized view refresh failure** → The cron retries with exponential backoff; on the 3rd failure, the on-call is paged; the public API continues to serve the previous refresh's data with `X-Leaderboard-Staleness` header.
- **Opt-out during rank delta computation** → If a student opts out mid-week, the next refresh excludes them; existing rank rows are tombstoned with `opted_out_at`, not deleted (for audit).
- **LLM provider outage during cover-letter generation** → Fall back to the 004 `LLM_FALLBACK_PROVIDER` (configurable, defaults to OpenAI when Groq is primary); if both fail, return 503 with a "Cover-letter service unavailable — please try again in 30s" message and do not consume the daily draft cap.
- **Daily draft cap reset edge case** → The cap is keyed on `users.timezone` local midnight; a student who crosses timezones retains their cap on the original `users.timezone` until they next update the field via settings.
- **Tier-bronze → silver → gold → platinum → diamond percentile bands** → Bands are computed from the **opted-in** cohort's distribution, recomputed weekly, and cached on `leaderboard_share_cards` for share-card rendering (avoids drift between card and live).
- **Streak calculation when a student misses 1 day** → Streak resets to 1 on first missed day; no "freeze" mechanic in v1 (deferred to v2 to avoid complexity).
- **Stale leaderboard data on mobile** → Mobile app calls `GET /api/v1/public/leaderboard/global` and shows the staleness header in a subtle banner if `X-Leaderboard-Staleness > 12h`.

## Requirements *(mandatory)*

### Functional Requirements

#### Mobile App (US1, P1)
- **FR-MOB-001**: System MUST provide an Expo SDK 51+ React Native app under `apps/mobile/` that consumes the existing `apps/web/src/app/api/*` routes via `EXPO_PUBLIC_API_BASE_URL`; no parallel API surface.
- **FR-MOB-002**: The mobile app MUST register in `pnpm-workspace.yaml` as `@antarix/mobile` and be buildable via EAS (development, preview, production profiles) for both iOS and Android.
- **FR-MOB-003**: The app MUST use Expo Router (file-based) for navigation; first-run flow is `onboarding → biometric login → dashboard`.
- **FR-MOB-004**: The dashboard MUST render within 3s p95 on a 3G connection; the seven primary tiles are: Skill Proof Score, Skill Proof Breakdown, Mentor List (007), Curriculum Today (007), Collab Room Join (008), Signals/Privacy (006), Leaderboard (this feature).
- **FR-MOB-005**: Push channel MUST prefer APNs (iOS) and FCM (Android); on FCM-unavailable devices (e.g. Huawei), the 003 web-push channel is the fallback (server-side `push_token_fallback=true`).
- **FR-MOB-006**: Onboarding MUST detect Expo Go via a universal-link deep link `https://antarix.app/launch?resume=<token>`; if the user has Expo Go installed, they are deep-linked in; otherwise the web page shows the store CTA and preserves the resume token in clipboard.
- **FR-MOB-007**: Every existing web-push token from 003 MUST be migrated to a `mobile_device_tokens` row with `kind='web_push_legacy'` for fallback routing.
- **FR-MOB-008**: The mobile app MUST use the React Native New Architecture (Fabric + TurboModules) on iOS 14+ and Android API 28+; older devices fall back to the legacy bridge.
- **FR-MOB-009**: All shared types in `packages/types/` MUST be consumable from both web and mobile; no `apps/mobile`-only types except for native module bindings.
- **FR-MOB-010**: The mobile app MUST log every session to `mobile_app_sessions` for analytics; session start, app open, dashboard view, push receipt, and crash event.

#### Auto-Apply Agent (US2, P1)
- **FR-AA-001**: System MUST expose `POST /api/auto-apply/cover-letter` that accepts a job description + the student's verified Skill Proof summary and returns a tailored cover letter (≤ 400 words) using the 004 LLM client (Groq primary, OpenAI fallback).
- **FR-AA-002**: Cover-letter generation MUST be capped at 5 drafts per student per local-calendar day; the cap is reset at the student's local midnight (per `users.timezone`).
- **FR-AA-003**: The cover letter MUST be persisted to `student_applications.cover_letter_text` on "Save & apply"; the application status transitions from `submitted` to `draft_saved` and back to `submitted` if the student proceeds to apply.
- **FR-AA-004**: System MUST expose `POST /api/auto-apply/session` that launches a headless Playwright browser, navigates to the company ATS, and prefills verified fields from the student's W3C VC + confirmed profile.
- **FR-AA-005**: The agent MUST NEVER auto-submit the form; the final "Submit" click is the student's, executed in the embedded browser view returned to the mobile app.
- **FR-AA-006**: Every step (navigate, fill_field, screenshot, render_preview, captcha_detected, sso_required, submit, abandoned, timeout) MUST be logged to `auto_apply_log` with step name, latency, and a per-step screenshot URL.
- **FR-AA-007**: A per-domain kill-switch MUST be configurable in `auto_apply_templates.disabled_for_domain`; toggled by `app_admins` only; propagates to the client within 60s; defaults to `disabled` for known ToS-violating domains (linkedin.com, indeed.com messaging).
- **FR-AA-008**: The embedded browser view MUST support CAPTCHA and SSO pause/resume: when the agent encounters either, it emits a step, pauses, and the student resumes in the embed.
- **FR-AA-009**: Playwright MUST run in a hardened Node service: no outbound network outside the company ATS domain for the form, no file system access outside `/workspace`, per-session 5-minute idle timeout, per-tenant concurrency cap of 5 (configurable).
- **FR-AA-010**: A failed Playwright session MUST emit `auto_apply_log.step='error'` with the error and screenshot; the student sees a "form filler error — try again or apply manually" message; no partial form submission occurs.
- **FR-AA-011**: All LLM calls MUST go through the 004 cost-cap gate (per-student weekly + per-tenant monthly); the cover-letter cap (5/day) is layered on top of the 004 cap.

#### Global Cross-College Leaderboard (US3, P1)
- **FR-LB-001**: System MUST maintain a `mv_cross_college_leaderboard` Postgres materialized view that aggregates: top-100 by verified Skill Proof Score (with 004 anti-cheat deductions and 006/008 score caps already applied), top-100 by streak (003), top-100 by mock-interview rubric (004), top-100 by mentor-session count (007), top-100 by collab-teamwork score (008).
- **FR-LB-002**: The materialized view MUST be refreshed nightly by `leaderboard-refresh` edge function via `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cross_college_leaderboard`; on lock failure, the API returns the previous refresh's data with an `X-Leaderboard-Staleness` header.
- **FR-LB-003**: System MUST expose `GET /api/v1/public/leaderboard/global` accepting `period=weekly|monthly|all_time`, `limit` (default 100, max 100), `offset`, and recruiter-only filters `college_id`, `year`, `specialization`.
- **FR-LB-004**: Opted-out students MUST NEVER appear in any leaderboard result, ever. The opt-out is enforced at the materialized view level (a JOIN against `leaderboard_opt_outs WHERE opted_out = false`) AND at the API layer (RLS policy).
- **FR-LB-005**: The public read-only page `/leaderboards/global` MUST render the leaderboard with a strict opt-out semantic, a tier badge (Bronze/Silver/Gold/Platinum/Diamond) computed from the student's percentile within the opted-in cohort, and a "Claim this rank" CTA.
- **FR-LB-006**: Recruiter-facing leaderboard view inside the (company) portal MUST filter by college, year, and specialization via existing RLS policies; recruiters from Company A cannot see College Y's students without an explicit partnership.
- **FR-LB-007**: The leaderboard endpoint MUST return `count_total` (the opted-in cohort size) and `count_returned` (the page size); both integers, ≤ 30s cache, `Cache-Control: public, max-age=30`.
- **FR-LB-008**: Tier bands (Bronze < 50th percentile, Silver 50-75th, Gold 75-90th, Platinum 90-97th, Diamond ≥ 97th) MUST be recomputed weekly from the current opted-in cohort distribution and cached on `leaderboard_share_cards.tier_band`.

#### E-Sports Style UI (US4, P2)
- **FR-UI-001**: Leaderboard view MUST support `weekly`, `monthly`, `all-time` tabs; the default is `weekly`.
- **FR-UI-002**: Tier badge MUST be visible on the leaderboard row, on the dashboard tile, and on the share card; tiers animate with a 200ms ease-out between adjacent bands.
- **FR-UI-003**: Confetti animation MUST fire once on a student's first leaderboard entry in a session (3s, react-native-skia or web canvas, ≤ 60 particles, ≤ 5MB memory).
- **FR-UI-004**: Streak-fire animation MUST fire on app open for students with ≥ 7-day streak (3s, Reanimated 3, ≤ 5MB memory).
- **FR-UI-005**: "Claim this rank" CTA MUST generate a server-rendered PNG (1200×630) within 3s containing: rank, score, handle, college, year, tier badge, Antarix logo, "Verified by Antarix — antarix.app/verify/<slug>" footer; the OS share-sheet opens with the PNG pre-attached.
- **FR-UI-006**: The share card endpoint MUST also return Open Graph metadata (`og:image`, `og:title`, `og:description`) for crawler compatibility; the canonical URL includes the verify slug.
- **FR-UI-007**: Weekly digest push MUST be sent Sunday 18:00 local per opted-in student with a verified profile; rate-limited to 1/week per student.
- **FR-UI-008**: Tier-band percentile computation MUST use the **opted-in** cohort only; opt-outs are removed from both numerator and denominator.

#### Cross-cutting
- **FR-CC-001**: All new tables MUST have RLS enabled with explicit policies; opted-out students never appear in any leaderboard read.
- **FR-CC-002**: All new surfaces MUST ship behind feature flags: `005_mobile_app`, `005_auto_apply_cover_letter`, `005_auto_apply_headless`, `005_leaderboard_global`, `005_esports_ui`; defaults OFF; flags enumerated in `quickstart.md`.
- **FR-CC-003**: All new edge functions MUST log to `supabase.functions.invoke_log` and write a feature-scoped audit row for every external dispatch.
- **FR-CC-004**: All new shared types MUST live under `packages/types/` (no inline duplicates in `apps/web/` or `apps/mobile/`).
- **FR-CC-005**: LLM cost-cap pattern MUST be inherited from 004 (`LESSON_WEEKLY_TOKEN_CAP=30000` equivalent for cover letters: `COVER_LETTER_WEEKLY_TOKEN_CAP=20000`); per-tenant monthly cap (`COVER_LETTER_MONTHLY_TENANT_TOKEN_CAP=2000000`) is shared with 004's general LLM cap.
- **FR-CC-006**: PWA is not deprecated; the existing 004 service worker continues to power both web and the mobile app's webview fallback.
- **FR-CC-007**: Push channel priority is APNs > FCM > web-push (003); the device-token table records `kind` and `priority`; the dispatcher picks the highest-priority available.
- **FR-CC-008**: Mobile crash reports MUST be forwarded to the existing 003/004 observability stack; privacy-respecting (no PII beyond device_id).
- **FR-CC-009**: Every mobile session MUST register a `mobile_app_sessions` row with `user_id`, `device_id`, `app_version`, `os`, `started_at`, `last_heartbeat_at`; sessions idle for > 30 min are marked `ended`.
- **FR-CC-010**: All cost caps and feature flags are documented in `quickstart.md`; defaults may be tuned by `app_admins`.

### Key Entities

- **auto_apply_log** — Append-only log of every step in a Playwright session. Columns: `id`, `session_id`, `student_id`, `job_url`, `step` (navigate/fill_field/screenshot/render_preview/captcha_detected/sso_required/submit/abandoned/timeout/error), `latency_ms`, `screenshot_url`, `payload_json`, `created_at`.
- **auto_apply_templates** — Per-domain job-form field mappings + kill-switch. Columns: `id`, `domain` (UNIQUE), `company_id` (nullable), `field_map_json`, `disabled_for_domain` (default false), `disabled_reason`, `last_verified_at`, `last_verified_by`, `updated_at`.
- **leaderboard_share_cards** — Per-rank share-card cache (server-rendered PNG + OG metadata). Columns: `id`, `student_id`, `rank`, `period` (weekly/monthly/all_time), `score`, `tier_band`, `handle`, `college_name`, `year`, `png_url`, `og_metadata_json`, `rendered_at`, `expires_at`.
- **leaderboard_opt_outs** — Per-student opt-out toggle for the global leaderboard. Columns: `id`, `user_id` (UNIQUE, FK), `opted_out` (default false), `opted_out_at`, `opted_in_at`, `reason` (nullable), `created_at`.
- **mobile_device_tokens** — Per-(user, device) push token, multi-kind. Columns: `id`, `user_id` (FK), `device_id` (stable per-install UUID), `kind` (`apns`/`fcm`/`web_push_legacy`), `token`, `app_version`, `os`, `os_version`, `last_seen_at`, `soft_deleted_at`, `created_at`. UNIQUE(`user_id`, `device_id`, `kind`).
- **mobile_app_sessions** — Per-cold-start session analytics. Columns: `id`, `user_id`, `device_id`, `app_version`, `os`, `started_at`, `last_heartbeat_at`, `ended_at`, `ended_reason` (foreground_30m_idle/user_logout/crash).
- **mv_cross_college_leaderboard** — Postgres MATERIALIZED VIEW (not a table). Columns: `rank`, `period` (weekly/monthly/all_time), `kind` (skill_proof_score/streak/mock_interview/mentor_session/collab_teamwork), `student_id` (FK), `handle`, `college_id` (FK), `college_name`, `year`, `specialization`, `score`, `tier_band`, `top_achievements_json`, `opted_out` (denormalized for fast exclusion; re-checked at read time). UNIQUE INDEX on `(period, kind, rank)`.

## Out of Scope (Deferred to v2)

1. **Native iOS/Android video rendering for mentor + collab rooms (008 + 007)** — Defer; the mobile app loads the existing web routes for these surfaces; native `react-native-livekit-client` is a v2 candidate.
2. **ClickHouse / BigQuery for leaderboard analytics** — Permanently deferred; the materialized view + nightly cron handle current scale; the user has confirmed this in the 005 brief.
3. **Auto-apply for non-Antarix-owned ATS forms (e.g. Workday, iCIMS, Greenhouse customer-portal forms)** — Deferred; v1 covers Antarix-owned ATS templates only.
4. **Streak "freeze" mechanic** — Defer; v1 resets streak on first missed day.
5. **Real-time leaderboard push updates** — Defer; the leaderboard is refreshed nightly; v2 may add `pusher`/`ably` for live rank-delta pushes.
6. **Multi-leaderboard per cohort / per college** — Defer; v1 is global only. Cohort-level leaderboards are a v2 product.
7. **Auto-translation of cover letters into the student's `users.locale`** — Defer; v1 is English-only. Hindi/regional translation of cover letters is captured in 004 backlog.
8. **Video proof / portfolio embedding in share cards** — Defer; v1 is a static PNG.

## Success Criteria *(mandatory, measurable)*

### Measurable Outcomes

- **SC-MOB-001**: ≥ 20% of active students install the mobile app within 60 days of `005_mobile_app` flag enable.
- **SC-MOB-002**: ≥ 50% of installers keep the app installed for ≥ 30 days (retention proxy).
- **SC-MOB-003**: Mobile dashboard p95 render ≤ 3s on a 3G connection (8 Mbps).
- **SC-MOB-004**: Push delivery: APNs ≥ 95% in 5s, FCM ≥ 95% in 5s, web-push fallback ≤ 80% in 5s.
- **SC-AA-001**: ≥ 8% of active students save at least 1 cover-letter draft within 30 days of `005_auto_apply_cover_letter` flag enable.
- **SC-AA-002**: ≥ 4% of active students complete at least 1 headless auto-apply session (form filled + submit clicked) within 60 days.
- **SC-AA-003**: Daily draft cap is enforced for 100% of students; zero over-cap generations.
- **SC-AA-004**: Playwright session create p95 ≤ 5s; embed render p95 ≤ 1s after the headless page is ready.
- **SC-AA-005**: 100% of auto-apply sessions are logged in `auto_apply_log` with at least 10 step rows; 0 partial submissions on student abandon.
- **SC-LB-001**: ≥ 60% of active students are opted-in to the leaderboard by default; ≤ 1% opt out within 30 days.
- **SC-LB-002**: Leaderboard query p95 ≤ 500ms; materialized view refresh p95 ≤ 5 min; staleness header present 100% of the time.
- **SC-LB-003**: ≥ 5% of opted-in students share a "Claim this rank" card within 30 days of `005_esports_ui` flag enable.
- **SC-LB-004**: Recruiter leaderboard usage: ≥ 3 partner companies use the recruiter view to shortlist candidates within 90 days.
- **SC-UI-001**: Tier badge accuracy: 100% of badges match the percentile band at render time (verified by snapshot regression test).
- **SC-UI-002**: Confetti and streak-fire animations: 100% of mounts complete within 3s; ≤ 5MB peak memory; no jank > 16ms on a 60Hz screen.

## Assumptions

1. **The 003 web-push tokens are migratable** — every existing web-push token becomes a `mobile_device_tokens` row with `kind='web_push_legacy'`; a one-time migration is acceptable.
2. **EAS Build + Submit accounts are pre-provisioned** for the Antarix Apple Developer and Google Play Console orgs; CI uses `EAS_TOKEN` from the secret bundle.
3. **Playwright runs on a hardened Node service** alongside the existing 002/003/004 services; the auto-apply service is NOT a Supabase Edge Function (Playwright is too heavy for Deno); it is a separate Node service in the monorepo, deployed via the existing `apps/web` infrastructure.
4. **The 006 privacy-center UI is already shipped** before the mobile app's "Signals/Privacy" tile is wired (it is read-only on the mobile app in v1).
5. **The 007 mentor list and curriculum today are read-only on mobile** in v1; full interactive features (request mentor, complete lesson) ship in v2.
6. **The 008 collab room join is a deep link** to the web route, loaded inside the mobile app's webview; the mobile app does not render Monaco or LiveKit in v1.
7. **Tier-band percentile computation runs in the same nightly cron** as the materialized view refresh; the cron is in `052_cron_005.sql`.
8. **The `mv_cross_college_leaderboard` is a Postgres MATERIALIZED VIEW** (per the user's deferral of ClickHouse); it is refreshed by `REFRESH MATERIALIZED VIEW CONCURRENTLY` to allow concurrent reads.
9. **The leaderboard API is read-only public** with no API key required (per the 004 public-API pattern); rate-limited by IP at 60 req/min.
10. **The auto-apply service is gated to a 1-tenant pilot** for the first 30 days post-launch; scale to all tenants only after the kill-switch and CAPTCHA pause are battle-tested.
