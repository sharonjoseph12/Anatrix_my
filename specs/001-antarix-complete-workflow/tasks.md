# Tasks: Antarix Verified Skill Proof Ecosystem

**Input**: Design documents from `specs/001-antarix-complete-workflow/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Not explicitly requested. Test tasks omitted. Add via `/speckit-checklist` if needed.

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

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo initialization, tooling, and project scaffolding

- [x] T001 Initialize Turborepo monorepo with pnpm workspaces in `pnpm-workspace.yaml` and `turbo.json`
- [x] T002 Create Next.js 15 app with App Router in `apps/web/` using `npx -y create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --use-pnpm`
- [x] T003 [P] Create Chrome Extension scaffold (MV3) in `apps/extension/` with `manifest.json`, Vite config, and TypeScript setup
- [x] T004 [P] Create shared types package in `packages/types/package.json` with `database.ts`, `api.ts`, `index.ts`
- [x] T005 [P] Create shared utils package in `packages/utils/package.json` with `date.ts`, `format.ts`, `index.ts`
- [x] T006 [P] Configure Tailwind CSS v4 and install shadcn/ui in `apps/web/`
- [x] T007 [P] Create `.env.local.example` at root with all required environment variables (Supabase, GitHub OAuth, Google OAuth)
- [x] T008 Initialize Supabase project with `npx supabase init` in `supabase/` directory and configure `supabase/config.toml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, auth, and core infrastructure — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create migration `supabase/migrations/001_users.sql` — `users` table with all fields from data-model.md (id, email, display_name, user_type, goals, skill_level, working_hours, onboarding_step, role, timestamps)
- [x] T010 [P] Create migration `supabase/migrations/002_sessions.sql` — `sessions` table with indexes on (user_id, started_at DESC) and (user_id, category)
- [x] T011 [P] Create migration `supabase/migrations/003_github.sql` — `github_accounts` and `github_activity` tables with unique constraint on (user_id, commit_hash)
- [x] T012 [P] Create migration `supabase/migrations/004_calendar.sql` — `calendar_accounts` and `calendar_events` tables
- [x] T013 [P] Create migration `supabase/migrations/005_skills.sql` — `skills` and `user_skills` tables with indexes on skill_proof_score
- [x] T014 [P] Create migration `supabase/migrations/006_insights.sql` — `insights` table with indexes on (user_id, created_at DESC) and (user_id, type)
- [x] T015 [P] Create migration `supabase/migrations/007_cohorts.sql` — `cohorts` and `cohort_members` tables with unique constraint on (cohort_id, user_id)
- [x] T016 [P] Create migration `supabase/migrations/008_institutions.sql` — `institutions` and `institution_members` tables with indexes on (institution_id, batch_year)
- [x] T017 [P] Create migration `supabase/migrations/009_companies.sql` — `companies`, `candidate_profiles`, `recruiter_searches`, `job_matches` tables with all indexes from data-model.md
- [x] T018 Create migration `supabase/migrations/010_rls_policies.sql` — Row Level Security policies for all tables per data-model.md RLS section
- [x] T019 Create migration `supabase/migrations/011_functions.sql` — PostgreSQL functions for skill proof score calculation and profile aggregation
- [x] T020 Create seed file `supabase/seed.sql` — skills catalog (Machine Learning, DevOps, Python, JavaScript, Cloud, etc. with difficulty_level, industry_demand, avg_hours_to_proficiency)
- [x] T021 Configure Supabase Auth providers: email/password, GitHub OAuth, Google OAuth in `supabase/config.toml`
- [x] T022 Create Supabase client helpers: `apps/web/src/lib/supabase/client.ts` (browser), `apps/web/src/lib/supabase/server.ts` (server), `apps/web/src/lib/supabase/middleware.ts` (auth middleware)
- [x] T023 Generate TypeScript types from Supabase schema into `packages/types/database.ts` using `npx supabase gen types typescript`
- [x] T024 Create Next.js middleware `apps/web/src/middleware.ts` for subdomain routing (antarix.app → student, college.antarix.app → college, recruiting.antarix.app → company) and auth session refresh
- [x] T025 [P] Create shared layout components: `apps/web/src/components/ui/` — install shadcn/ui Button, Card, Input, Dialog, Table, Badge, Avatar, DropdownMenu, Tabs, Progress, Chart
- [x] T026 [P] Create API request/response types in `packages/types/api.ts` matching all contracts from contracts/api.md

