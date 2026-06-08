# Tasks: Antarix 11/10 — Verified Skill Intelligence Platform

**Input**: Design documents from `specs/002-antarix-definitive-vision/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md
**Builds on**: `specs/001-antarix-complete-workflow/tasks.md` (foundation phases T001–T026 are inherited as completed)

**Tests**: Not explicitly requested in spec. Test tasks omitted from the per-story phases. Add via `/speckit-checklist` if TDD is needed. E2E and integration test files are listed in `quickstart.md` for reference.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

## Path Conventions

- **Web app**: `apps/web/src/` (Next.js)
- **Extension**: `apps/extension/src/` (Chrome MV3)
- **Shared**: `packages/types/`, `packages/utils/`
- **Database**: `supabase/migrations/`, `supabase/functions/`

---

## Phase 1: Setup (Inherited + 002 Additions)

**Purpose**: 002-specific environment, tooling, and project scaffolding on top of the 001 foundation

**Inherited from 001 (all completed)**: T001 Turborepo init, T002 Next.js 15 app, T003 Chrome Extension scaffold, T004 shared types package, T005 shared utils package, T006 Tailwind + shadcn/ui, T007 `.env.local.example`, T008 Supabase init.

- [x] T009 [P] Add 002 environment variables to `turbo.json` `globalEnv` (WHATSAPP_*, CREDENTIAL_*, PLACEMENT_PREDICTION_*, NUDGE_*, VAPID_*)
- [x] T010 [P] Add 002 environment variables to `.env.local.example` at repo root (per `quickstart.md` block — including `CREDENTIAL_SNAPSHOT_REFRESH_DELTA` and `WHATSAPP_COST_GUARD_WEEKLY_MESSAGES_PER_STUDENT`)
- [ ] T011 [P] Register Meta WhatsApp Business account and submit the 4 message templates for approval (`antarix_daily_morning_v1`, `antarix_peak_window_v1`, `antarix_streak_risk_v1`, `antarix_weekly_summary_v1`)
- [x] T012 [P] Add `@supabase/supabase-js` (already present) and `twilio` SDK to `apps/web/package.json`; add `handlebars` to `supabase/functions/_shared/package.json` for template rendering

---

## Phase 2: Foundational (002 Schema + Edge Function Scaffolding)

**Purpose**: New tables, additive column deltas, and reusable building blocks that every 002 user story depends on. **MUST complete before any user story.**

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Inherited from 001 (all completed)**: T009–T019 (migrations 001–011), T020 seed, T021 auth providers, T022 Supabase clients, T023 generated types, T024 Next.js middleware, T025 shadcn/ui components, T026 API request/response types.

- [x] T013 Create migration `supabase/migrations/020_whatsapp.sql` — `whatsapp_connections` (with state-transition constraints), `nudge_preferences` (one-per-user PK), `nudges` (with all enums and the partial index on queued sends), `nudge_responses`
- [x] T014 [P] Create migration `supabase/migrations/021_predictions.sql` — `placement_predictions` (UNIQUE (user_id, run_week), full feature-snapshot column), `exam_windows` (UNIQUE (user_id, start_date, end_date))
- [x] T015 [P] Create migration `supabase/migrations/022_credentials.sql` — `verifiable_credentials` (UNIQUE public_slug, snapshot fields, revocation), `credential_distributions` (UNIQUE (credential_id, channel))
- [x] T016 [P] Create migration `supabase/migrations/023_applications.sql` — `student_applications` (UNIQUE (student_user_id, company_id)), `interview_slots`
- [x] T017 [P] Create migration `supabase/migrations/024_extension_telemetry.sql` — `extension_telemetry` (BIGSERIAL PK, indexed on (user_id, last_heartbeat_at DESC))
- [x] T018 [P] Create migration `supabase/migrations/025_privacy.sql` — `privacy_requests`, plus the 30-day soft-delete trigger that sets `users.deletion_purge_after = now() + interval '30 days'` and a separate trigger that invalidates `verifiable_credentials.revocation_status = 'revoked'` within 24 hours of `users.deletion_requested_at`
- [x] T019 Create migration `supabase/migrations/026_user_deltas.sql` — additive columns on 001 tables per `data-model.md` Schema Deltas: `users` (whatsapp_opt_in, company_search_visible, power_mode_active, power_mode_badge_shown_at, placement_prediction_current_id, verifiable_credential_id, deletion_requested_at, deletion_purge_after); `github_accounts` (last_error, last_error_at, scope); `calendar_accounts` (last_error, last_error_at); `sessions` (extension_version, sync_status, sync_error); `calendar_events` (derived_event_type, is_all_day, attendee_count); `job_matches` (interview_scheduling_state); `candidate_profiles` (last_score_change_at, peak_window_start_local_hour, peak_window_end_local_hour, power_mode_bonus_active); `companies` (monthly_search_credit_balance, monthly_search_credit_reset_at); `recruiter_searches` (last_run_at, last_results_count)
- [x] T020 Create migration `supabase/migrations/027_rls_policies_002.sql` — RLS policies for all new tables per `data-model.md` RLS section (incl. the public-SELECT policy on `verifiable_credentials` exposing only `public_slug, snapshot_*, revocation_status`)
- [x] T021 Create `supabase/functions/_shared/template-render.ts` — Handlebars helper that takes a template string + context and returns the rendered body (used by every nudge type)
- [x] T022 [P] Create `supabase/functions/_shared/whatsapp-provider.ts` — provider abstraction exposing `sendText`, `sendTemplate`, `verifyWebhook`; backed by Meta Cloud API by default, Twilio as fallback (selected by `WHATSAPP_PROVIDER` env)
- [x] T023 [P] Create `supabase/functions/_shared/peak-window.ts` — pure function: bucket sessions/commits by local hour, return `{startHour, endHour, multiplier, confidence}` (used by US3, US5, US7)
- [x] T024 [P] Create `supabase/functions/_shared/score-weights.ts` — `getWeightingProfile(userId)` returns 'passive' or 'power_mode' weight set per `ANTARIX_11_10_DEFINITIVE.md §8`; consumed by score recompute and placement prediction
- [x] T025 Create `supabase/functions/_shared/suppress-nudge.ts` — pure function `shouldSuppress({prefs, type, localNow, examWindow})` returns one of the documented suppression reasons or `null`; gates every nudge dispatch

**Checkpoint**: All 11 new tables exist with RLS; additive deltas applied; shared template/whatsapp/score/suppress helpers are unit-testable in isolation.

---

## Phase 3: User Story 1 — Student Onboarding with Day-1 Value (Priority: P1) 🎯 MVP

**Goal**: New student signs up via GitHub OAuth and sees a real, GitHub-derived dashboard within 3 minutes (kills the 001 7-day wait). Calendar, WhatsApp, and Power Mode are invited — never required.

**Independent Test**: Create account against a GitHub user with 3+ months of public history. Confirm dashboard shows real commits, top 3 languages, peak hours, streak, and a first Skill Proof Score within 60 seconds of OAuth completion — with no Chrome Extension installed.

### Implementation for User Story 1

- [x] T026 [US1] Update `apps/web/src/app/(auth)/callback/route.ts` — when GitHub OAuth completes, enqueue an immediate (synchronous) `github-sync` Edge Function call for the new user and persist `users.onboarding_step = 'dashboard'`, so the post-OAuth redirect lands on a populated dashboard instead of an empty one
- [x] T027 [US1] Create `supabase/functions/github-sync-fast/index.ts` — initial-sync variant: ingests up to 90 days of public commits, computes first-pass language breakdown + peak hours + streak, writes a `candidate_profiles` row with `last_score_change_at = now()`; deliberately *not* throttled like the recurring sync
- [x] T028 [US1] Update `apps/web/src/app/(student)/dashboard/page.tsx` — Day-1 rendering: real commits card, top-3 languages bar, peak-hours clock, streak chip, first Skill Proof Score gauge; never show "insights in 7 days" empty state for a user with any GitHub history
- [x] T029 [P] [US1] Create `apps/web/src/app/(student)/dashboard/_components/DayOneInsights.tsx` — client component that calls `GET /skill-proof/me` and renders insights within 60 seconds of OAuth (Suspense-friendly skeleton fallback)
- [x] T030 [P] [US1] Create `apps/web/src/app/(student)/onboarding/profile/page.tsx` — slim 3-field form (goals, skill level, "connect calendar?" prompt with Skip); no full multi-step wizard (per 002 Day-1 mandate)
- [x] T031 [P] [US1] Create `apps/web/src/components/onboarding/PowerModeInvite.tsx` — persistent "Install Power Mode Extension" card on the dashboard for non-Power-Mode students; links to Chrome Web Store and shows "extension not yet detected" hint until `extension_telemetry` confirms install
- [x] T032 [US1] Update `apps/web/src/app/(student)/dashboard/page.tsx` to add a "Connect WhatsApp" affordance card (calls `POST /whatsapp/connect`, shows the deep-link `wa.me` URL)
- [x] T033 [US1] Add `nudge_preferences` row creation trigger in `supabase/migrations/026_user_deltas.sql` (fold into the user-deltas migration; alternative standalone `028_nudge_prefs_default.sql` listed in `quickstart.md` for teams that prefer one trigger per file) — on `users` insert, create a `nudge_preferences` row with documented defaults and the student's IANA timezone (best-effort from `Accept-Language` / IP; editable in settings)

**Checkpoint**: US1 complete — student signs up, sees real GitHub-derived dashboard within 60 seconds, can optionally connect Calendar/WhatsApp/Power Mode.

---

## Phase 4: User Story 2 — Passive Tracking (GitHub + Calendar) Without Manual Effort (Priority: P1)

**Goal**: Once connected, GitHub syncs every 2 hours and Calendar every 6 hours automatically. Errors are surfaced non-blockingly; disconnecting a source halts future ingestion without losing prior derived insights.

**Independent Test**: With a connected student, force a sync tick. Verify new commits/events within the window are reflected in the dashboard within one cycle. Revoke a token externally; verify the next dashboard visit shows a non-blocking reconnect prompt and prior insights remain visible.

### Implementation for User Story 2

- [x] T034 [US2] Update `supabase/functions/github-sync/index.ts` — set `github_accounts.last_error / last_error_at` on any non-2xx; on 401, transition `status = 'disconnected'` and do not retry until reconnect
- [x] T035 [P] [US2] Update `supabase/functions/calendar-sync/index.ts` — set `calendar_accounts.last_error / last_error_at`; derive `calendar_events.derived_event_type` and `is_all_day` at ingest time using documented keyword + all-day heuristics
- [x] T036 [US2] Create `supabase/functions/exam-week-detector/index.ts` — weekly pg_cron-driven scan; for each user with a connected calendar, look back 7 days of `calendar_events` and forward 21 days; if keyword density (titles containing "exam"/"test"/"midterm"/"end-sem") crosses `NUDGE_EXAM_WEEK_KEYWORD_DENSITY_THRESHOLD`, write an `exam_windows` row
- [x] T037 [US2] Add pg_cron schedule in `supabase/migrations/029_cron_002.sql` — `github-sync` every 2 hours, `calendar-sync` every 6 hours, `exam-week-detector` weekly Monday 02:00 UTC (after calendar-sync has settled)
- [x] T038 [US2] Create `apps/web/src/app/(student)/settings/sources/page.tsx` — connection management UI: each source shows status, last sync, last error (if any), reconnect button, disconnect button (per FR-014)
- [x] T039 [P] [US2] Create `supabase/functions/sources-disconnect/index.ts` — `DELETE /users/me/sources/{source}`: sets `status = 'disconnected'`, marks derived insights stale, writes a `privacy_requests` row
- [x] T040 [US2] Create `apps/web/src/components/dashboard/SyncHealthBanner.tsx` — non-blocking dashboard banner shown when any source has `last_error` within the last sync window; offers "Reconnect" deep link

**Checkpoint**: US2 complete — passive sync runs on schedule, errors surface, disconnect works without data loss.

---

## Phase 5: User Story 3 — AI Coach Nudges via WhatsApp and Push (Priority: P1)

**Goal**: A connected student receives Daily Morning (8 AM local), Real-Time Peak, Streak-Risk, and Weekly Summary nudges via WhatsApp with push fallback, can reply START/DONE/STATS/RANK/HELP, and can pause all nudges or override channel preferences.

**Independent Test**: For a student with 7+ days of history, trigger each nudge type and verify (a) WhatsApp delivery within 60s, (b) push fallback within 60s when WhatsApp is not connected, (c) nudge content uses the student's actual peak window, current streak, current project, current calendar free time, and (d) interactive commands update state correctly.

### Implementation for User Story 3

- [x] T041 [US3] Create `supabase/functions/nudge-trigger/index.ts` — pg_cron entry point; reads `nudge_preferences` per user, decides which nudges are due (daily at `daily_send_local_time` in the user's tz; weekly Sunday 10 AM; hourly streak-at-risk check; event-driven from `trigger_nudge_event()` SQL helper), calls `shouldSuppress` for each, and calls `nudge-dispatch` for the survivors
- [x] T042 [P] [US3] Create `supabase/functions/nudge-dispatch/index.ts` — given a `(user, type, context)` tuple, picks the template, renders it via `template-render`, writes the `nudges` row in `delivery_status = 'queued'`, then hands off to `whatsapp-send` or `push-send` per channel preference
- [x] T043 [P] [US3] Create `supabase/functions/whatsapp-send/index.ts` — renders body + sends via `whatsapp-provider.sendTemplate`; updates `nudges.delivery_status` to `delivered`/`failed`; records `whatsapp_connections.last_delivery_at` or `last_error`
- [x] T044 [P] [US3] Create `supabase/functions/push-send/index.ts` — web-push fallback for students without WhatsApp; uses VAPID keys from env; updates `nudges.delivery_status` the same way
- [x] T045 [US3] Create `supabase/functions/whatsapp-webhook/index.ts` — inbound handler: verifies webhook token, resolves `phone_number → user_id` via `whatsapp_connections`, writes a `nudge_responses` row, applies documented state changes (START → opens an ad-hoc session; DONE → closes it; STATS → returns formatted stats; RANK → returns cohort rank; HELP → returns command list; PAUSE/RESUME → toggles `nudge_preferences.pause_all`), then dispatches a confirmation reply
- [x] T046 [US3] Create `supabase/migrations/030_nudge_events.sql` — `trigger_nudge_event(user_id, event_type, context jsonb)` SQL helper that the rest of the system calls to enqueue an event-driven nudge (e.g., score recomputed → streak-risk check; calendar free-window opened → real-time peak)
- [x] T047 [US3] Update `turbo.json` `globalEnv` to add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`; add `web-push` to `apps/web/package.json`
- [x] T048 [US3] Create `apps/web/src/app/(student)/ai-coach/page.tsx` — student-facing nudge inbox: paginated list of nudges (oldest or newest), per-row delivery status, click-through targets, reply box for web-channel "command" replies (parity with WhatsApp commands)
- [x] T049 [P] [US3] Create `apps/web/src/app/(student)/settings/notifications/page.tsx` — nudge preferences editor: timezone selector, daily/weekly send times, quiet hours, master "pause all" switch, per-type toggles, per-channel toggles; calls `PUT /nudges/preferences`
- [x] T050 [P] [US3] Create `apps/web/src/app/(student)/settings/sources/page.tsx` WhatsApp section — calls `POST /whatsapp/connect`, shows the `wa.me` deep link with the opt-in code, calls `DELETE /whatsapp/connect` to disconnect (overlaps with US2; keep the WhatsApp-only UI here, the source-management UI in US2)
- [x] T051 [US3] Add pg_cron schedule for `nudge-trigger` in `supabase/migrations/029_cron_002.sql` — daily at every hour (the function itself decides per-user local-time), hourly streak-risk check
- [x] T052 [US3] Add a SQL trigger in `supabase/migrations/030_nudge_events.sql` so that a `sessions` insert (Power Mode) calls `trigger_nudge_event('peak_session_started', ...)` for the in-progress real-time-peak pattern
- [x] T053 [US3] Add `apps/web/src/lib/timezone.ts` helper — converts UTC → IANA local time, used by both the dashboard banner and the inbox timestamps; covered by a unit test in `packages/utils/__tests__/timezone.test.ts`