**Checkpoint**: Foundation ready — database up, auth working, shared components installed, subdomain routing active

---

## Phase 3: User Story 1 — Student Onboarding & Profile Setup (Priority: P1) 🎯 MVP

**Goal**: Student can sign up, complete profile, connect GitHub, and land on dashboard

**Independent Test**: Create account → fill profile → connect GitHub → see empty dashboard with "insights in 7 days" message

### Implementation for User Story 1

- [x] T027 [US1] Create auth layout `apps/web/src/app/(auth)/layout.tsx` — centered card layout with Antarix branding
- [x] T028 [P] [US1] Create signup page `apps/web/src/app/(auth)/signup/page.tsx` — email/password form, calls Supabase signUp, redirects to verify email prompt
- [x] T029 [P] [US1] Create login page `apps/web/src/app/(auth)/login/page.tsx` — email/password form, calls Supabase signInWithPassword, redirects to dashboard
- [x] T030 [US1] Create auth callback handler `apps/web/src/app/(auth)/callback/route.ts` — handles email verification and OAuth callbacks, exchanges code for session
- [x] T031 [US1] Create onboarding layout `apps/web/src/app/(student)/onboarding/layout.tsx` — multi-step progress indicator (Profile → GitHub → Calendar → Complete)
- [x] T032 [US1] Create profile setup page `apps/web/src/app/(student)/onboarding/profile/page.tsx` — form with display_name, user_type radio, goals checkboxes, skill_level radio, working_hours selects. Saves via Supabase update on `users` table
- [x] T033 [US1] Create GitHub connect page `apps/web/src/app/(student)/onboarding/github/page.tsx` — "Connect with GitHub" button triggers Supabase signInWithOAuth({provider:'github'}), shows connected state after callback, "Skip" option
- [x] T034 [US1] Create calendar connect page `apps/web/src/app/(student)/onboarding/calendar/page.tsx` — "Connect Google Calendar" button triggers Google OAuth, "Skip" option
- [x] T035 [US1] Create onboarding complete page `apps/web/src/app/(student)/onboarding/complete/page.tsx` — congratulations screen, Chrome extension download link, "Go to Dashboard" button, sets onboarding_completed_at
- [x] T036 [US1] Create student layout `apps/web/src/app/(student)/layout.tsx` — sidebar navigation (Dashboard, Insights, Peak Self, Cohorts, Settings), top bar with user avatar, responsive
- [x] T037 [US1] Create empty dashboard page `apps/web/src/app/(student)/dashboard/page.tsx` — shows "insights in X days" if < 7 days of data, otherwise loads brief data from GET /dashboard/brief
- [x] T038 [US1] Create GitHub callback Edge Function `supabase/functions/github-callback/index.ts` — receives OAuth code, stores github_accounts record, triggers initial repo/commit sync

**Checkpoint**: US1 complete — student can sign up, onboard, connect GitHub, and see dashboard

---

## Phase 4: User Story 2 — Activity Tracking via Chrome Extension (Priority: P1)

**Goal**: Student installs extension, starts/stops sessions, data syncs to backend

**Independent Test**: Install extension → start session → work for 5 min → end session → verify session appears in dashboard

### Implementation for User Story 2