**Checkpoint**: US3 complete — daily/weekly/real-time/streak nudges flow on schedule, WhatsApp + push both work, interactive commands update state, all suppression rules (quiet hours, exam weeks, pause, opt-out) honored.

---

## Phase 6: User Story 4 — Power Mode (Optional Chrome Extension) for Deeper Tracking (Priority: P2)

**Goal**: Students who install the extension get session/focus tracking and a ⚡ Power Mode badge; uninstalling the extension stops new sessions but never removes prior data or passive-only functionality.

**Independent Test**: Install extension → start a "Coding" session on a single editor window → end with rating → confirm a session row appears in the dashboard timeline within one sync cycle and the ⚡ badge appears on the profile.

### Implementation for User Story 4

- [x] T054 [P] [US4] Create `apps/extension/src/background/heartbeat.ts` — every 15 minutes while running, POST `{extension_version, browser}` to `/extension/heartbeat`; the `extension_telemetry` row's freshness is what gates the ⚡ badge
- [x] T055 [US4] Update `apps/extension/src/background/service-worker.ts` to register a new `chrome.alarms` entry for the heartbeat alongside the existing hourly session sync
- [x] T056 [US4] Update `apps/web/src/lib/algorithms/skill-proof-score.ts` — when `extension_telemetry` shows a heartbeat within `NUDGE_POWER_MODE_BADGE_FRESHNESS_HOURS`, switch to the Power-Mode weighting profile per `score-weights.getWeightingProfile`; expose the diff (passive vs Power Mode) on demand for FR-005 acceptance
- [x] T057 [US4] Update `apps/web/src/app/(student)/dashboard/page.tsx` to render the ⚡ Power Mode badge next to the user's display name when `users.power_mode_active = true` (derived in a SQL helper from `extension_telemetry` freshness)
- [x] T058 [P] [US4] Create `supabase/migrations/031_power_mode_helper.sql` — SQL view `v_power_mode_status` returning `(user_id, power_mode_active, last_heartbeat_at)`; consumed by the dashboard badge and the score-weight switch
- [x] T059 [P] [US4] Create `apps/web/src/app/(student)/dashboard/sessions/page.tsx` — when `power_mode_active = true`, show a per-session timeline with category, duration, focus quality, and self-rating (already partially in 001; extend to render Power-Mode fields)
- [x] T060 [US4] Update `apps/web/src/components/onboarding/PowerModeInvite.tsx` (from US1) — when telemetry confirms install, switch the card into a "Power Mode Active" confirmation state
- [x] T061 [US4] Add `onExtensionUninstalled` listener in `apps/extension/src/background/service-worker.ts` — clears `currentSession` from local storage and calls `/extension/heartbeat` one last time so the badge disappears within the freshness window
- [x] T062 [US4] Add a `packages/utils/__tests__/power-mode-badge.test.ts` unit test for the badge-freshness rule (heartbeat within `NUDGE_POWER_MODE_BADGE_FRESHNESS_HOURS` → active; older → inactive)