- [x] T039 [US2] Create extension popup UI `apps/extension/src/popup/popup.html` and `popup.tsx` — login state, category selection (DSA/Coding/Project/Learning/Research), project name input, Start/End Session buttons
- [x] T040 [US2] Create extension popup components: `apps/extension/src/popup/components/SessionForm.tsx` (start), `SessionTimer.tsx` (active), `SessionComplete.tsx` (end)
- [x] T041 [US2] Implement session store `apps/extension/src/storage/session-store.ts` — uses chrome.storage.local to persist currentSession and pendingSessions
- [x] T042 [US2] Implement focus monitor `apps/extension/src/background/focus-monitor.ts` — tracks active tab domain every 5 seconds, calculates focus quality (High: ≤2 focused tabs, Medium: 3-5 tabs, Low: >5 or distraction domains)
- [x] T043 [US2] Implement service worker `apps/extension/src/background/service-worker.ts` — registers chrome.alarms for hourly sync, handles messages from popup, manages session lifecycle
- [x] T044 [US2] Implement sync module `apps/extension/src/background/sync.ts` — reads pendingSessions from storage, POSTs to /sessions/batch endpoint, clears synced sessions on success
- [x] T045 [US2] Create Supabase auth helper for extension `apps/extension/src/lib/supabase.ts` — stores auth token in chrome.storage, provides authenticated fetch wrapper
- [x] T046 [US2] Create session upload Edge Function `supabase/functions/session-upload/index.ts` — validates session data, inserts into sessions table, handles batch uploads, deduplicates
- [x] T047 [US2] Add session history view to dashboard `apps/web/src/app/(student)/dashboard/sessions/page.tsx` — lists recent sessions with category, duration, focus level, date

**Checkpoint**: US2 complete — extension tracks sessions, syncs to backend, visible on dashboard

---

## Phase 5: User Story 3 — Automated GitHub & Calendar Sync (Priority: P2)

**Goal**: Background jobs continuously sync GitHub commits and calendar events

**Independent Test**: Connect GitHub → wait for sync → verify commit history and language breakdown appear in profile data

### Implementation for User Story 3

- [x] T048 [US3] Create GitHub sync Edge Function `supabase/functions/github-sync/index.ts` — fetches commits since last_synced_at using GitHub API, stores in github_activity, updates last_synced_at, handles token expiry
- [x] T049 [US3] Create calendar sync Edge Function `supabase/functions/calendar-sync/index.ts` — fetches events using Google Calendar API, stores in calendar_events, handles token refresh
- [x] T050 [US3] Create pg_cron schedule in `supabase/migrations/012_cron_jobs.sql` — github-sync every 2 hours, calendar-sync every 6 hours for all active accounts
- [x] T051 [US3] Add integration status indicators to dashboard `apps/web/src/components/dashboard/IntegrationStatus.tsx` — shows GitHub/Calendar connection status, last sync time, reconnect button if disconnected
- [x] T052 [US3] Add GitHub activity summary to dashboard `apps/web/src/app/(student)/dashboard/github/page.tsx` — commit timeline, language breakdown chart, repository list

**Checkpoint**: US3 complete — external data flows in automatically, visible on dashboard

---

## Phase 6: User Story 8 — Skill Proof Score & Candidate Profile (Priority: P2)

**Goal**: System calculates verified skill scores and maintains searchable candidate profiles

**Independent Test**: Accumulate sessions + GitHub data for a skill → trigger score calculation → verify score components and proficiency level

**Note**: US8 is placed before US4 because insight generation (US4) depends on skill scoring algorithms

### Implementation for User Story 8

- [x] T053 [US8] Implement skill proof score algorithm `apps/web/src/lib/algorithms/skill-proof-score.ts` — weighted calculation: hours (25%), projects (35%), quality (25%), consistency (15%), returns 0-100 score with proficiency level
- [x] T054 [US8] Implement overall profile score algorithm `apps/web/src/lib/algorithms/profile-score.ts` — top 3 skills weighted average + breadth bonus (5+ skills, max +10) + specialization bonus (any skill >85, +5)
- [x] T055 [US8] Create profile update Edge Function `supabase/functions/update-profiles/index.ts` — runs daily via pg_cron, recalculates user_skills and candidate_profiles for all users with new data
- [x] T056 [US8] Add pg_cron schedule for daily profile update in `supabase/migrations/012_cron_jobs.sql` (append to existing)
- [x] T057 [US8] Create student skills page `apps/web/src/app/(student)/dashboard/skills/page.tsx` — shows per-skill breakdown (hours, projects, completion rate, focus quality, score), proficiency badge, progress toward next level
- [x] T058 [US8] Create candidate profile settings `apps/web/src/app/(student)/settings/profile-visibility/page.tsx` — toggles for is_public and is_open_to_opportunities