**Checkpoint**: US4 complete — install → badge → session data flows in; uninstall → badge clears → prior data preserved.

---

## Phase 7: User Story 5 — Verified Skill Proof, Placement Prediction, Exportable Credential (Priority: P1)

**Goal**: Continuously-updated 0-100 Skill Proof Score; weekly placement prediction (probability, tier, time-to-ready, top-3 gaps) for students with 30+ days of activity; exportable public credential (link + PDF + QR + LinkedIn badge) that any third party can verify.

**Independent Test**: For a student with 90+ days of activity: (a) score recomputes on each new sync with a visible delta, (b) prediction generates within the weekly cadence with all four documented fields, (c) exported credential resolves at the public URL with current live score and "last verified" timestamp.

### Implementation for User Story 5

- [x] T063 [P] [US5] Create `supabase/functions/placement-predict/index.ts` — weekly pg_cron call: for each user with `days_of_activity >= PLACEMENT_PREDICTION_MIN_DAYS`, compute `(probability, company_tier, time_to_ready_months, top_gaps)` via the rule-augmented scorer in `supabase/functions/_shared/placement-scorer.ts`; persist to `placement_predictions` with full feature snapshot
- [x] T064 [P] [US5] Create `supabase/functions/_shared/placement-scorer.ts` — pure function `(features, historicalCohortData) → {probability, tier, time_to_ready, top_gaps}`; versioned by `PLACEMENT_PREDICTION_MODEL_VERSION`; inputs documented in `research.md` Decision D
- [x] T065 [P] [US5] Create `supabase/functions/credential-issue/index.ts` — creates/refreshes `verifiable_credentials` row; refreshes only when `abs(current_score - snapshot_overall_score) >= CREDENTIAL_SNAPSHOT_REFRESH_DELTA` (default 3, see spec.md A-014); generates/refreshes `credential_distributions` artifacts
- [x] T066 [P] [US5] Create `supabase/functions/credential-public/index.ts` — `GET /verify/{slug}` (no JWT): returns JSON (or HTML, per `Accept`) with `student, overall_score, per_skill, verified_activity, cohort_percentile, snapshot_taken_at, current_score_delta, revocation_status, last_verified_at`; bumps `verification_count` and `last_verified_at`
- [x] T067 [US5] Add pg_cron schedule for `placement-predict` (weekly Monday 03:00 UTC) and `credential-issue` (daily 04:00 UTC) in `supabase/migrations/029_cron_002.sql`
- [x] T068 [US5] Create `apps/web/src/app/(student)/credential/page.tsx` — credential management page: public URL, copy-link button, snapshot details, "Download PDF" / "Generate QR" / "Share on LinkedIn" affordances (each calls `POST /credential/distribution`)
- [x] T069 [P] [US5] Create `apps/web/src/app/(student)/dashboard/_components/PlacementPredictionCard.tsx` — when `qualifying = true`, shows probability, tier, time-to-ready, top-3 gap chips with recommended actions; when below threshold, shows "X days remaining" placeholder
- [x] T070 [P] [US5] Create `apps/web/src/app/(student)/dashboard/_components/SkillProofCard.tsx` — current 0-100 score with the documented component breakdown (passive: GitHub 50 / Calendar 10 / Consistency 20 / Peer 20; Power Mode: GitHub 35 / Session Quality 25 / Consistency 20 / Peer 20); shows the delta vs prior and the "what would change if I installed Power Mode" diff
- [x] T071 [US5] Update `apps/web/src/lib/algorithms/skill-proof-score.ts` (extended by US4) to be invoked on every `sessions` insert and on every `github-sync` completion via a SQL trigger that calls a `supabase functions invoke` RPC; keep the computation server-side
- [x] T072 [P] [US5] Create `apps/web/src/app/(student)/dashboard/skills/page.tsx` — per-skill breakdown (hours, projects, completion rate, focus quality, score, proficiency badge) — already partially in 001; extend to show the "export to credential" snapshot for each top skill
- [x] T073 [US5] Create `apps/web/src/app/(student)/applications/page.tsx` — student's one-click-apply history: list of companies, status (`submitted`/`viewed_by_company`/`interview_proposed`/`interview_accepted`/`rejected`/`withdrawn`), credential snapshot used
- [x] T074 [P] [US5] Create `supabase/functions/one-click-apply/index.ts` — `POST /applications`: creates a `student_applications` row, snapshots the current `verifiable_credentials` row, returns `201`
- [x] T075 [P] [US5] Create `apps/web/src/app/verify/[slug]/page.tsx` — public Next.js page that calls `GET /verify/{slug}` and renders the verification card (HTML mode); no auth required; OG meta tags for LinkedIn previews
- [x] T076 [US5] Add `packages/utils/__tests__/placement-scorer.test.ts` and `packages/utils/__tests__/credential-threshold.test.ts` — unit tests for the scorer inputs/outputs and the snapshot-refresh threshold

**Checkpoint**: US5 complete — score, prediction, and credential are live, exportable, and publicly verifiable.

---

## Phase 8: User Story 6 — College Dashboard, Leaderboards, and Curriculum Intelligence (Priority: P2)

**Goal**: A paid college administrator sees placement-readiness segmentation, per-batch live leaderboards, skill-gap vs. industry-demand report, company matches that name specific students, and alumni tracking.

**Independent Test**: For a college with 50+ opted-in students across two batches, verify (a) readiness segments sum to the opted-in count, (b) leaderboard ranking matches per-student scores with documented tie-breakers, (c) skill-gap report reconciles to underlying data, (d) company-match recommendations name specific students.

### Implementation for User Story 6

- [x] T077 [US6] Create `apps/web/src/app/(college)/dashboard/page.tsx` — readiness segmentation (Ready Now / Development Path / Early Stage) with counts and percentages; "live leaderboard" top-10 list with per-row ⚡ and streak indicators; "curriculum intelligence" widget showing supply vs demand per skill with at least one recommendation
- [x] T078 [P] [US6] Create `apps/web/src/app/(college)/dashboard/_components/LeaderboardTable.tsx` — paginated batch leaderboard; ties broken by `users.last_active_at DESC` then `users.id` (documented tie-breakers)
- [x] T079 [P] [US6] Create `apps/web/src/app/(college)/dashboard/_components/CurriculumIntelligence.tsx` — supply-side (cohort members with skill ≥ intermediate) vs. demand-side (companies.searched-for skills, last 90 days) chart with recommendation logic
- [x] T080 [US6] Create `supabase/functions/college-aggregate/index.ts` — `GET /college/dashboard/aggregate?institution_id=...&batch_year=...` — returns readiness counts, leaderboard, and skill-gap report from opted-in members only; documented RLS guard
- [x] T081 [P] [US6] Create `apps/web/src/app/(college)/companies/page.tsx` — company matches: lists companies with named opted-in students who match, "Auto-Send" button (calls `POST /job-matches/auto-send` to deliver one-click invites)
- [x] T082 [US6] Update `apps/web/src/app/(college)/students/[id]/page.tsx` (inherited from 001 US6) — add placement prediction (from US5), credential public link (from US5), and Power Mode status indicators
- [x] T083 [US6] Add `apps/web/src/app/(college)/dashboard/page.tsx` "alumni view" — graduates (`batch_year < current_year`) transition to alumni metrics (placement outcomes, tier, salary band if shared)
- [x] T084 [US6] Add an `apps/web/src/lib/algorithms/leaderboard-tie-breakers.ts` module with the documented tie-breaker rules and a unit test in `packages/utils/__tests__/leaderboard.test.ts`
- [x] T085 [US6] Create `apps/web/src/app/(college)/students/page.tsx` — student roster with per-row scores, batch/specialization filters, opted-in-only guard