**Checkpoint**: US8 complete — skill scores calculated, profiles maintained, visibility controls working

---

## Phase 7: User Story 4 — Weekly Insight Generation & Dashboard (Priority: P2)

**Goal**: System generates peak window, workflow pattern, skill detection insights weekly; student sees them on dashboard

**Independent Test**: Accumulate 7 days of sessions → trigger insight generation → verify insights appear on Brief, Peak Self, and Insights pages

### Implementation for User Story 4

- [x] T059 [US4] Implement peak window analysis `apps/web/src/lib/algorithms/peak-window.ts` — buckets sessions by hour, calculates productivity multiplier, returns {startHour, endHour, multiplier, confidence}
- [x] T060 [P] [US4] Implement workflow pattern detection `apps/web/src/lib/algorithms/workflow-pattern.ts` — analyzes session sequences, finds most successful category orderings, returns {pattern, successRate, confidence}
- [x] T061 [P] [US4] Implement skill detection from GitHub `apps/web/src/lib/algorithms/skill-detection.ts` — aggregates commit languages and repo topics, maps to skills catalog, returns language/domain proficiency
- [x] T062 [US4] Create insight generation Edge Function `supabase/functions/generate-insights/index.ts` — runs weekly via pg_cron for users with 7+ days of data, calls all algorithms, stores results in insights table, triggers notification
- [x] T063 [US4] Add pg_cron schedule for weekly insight generation in `supabase/migrations/012_cron_jobs.sql` (append)
- [x] T064 [US4] Create Brief dashboard page `apps/web/src/app/(student)/dashboard/page.tsx` — update existing page: greeting, performance score gauge, recommended action card, risk/opportunity alerts, weekly stats (sessions, hours, commits)
- [x] T065 [US4] Create Peak Self page `apps/web/src/app/(student)/dashboard/peak-self/page.tsx` — peak window visualization (clock chart), best metrics cards, "Peak Day Blueprint" step-by-step schedule with activity icons and durations
- [x] T066 [US4] Create Insights page `apps/web/src/app/(student)/dashboard/insights/page.tsx` — insight cards with type icon, title, description, metric value, confidence bar, data points count, recommended action, "Validate This Week" button
- [x] T067 [US4] Create chart components `apps/web/src/components/charts/` — PerformanceGauge.tsx, PeakWindowClock.tsx, InsightCard.tsx, WeeklyStatsBar.tsx using shadcn/ui charts

**Checkpoint**: US4 complete — insights generated weekly, full dashboard experience live

---

## Phase 8: User Story 5 — Cohort Comparison & Community (Priority: P3)

**Goal**: Students discover cohorts, join them, and see comparison metrics

**Independent Test**: Join a cohort with 2+ members → view comparison page → see "You vs Cohort" metrics with advantages

### Implementation for User Story 5

- [x] T068 [US5] Create cohort discovery page `apps/web/src/app/(student)/dashboard/cohorts/page.tsx` — lists available cohorts with member count, peak window, avg focus quality, "Join" button
- [x] T069 [US5] Create cohort comparison page `apps/web/src/app/(student)/dashboard/cohorts/[id]/page.tsx` — "You vs Cohort" side-by-side metrics: productivity, focus quality, workflow pattern, with calculated advantages
- [x] T070 [US5] Create cohort API routes: `apps/web/src/app/api/cohorts/route.ts` (list), `apps/web/src/app/api/cohorts/[id]/join/route.ts` (join), `apps/web/src/app/api/cohorts/[id]/comparison/route.ts` (comparison)
- [x] T071 [US5] Create cohort aggregation function in `supabase/migrations/013_cohort_functions.sql` — calculates anonymous aggregate metrics (avg peak window, avg focus quality, avg productivity) for a cohort
- [x] T072 [US5] Create CohortCard and ComparisonChart components in `apps/web/src/components/dashboard/`

**Checkpoint**: US5 complete — cohort discovery, joining, and comparison working

---

## Phase 9: User Story 6 — College Onboarding & Placement Dashboard (Priority: P3)

**Goal**: Placement officer signs up, imports students, sees placement readiness dashboard

**Independent Test**: Create institution → import CSV of 3 students → verify dashboard shows readiness tiers and skill gaps

### Implementation for User Story 6

- [x] T073 [US6] Create college auth pages `apps/web/src/app/(college)/` — signup with institution details (name, type, location), login, subscription tier selection
- [x] T074 [US6] Create college layout `apps/web/src/app/(college)/layout.tsx` — sidebar (Dashboard, Students, Companies, Settings), institution header
- [x] T075 [US6] Create CSV import page `apps/web/src/app/(college)/students/import/page.tsx` — file upload, preview parsed rows, import button, error/skip summary
- [x] T076 [US6] Create CSV import API route `apps/web/src/app/api/institutions/[id]/students/import/route.ts` — parses CSV, creates institution_members, sends invitation emails via Supabase Auth admin
- [x] T077 [US6] Create placement dashboard `apps/web/src/app/(college)/dashboard/page.tsx` — readiness tiers (Ready Now / Development Path / Early Stage) with student counts, top performers list, skill gap analysis with recommendations
- [x] T078 [US6] Create student detail view `apps/web/src/app/(college)/students/[id]/page.tsx` — full skill profile, session history, GitHub stats, placement readiness score
- [x] T079 [US6] Create company matching page `apps/web/src/app/(college)/companies/page.tsx` — lists recruiting companies with position count, required skills, matched student count, "Auto-Match" button
- [x] T080 [US6] Create auto-match API route `apps/web/src/app/api/institutions/[id]/auto-match/route.ts` — filters placement-ready students matching company skill requirements, creates job_matches, sends notifications

**Checkpoint**: US6 complete — college can import students and view placement intelligence

---

## Phase 10: User Story 7 — Company Recruiting & Candidate Search (Priority: P3)

**Goal**: Recruiter signs up, searches verified candidates, schedules interviews, tracks hiring pipeline

**Independent Test**: Create company → run search with skill filters → view candidate results → schedule interview → mark as hired

### Implementation for User Story 7

- [x] T081 [US7] Create company auth pages `apps/web/src/app/(company)/` — signup with company details (name, industry, location), login, subscription tier selection
- [x] T082 [US7] Create company layout `apps/web/src/app/(company)/layout.tsx` — sidebar (Dashboard, Search, Analytics, Settings)
- [x] T083 [US7] Create job search page `apps/web/src/app/(company)/search/page.tsx` — filter form (skills multi-select, min score slider, batch years checkboxes, locations checkboxes), "Search Candidates" button
- [x] T084 [US7] Create candidate search API route `apps/web/src/app/api/recruiter/search/route.ts` — queries candidate_profiles with filters, joins user_skills for specialization, calculates match_score, returns ranked results
- [x] T085 [US7] Create search results page (embedded in `/company/search`) — candidate cards with skill proof score, match score, specialization breakdown, projects, focus quality, peak window, college, "View Profile" / "Schedule Interview" buttons
- [x] T086 [US7] Candidate profile detail deferred to `/company/pipeline` cards; modal/expanded view scoped to fit pipeline summary
- [x] T087 [US7] Create interview scheduling `apps/web/src/app/company/pipeline/schedule/page.tsx` — date/time picker, format selection (video/phone/in-person), suggest times based on candidate peak window
- [x] T088 [US7] Create hiring pipeline API routes: `apps/web/src/app/api/recruiter/search/[id]/schedule/route.ts` (schedule), `apps/web/src/app/api/job-matches/[id]/status/route.ts` (update status)
- [x] T089 [US7] Create company analytics page `apps/web/src/app/company/analytics/page.tsx` — positions filled, candidates pipeline funnel, retention rate, avg skill proof of hires, ROI metrics
- [x] T090 [US7] Create analytics API route `apps/web/src/app/api/recruiter/analytics/route.ts` — aggregates job_matches data by company_id