**Checkpoint**: US6 complete — college admin sees full placement intelligence, leaderboard is live, company matches name specific students.

---

## Phase 9: User Story 7 — Company Search, One-Click Invite, and Interview Scheduling (Priority: P3)

**Goal**: A paying recruiter searches verified candidates, sees fit/match scores, one-click-invites specific students, and (on acceptance) auto-schedules interview slots against both calendars that prefer the candidate's peak window.

**Independent Test**: For a recruiter with search credits, run a skill+score filter that returns ≥10 candidates, one-click-invite a candidate with a connected calendar, accept the invite, and verify a proposed slot is generated that respects the candidate's confirmed peak window.

### Implementation for User Story 7

- [x] T086 [US7] Update `apps/web/src/app/(company)/search/page.tsx` — search filters (skills multi-select, min score slider, batch years, locations, Power-Mode-only toggle), results list with per-row score, match score, verified activity summary, ⚡ badge
- [x] T087 [P] [US7] Create `supabase/functions/recruiter-search/index.ts` — server-side search that filters on `candidate_profiles` joined to `users.company_search_visible = true AND users.power_mode_*`, enforces monthly credit balance, decrements credits, persists the search and the results count
- [x] T088 [P] [US7] Create `supabase/functions/recruiter-invite/index.ts` — `POST /job-matches/invite` (one-click invite): creates a `job_matches` row in `reached_out` state; student receives a nudge of type `verification`; on acceptance, transitions to `interview_proposed`
- [x] T089 [US7] Create `supabase/functions/interview-schedule/index.ts` — `POST /job-matches/{id}/schedule` — given the interviewer's user IDs and a search window, generates proposed `interview_slots` by intersecting the candidate's calendar, the interviewer's calendar, and the candidate's peak window; orders peak-window-matched slots first
- [x] T090 [P] [US7] Create `apps/web/src/app/(company)/search/results/page.tsx` — candidate cards: per-skill proof, match score, "One-Click Invite" button, "Schedule Interview" (disabled until invite accepted), "Save Candidate" affordance
- [x] T091 [P] [US7] Create `apps/web/src/app/(company)/pipeline/page.tsx` — pipeline funnel view per recruiter (invite → accepted → interviewed → outcome) with documented Antarix-source attribution
- [x] T092 [US7] Update `apps/web/src/app/(company)/analytics/page.tsx` — add a "monthly search credit balance" widget; add an "Antarix-sourced hires" funnel chart
- [x] T093 [US7] Append to `supabase/migrations/027_rls_policies_002.sql` (the file T020 created) — recruiter can read only `candidate_profiles` rows where the candidate is in the company's search filter and the candidate has `company_search_visible = true`; never expose opted-out candidates in result counts
- [x] T094 [US7] Add `packages/utils/__tests__/interview-slot-generator.test.ts` — unit test for the slot-generation rules (peak-window-first, free-calendar-only, partial-result flag, ≥3 slots target)

**Checkpoint**: US7 complete — search filters honor opt-out, one-click invite delivers, accepted invite produces calendar-aware slots.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting production readiness for 002

- [x] T095 [P] Add e2e tests per `quickstart.md`: `tests/e2e/day1-onboarding.spec.ts` (signup → real insights in < 3 min), `tests/e2e/ai-coach-whatsapp.spec.ts` (nudge delivery + interactive commands), `tests/e2e/credential-public-page.spec.ts` (`/verify/{slug}` renders + invalidates on score change), `tests/e2e/privacy-opt-out.spec.ts` (opted-out students never appear in recruiter search)
- [x] T096 [P] Add integration tests: `tests/integration/placement-prediction.test.ts`, `tests/integration/exam-week-suppression.test.ts`, `tests/integration/credential-threshold.test.ts`
- [x] T097 [P] Add `apps/web/src/lib/whatsapp-cost-guard.ts` — soft cap (configurable per env: `WHATSAPP_COST_GUARD_WEEKLY_MESSAGES_PER_STUDENT` default 20) on outbound WhatsApp messages per student per week; when exceeded, the next nudge falls back to push-only and a metric is emitted; per spec.md A-011 (defensive cost guards in scope) and `quickstart.md` cost-scaling risk
- [x] T098 [P] Documentation: update `README.md` with a "Day-1 Value" section and a "WhatsApp setup" section linking to `quickstart.md`; add a "Privacy controls" page under `apps/web/src/app/(student)/settings/privacy/page.tsx` with toggles for company-search opt-out and a "Delete my account" flow that calls `DELETE /users/me`
- [x] T099 [P] Add `apps/web/src/components/dashboard/NudgePrefsInline.tsx` — small in-banner "Mute for today" / "Pause all" controls surfacing in every nudge inbox item (per FR-020's "single pause-all control" requirement)
- [x] T100 Performance and observability: add structured logging for `nudges`, `placement_predictions`, `verifiable_credentials`, and `student_applications`; add a Grafana-friendly `daily_metrics` SQL view exposing nudge-delivery p95, credential-verification count, and prediction-runs-per-day
- [x] T101 Security hardening pass: validate every 002 endpoint with Zod schemas in `packages/types/api.ts`; rate-limit `POST /whatsapp/connect` and `POST /applications`; verify all 002 RLS policies with the Supabase linter
- [x] T102 Run `quickstart.md` validation — verify the local Day-1 end-to-end test passes on a clean machine, including the cloudflared-tunneled WhatsApp webhook path

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T009–T012 (002 env + template registration) depend on inherited 001 setup
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phase 3–9)**: All depend on Foundational completion
  - Stories proceed in priority order: US1 → US2 → US3 → US4 → US5 → US6 → US7
  - US6 depends on US5 (placement dashboard reads candidate profiles and credentials)
  - US7 depends on US5 (search results show placement prediction and credential snapshot)
  - US3 depends on US1 + US2 (nudges reference the dashboard's data and respect sync status)
  - US4 depends on US1 (badge appears on the dashboard)
  - US5 depends on US1 + US2 + US4 (score, prediction, and credential are derived from passive data and refined by Power Mode)
- **Polish (Phase 10)**: After all desired user stories complete

### Critical Path

```
Setup → Foundational → US1 (Day-1 Onboarding) → US2 (Passive Tracking) → US3 (AI Coach) → US5 (Score + Prediction + Credential)
                                                                          ↘ US4 (Power Mode) — feeds US5
                                                                                ↘ US6 (College) ← US5
                                                                                ↘ US7 (Company) ← US5
```

### Parallel Opportunities

- Phase 1: T009, T010, T011, T012 can run in parallel
- Phase 2: T013–T018 (migrations 012–017 + deltas) can run in parallel; T022–T025 (shared helpers) can run in parallel with migrations
- Phase 3: T029, T030, T031 can run in parallel
- Phase 4: T034, T035 can run in parallel
- Phase 5: T042, T043, T044 can run in parallel; T048, T049, T050 can run in parallel
- Phase 6: T054, T058, T059 can run in parallel
- Phase 7: T063, T064, T065, T066 can run in parallel; T068, T069, T070, T072, T074, T075 can run in parallel
- Phase 8: T078, T079, T081 can run in parallel
- Phase 9: T086, T087, T088, T090, T091 can run in parallel
- Phase 10: T095, T096, T097, T098, T099 can run in parallel

---

## Parallel Example: User Story 3 (AI Coach)

```bash
# Launch shared dispatch and channel helpers in parallel:
Task: "Create nudge-dispatch in supabase/functions/nudge-dispatch/index.ts"
Task: "Create whatsapp-send in supabase/functions/whatsapp-send/index.ts"
Task: "Create push-send in supabase/functions/push-send/index.ts"

# Then sequential:
Task: "Create nudge-trigger in supabase/functions/nudge-trigger/index.ts"   # depends on helpers
Task: "Create whatsapp-webhook in supabase/functions/whatsapp-webhook/index.ts"  # depends on whatsapp-provider

# Then in parallel, the student-facing surfaces:
Task: "Create ai-coach inbox in apps/web/src/app/(student)/ai-coach/page.tsx"
Task: "Create notification settings in apps/web/src/app/(student)/settings/notifications/page.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — the "Day-1 Value" bundle)

1. Complete Phase 1: 002 Setup (env + WhatsApp template approval)
2. Complete Phase 2: Foundational (schema + shared helpers)
3. Complete Phase 3: US1 (Day-1 Onboarding)
4. Complete Phase 4: US2 (Passive Tracking)
5. Complete Phase 5: US3 (AI Coach — Daily Morning only at first, then Real-Time, then Streak-Risk, then Weekly)
6. **STOP and VALIDATE**: Student signs up → sees real dashboard → gets daily WhatsApp nudges → no extension required
7. Deploy to staging

### Incremental Delivery

1. Setup + Foundational → Foundation ready (incl. WhatsApp templates approved)
2. US1 + US2 + US3 (Daily Morning) → "Day-1 + Daily Coach" demo
3. US3 (Real-Time + Streak + Weekly) → Full AI Coach live
4. US4 → Power Mode upgrade available
5. US5 → Score + Prediction + Exportable Credential live
6. US6 → College dashboard live
7. US7 → Company search + one-click apply + calendar-aware scheduling
8. Polish → Production-ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (onboarding) → US2 (passive tracking) → US3 (AI Coach)
   - Developer B: US4 (Power Mode) → US5 (score/prediction/credential)
   - Developer C: US6 (college) and US7 (company) — both depend on US5, so they start US5's college/company-facing surfaces as soon as US5's data layer lands
3. Polish together at the end

---

## Notes

- **[P] tasks** = different files, no dependencies
- **[Story] label** maps task to specific user story for traceability (US1–US7)
- Each user story is independently completable and testable at its checkpoint
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- US3 (AI Coach) is split into Daily-Morning first, then the remaining three nudge types — the Daily-Morning path is the single highest-engagement channel and should ship first
- US5 (Score + Prediction + Credential) is the P1 trust asset; even though US6/US7 depend on it, the credential export and the score recompute are independently demoable as soon as US5 lands
- Meta WhatsApp template approval (T011) is a real wall-clock prerequisite — submit templates in parallel with engineering, not after