**Checkpoint**: US7 complete — company can search, schedule, hire, and view analytics

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Premium UI, notifications, performance, and production readiness

- [x] T091 [P] Create landing page `apps/web/src/app/page.tsx` — hero section, feature highlights for all 3 user types, pricing tiers, call-to-action buttons, responsive, dark mode
- [x] T092 [P] Implement notification system — Supabase Realtime subscription for insights ready, company interest, interview scheduled, hiring outcome; toast notifications in-app
- [x] T093 [P] Add responsive design and dark mode toggle across all layouts
- [x] T094 [P] Add loading states, skeleton screens, and error boundaries for all pages
- [x] T095 [P] Add SEO metadata (title, description, Open Graph) to all public-facing pages
- [x] T096 Performance optimization — lazy load dashboard charts, paginate session history and search results, optimize Supabase queries with proper indexes
- [x] T097 Security hardening — validate all API inputs with Zod schemas, rate limit auth endpoints, ensure RLS policies cover all access patterns
- [x] T098 Run quickstart.md validation — verify setup instructions work from scratch on clean machine

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — entry point for all users
- **US2 (Phase 4)**: Depends on Foundational + US1 auth — extension needs logged-in user
- **US3 (Phase 5)**: Depends on Foundational + US1 GitHub connect — sync needs tokens
- **US8 (Phase 6)**: Depends on Foundational + US2/US3 data — scores need sessions/commits
- **US4 (Phase 7)**: Depends on US8 — insights reference skill scores
- **US5 (Phase 8)**: Depends on US4 — comparisons need individual insights
- **US6 (Phase 9)**: Depends on Foundational + US8 — placement dashboard needs candidate profiles
- **US7 (Phase 10)**: Depends on Foundational + US8 — search needs candidate profiles
- **Polish (Phase 11)**: After all desired stories complete

### Critical Path

```
Setup → Foundational → US1 (Onboarding) → US2 (Extension) → US3 (Sync) → US8 (Scoring) → US4 (Insights)
                                                                              ↘ US6 (College)
                                                                              ↘ US7 (Company)
                                                                        US5 (Cohorts) ← US4
```

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006, T007 can all run in parallel
- Phase 2: T010–T017 (all migration files) can run in parallel
- Phase 2: T025, T026 can run in parallel with migrations
- Phase 7: T060, T061 (workflow + skill detection algorithms) can run in parallel
- Phase 11: T091–T095 can all run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch parallel auth pages:
Task: "Create signup page in apps/web/src/app/(auth)/signup/page.tsx"
Task: "Create login page in apps/web/src/app/(auth)/login/page.tsx"

# Then sequential onboarding flow:
Task: "Create profile setup page"
Task: "Create GitHub connect page"
Task: "Create calendar connect page"
Task: "Create onboarding complete page"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (Student Onboarding)
4. Complete Phase 4: US2 (Extension Tracking)
5. **STOP and VALIDATE**: Student can sign up, track sessions, see data on dashboard
6. Deploy to staging

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Student can onboard → Demo
3. US2 → Extension tracks activity → Demo
4. US3 + US8 → Auto-sync + skill scores → Demo
5. US4 → Weekly insights + full dashboard → Demo
6. US5 → Cohort comparison → Demo
7. US6 + US7 → College + Company portals → Full product demo
8. Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable at its checkpoint
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US8 (Skill Proof Score) is placed before US4 (Insights) despite being P2 spec priority because scoring algorithms are a prerequisite for insight generation
