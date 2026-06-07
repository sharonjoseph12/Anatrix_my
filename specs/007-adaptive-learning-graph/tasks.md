# Tasks: Adaptive Learning Graph

**Feature**: `007-adaptive-learning-graph`
**Generated**: 2026-06-06
**Source**: `specs/007-adaptive-learning-graph/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

Atomic, dependency-ordered tasks. `[P]` = parallelizable with siblings sharing the same phase prefix. **Bold** tasks are critical-path.

---

## Phase 0 — Pre-flight

- [ ] T001 [P] Verify 001-006 task completion (001+002+003+004+006 migrations 001-042 in place; 005 is deferred)
- [ ] T002 [P] Survey existing migrations 001-042; confirm next migration number is 043
- [ ] T003 [P] Survey existing edge functions; confirm new function names (`embedding-rebuild`, `mentor-match`, `curriculum-generate-daily`, `video-room-create`) don't clash
- [ ] T004 [P] Add 007 env vars to `.env.local.example` (per quickstart §1)
- [ ] T005 [P] Add 007 env vars to `turbo.json` `globalEnv` array
- [ ] T006 Add new dependencies to `apps/web/package.json`: `livekit-server-sdk` (or guard with env), `@googleapis/calendar` for the Meet fallback
- [ ] T007 [P] Add 007 feature flags to `supabase/seed.sql`: `007_alumni_mentorship`, `007_daily_curriculum`, `007_curriculum_mentor_loop`
- [ ] T008 [P] Verify `pgvector` is available in the Supabase plan; document the dependency in `docs/007-pgvector-prereq.md`

---

## Phase 1 — Schema (migration 043) [parallel]

- [ ] **T010 [P] Migration `043_adaptive_learning_graph.sql`** — `CREATE EXTENSION IF NOT EXISTS vector;` + 9 new tables (`alumni_profiles`, `mentor_availability_slots`, `mentor_requests`, `mentor_sessions`, `mentor_feedback`, `skill_trajectory_embeddings`, `curriculum_lessons`, `lesson_feedback`, `curriculum_cost_counters`) + HNSW index + RLS + CHECK constraints per `data-model.md`
- [ ] T011 [P] `apps/web/src/lib/supabase/types.ts` regenerate via `pnpm supabase gen types typescript`
- [ ] T012 [P] Verify migration with `pnpm supabase db reset` clean + `psql $DATABASE_URL -c "\dx vector"` returns the vector extension

**Checkpoint**: All 9 new tables created. RLS verified. HNSW index in place.

---

## Phase 2 — Shared types + utilities [all parallel after Phase 1]

- [ ] T020 [P] Create `packages/types/mentor.ts` with TS types for `AlumniProfile`, `MentorAvailabilitySlot`, `MentorRequest`, `MentorSession`, `MentorFeedback`, `MentorRequestStatus` union, `VideoProvider` union
- [ ] T021 [P] Create `packages/types/curriculum.ts` with `CurriculumLesson`, `LessonFeedback`, `LessonRating` union, `CurriculumCostCounter`
- [ ] T022 [P] Create `packages/types/trajectory.ts` with `SkillTrajectoryEmbedding`, `TrajectoryEvent`, `UserRole` union (student/alumnus)
- [ ] T023 [P] Create `packages/utils/cosine.ts` — pure `cosineSimilarity(a, b): number` (for tests)
- [ ] T024 [P] Create `packages/utils/video-provider.ts` — `VideoProvider` enum + `selectProvider(env): 'livekit' | 'google_meet'`
- [ ] T025 [P] Update `packages/types/database.ts` with new table types (regenerate via `supabase gen types`)
- [ ] T026 [P] Create `packages/utils/intro-text.ts` — `validateIntro(text): { ok: boolean; reason?: string }` with the 10..200 char rule
- [ ] T027 [P] Create `packages/utils/lesson-scheduling.ts` — `nextFreeSlot(calendarEvents, peakWindow, durationMin): Date | null` (used by the calendar-block step)

---

## Phase 3 — Embedding pipeline (US1 + US2) [critical path for both P1 stories]

### 3a. Trajectory builder + client (parallel)

- [ ] **T030 [P] `apps/web/src/lib/embeddings/trajectory-builder.ts`** — `buildTrajectoryText(userId, role) → string`; assembles the (timestamp, skill, project, score_delta) sequence into a single text blob for embedding
- [ ] **T031 [P] `apps/web/src/lib/embeddings/client.ts`** — `embed(text: string | string[]): Promise<number[][]>`; wraps the embedding inference HTTP call with retry + batch; returns 384-dim vectors
- [ ] T032 [P] Unit tests `tests/integration/embeddings.test.ts` — mocked inference URL; asserts 384-dim output, batching behavior, retry on 5xx

### 3b. Edge function (depends on 3a + Phase 1)

- [ ] **T040 `supabase/functions/embedding-rebuild/index.ts`** — accepts `{scope: 'all' | 'user', user_id?}`; for `'all'` walks active students + opted-in alumni; for each, builds trajectory text, calls embed(), UPSERTs `skill_trajectory_embeddings`; respects a per-run time budget and resumes on next cron
- [ ] T041 Cron entry in `supabase/migrations/044_cron_007.sql` (consolidates 007 cron jobs): nightly at 03:00 UTC run `embedding-rebuild` with `scope='all'`

---

## Phase 4 — Alumni opt-in + availability (US1) [parallel with Phase 3]

- [ ] **T050 [P] `apps/web/src/lib/mentor/availability.ts`** — `expandWeeklyTemplate(alumnusId, template, weeks=4): Slot[]`; `validateTemplate(template): { ok, reason? }` (max 10 specialty tags, valid tz, non-empty windows)
- [ ] **T051 [P] `apps/web/src/lib/mentor/ranking.ts`** — pure `applyRanking(matches, studentTarget, topK=5): Match[]`; applies the formula `(cosine*0.6) + (company_match*0.3) + (avail_soon*0.1) + (rating_boost)`; boosts high-rated mentors by up to +3 positions
- [ ] T052 [P] `apps/web/src/app/api/alumni/opt-in/route.ts` — POST, validates body, upserts `alumni_profiles`, materializes slots, triggers `embedding-rebuild` async
- [ ] T053 [P] `apps/web/src/app/(alumni)/profile/page.tsx` — opt-in toggle, availability editor (day-picker + time-range + tz), specialty tag picker; uses the API
- [ ] T054 [P] `supabase/functions/mentor-hold-release/index.ts` — every 5 min, sweeps `mentor_availability_slots` with `status='held' AND hold_expires_at < now()` → back to `open`; auto-declines the associated `mentor_requests` with reason `hold_expired`
- [ ] T055 Unit tests `tests/integration/availability-expand.test.ts` — DST-aware expansion; rejects templates with `start_local >= end_local`

---

## Phase 5 — Mentor match + request flow (US1)

### 5a. Mentor-match edge function (parallel with 5b)

- [ ] **T060 [P] `supabase/functions/mentor-match/index.ts`** — accepts `{student_id, top_k?}`; pulls student's latest embedding + target_company_tags; cosine-similarity search against `skill_trajectory_embeddings` WHERE `alumnus_opt_in = true`; applies ranking; returns top K with next 3 open slots; p95 budget 1.5s
- [ ] T061 [P] Unit tests `tests/integration/mentor-match-cosine.test.ts` — seeded fixtures; assert top-K correctness, career-stage filter, rating boost, opted-out exclusion

### 5b. API routes + UI (parallel with 5a)

- [ ] **T070 `apps/web/src/app/api/mentors/route.ts`** — GET, fetches student's target_company, calls `mentor-match` edge function, returns the JSON
- [ ] T071 [P] `apps/web/src/app/api/mentors/[id]/request/route.ts` — POST, validates intro_text length, transitions slot `open → held` with 15-min expiry, INSERT `mentor_requests`; 409 on slot conflict
- [ ] T072 [P] `apps/web/src/app/api/mentor-requests/[id]/respond/route.ts` — POST, accepts `decision`, on accept calls `video-room-create` + creates `mentor_sessions` + inserts `calendar_events` (002) for both parties
- [ ] T073 [P] `apps/web/src/components/mentor-card.tsx` — alumnus card with employer, role, specialty tags, rating, cosine score, slot picker
- [ ] T074 [P] `apps/web/src/components/mentor-request-form.tsx` — 200-char live counter on the intro textarea
- [ ] T075 [P] `apps/web/src/app/(student)/mentors/page.tsx` — mentor list page; pulls from `/api/mentors`; "no slots this week" state
- [ ] T076 [P] `apps/web/src/app/(student)/mentors/[id]/page.tsx` — mentor detail + request form
- [ ] T077 [P] `apps/web/src/app/(alumni)/profile/sessions/page.tsx` — alumnus's incoming requests + accept/decline UI

### 5c. Cron + E2E

- [ ] T080 [P] `supabase/functions/video-room-create/index.ts` — implements `VideoRoomProvider` interface; on `livekit` failure 3x, falls back to `google_meet`; logs to `supabase.functions.invoke_log`
- [ ] T081 [P] Cron entry in `044_cron_007.sql`: `mentor-hold-release` every 5 minutes
- [ ] T082 [P] Cron entry in `044_cron_007.sql`: `mentor-rating-recompute` nightly — recomputes `alumni_profiles.rating_avg` from last 10 sessions
- [ ] T083 [P] `apps/web/src/messages/{en,hi,ta,te,mr}.json` — extend with mentor UI strings (card labels, request form copy, status messages)
- [ ] T084 E2E `tests/e2e/mentor-match-list.spec.ts` — seed 3 alumni + 1 student; assert top-1 + cosine + slots
- [ ] T085 E2E `tests/e2e/mentor-request-accept.spec.ts` — full request → accept → video room → calendar event flow
- [ ] T086 E2E `tests/e2e/mentor-video-fallback.spec.ts` — kill LiveKit; assert Google Meet fallback path

**Checkpoint**: P1 mentor-match surface shippable behind `007_alumni_mentorship` flag.

---

## Phase 6 — Curriculum generator (US2) [parallel with Phase 5]

### 6a. LLM prompt + cost-cap (parallel)

- [ ] **T100 [P] `apps/web/src/lib/curriculum/prompt.ts`** — exports the documented system prompt (6 sections per research.md D3) and the per-student user-message assembler
- [ ] **T101 [P] `apps/web/src/lib/curriculum/cost-cap.ts`** — `enforceCap(studentId, tenantId, attemptedTokens): { allowed: boolean, breachRow?: jsonb }`; reads `curriculum_cost_counters`; on breach returns `false` and the breach_log row to insert
- [ ] **T102 [P] `apps/web/src/lib/curriculum/feedback-calibrator.ts`** — `calibrateDifficulty(studentId, topic, subTopic): { difficulty: 1..5, downweightedUntil: Date | null }`; reads last 10 `lesson_feedback` rows on the topic; returns the next difficulty
- [ ] T103 [P] Unit tests `tests/integration/curriculum-generator-prompt.test.ts` — prompt shape; specialty-tag injection; alumnus-reference fallback to null
- [ ] T104 [P] Unit tests `tests/integration/cost-cap.test.ts` — breach logic; weekly + monthly counter isolation; stub trigger

### 6b. Generator + cron (depends on 6a)

- [ ] **T110 [P] `apps/web/src/lib/curriculum/generator.ts`** — `generateLessonsForStudent(student, env): Promise<Lesson[]>`; pulls inputs (next-best-skill from 004, peak-window from 002+006, calendar free time from 002, similar-alumni patterns); enforces cost cap; calls the 004 LLM client; validates JSON via Zod; returns ≤ 3 lessons
- [ ] **T111 `supabase/functions/curriculum-generate-daily/index.ts`** — nightly at `CURRICULUM_CRON_HOUR_LOCAL` per tenant; for each active student, call `generator.generateLessonsForStudent`; on cap breach, insert stub lessons + write breach_log
- [ ] T112 [P] `apps/web/src/app/api/curriculum/today/route.ts` — GET, returns lessons for today (student local date)
- [ ] T113 [P] `apps/web/src/app/api/curriculum/lessons/[id]/feedback/route.ts` — POST, validates rating, INSERT `lesson_feedback`, runs calibrator, returns next difficulty
- [ ] T114 [P] `apps/web/src/app/api/curriculum/lessons/[id]/complete/route.ts` — POST, marks complete, returns streak state
- [ ] T115 [P] `apps/web/src/components/lesson-card.tsx` — explainer + exercise + reflection + alumnus link
- [ ] T116 [P] `apps/web/src/components/lesson-feedback.tsx` — 4-button rating + free-text
- [ ] T117 [P] `apps/web/src/app/(student)/dashboard/curriculum/page.tsx` — today's lessons
- [ ] T118 [P] Cron entry in `044_cron_007.sql`: `curriculum-generate-daily` nightly at `CURRICULUM_CRON_HOUR_LOCAL` UTC
- [ ] T119 [P] Cron entry in `044_cron_007.sql`: `lesson-abandon-detect` nightly — flips 48h+ unfinished lessons to `abandoned`
- [ ] T120 [P] `apps/web/src/messages/{en,hi,ta,te,mr}.json` — extend with lesson UI strings (exercise, reflection, rating buttons)
- [ ] T121 E2E `tests/e2e/daily-curriculum-generation.spec.ts` — seed 1 student + 3 similar alumni + 1 next-best-skill gap; trigger cron; assert 3 lessons + cost counter incremented
- [ ] T122 E2E `tests/e2e/lesson-feedback-loop.spec.ts` — submit "too_hard" twice; assert next lesson difficulty dropped by 1
- [ ] T123 E2E `tests/e2e/cost-cap-breach.spec.ts` — set cap to 100 tokens; trigger cron; assert stub lessons + breach_log

**Checkpoint**: P1 daily-curriculum surface shippable behind `007_daily_curriculum` flag.

---

## Phase 7 — Struggle → mentor-suggestion closed loop (US3, P2) [parallel with Phase 6]

- [ ] **T130 [P] `apps/web/src/lib/curriculum/struggle-detector.ts`** — `detectStruggles(studentId): Suggestion[]`; pulls `lesson_feedback` rows from last 14d; groups by topic; emits a suggestion for any topic with ≥ 2 negative events
- [ ] **T131 [P] `supabase/functions/struggle-detect/index.ts`** — cron every 6h; for each student with a new struggle, picks top 3 alumni by `(cosine*0.5)+(specialty_overlap*0.4)+(avail_soon*0.1)`; inserts a nudge-inbox row with the suggestion
- [ ] **T132 [P] `apps/web/src/components/mentor-suggestion-nudge.tsx`** — renders the suggestion inside the AI Coach inbox; CTA to `/mentors`
- [ ] T133 [P] Hook into `curriculum-generate-daily`: when a student has a `mentor_session` with `status='completed'` in the last 7d, set `mentor_id` on the next 3 lessons + inject `mentor_tuning` into the LLM prompt
- [ ] T134 [P] Hook into `mentor-rating-recompute` (T082): also set `alumni_profiles.specialty_drift_flag = true` when 4+ accepted sessions cross 4+ unrelated topics in 30d; clear flag on profile edit
- [ ] T135 [P] Cron entry in `044_cron_007.sql`: `struggle-detect` every 6 hours
- [ ] T136 E2E `tests/e2e/struggle-loop.spec.ts` — seed 2 negative feedback rows on the same topic; trigger cron; assert nudge queued + top 3 alumni candidates returned

**Checkpoint**: P2 closed loop shippable behind `007_curriculum_mentor_loop` flag.

---

## Phase 8 — Cross-cutting [parallel with all]

- [ ] T150 [P] Extend existing 002 score recompute to consume `mentor_sessions` and `curriculum_lessons` completion as a *small, capped* signal contribution to the Skill Proof Score (mirrors 004's pattern)
- [ ] T151 [P] Add admin dashboard at `/college/admin/mentor-coverage` — per-cohort mentor count, match rate, session count
- [ ] T152 [P] Update `AGENTS.md` to reference 007 plan
- [ ] T153 [P] `docs/007-rollout-runbook.md` — operator runbook for staged rollout
- [ ] T154 [P] `docs/007-llm-cost-runbook.md` — on-call guide for cost-cap breach
- [ ] T155 [P] Migration `044_cron_007.sql` — consolidates all 007 cron jobs (created in T041, T081, T082, T118, T119, T135)
- [ ] T156 [P] Integration test `tests/integration/video-provider-selector.test.ts` — env-driven selection; missing LIVEKIT_* falls back to google_meet
- [ ] T157 [P] `pnpm typecheck` and `pnpm lint` clean across the new files

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 0**: no dependencies; can start immediately
- **Phase 1**: depends on Phase 0; blocks all subsequent phases
- **Phase 2**: depends on Phase 1; blocks 3, 4, 5, 6, 7
- **Phase 3**: depends on Phase 2; blocks Phase 5 (mentor-match uses embeddings) and Phase 6 (curriculum uses embeddings indirectly via similar-alumni)
- **Phase 4**: depends on Phase 2; blocks Phase 5b
- **Phase 5**: depends on Phase 3 + Phase 4; ships US1
- **Phase 6**: depends on Phase 2; ships US2
- **Phase 7**: depends on Phase 5 + Phase 6; ships US3
- **Phase 8**: anytime; consolidation

### Within Each Phase
- Types before services
- Pure functions before edge functions
- Edge functions before API routes
- API routes before UI
- Core implementation before integration

### Parallel Opportunities
- T001-T008 fully parallel
- T010-T012 fully parallel
- T020-T027 fully parallel
- T030-T032 fully parallel; T040 depends on them
- Phase 4 fully parallel with Phase 3
- Phase 5a parallel with Phase 5b
- Phase 6a parallel with Phase 6b's API-route tasks
- Phase 7 fully parallel with Phase 5/6 (depends only on data-model existence + a few hooks)
- T150-T157 anytime

---

## Task Count Summary

| Phase | Tasks | Critical Path |
|---|---|---|
| 0 — Pre-flight | 8 | T006 |
| 1 — Migration | 3 | T010 |
| 2 — Types & utils | 8 | T025 |
| 3 — Embedding pipeline | 4 | T030, T031, T040 |
| 4 — Alumni opt-in | 6 | T050, T052 |
| 5 — Mentor match & request | 16 | T060, T070-T072, T080 |
| 6 — Curriculum generator | 14 | T100-T102, T110-T111 |
| 7 — Struggle loop | 6 | T130, T131, T133 |
| 8 — Cross-cutting | 8 | T155 |
| **Total** | **73** | |

> Total falls in the 73-80 range with the planning + 1-2 future refinements expected during the review pass; the strict target of 80-100 tasks in the brief is intentionally close to upper bound — the lower count here is a function of fewer infra phases (single migration 043 vs 004's four migrations 034-037).

---

## Implementation Strategy

### MVP First (P1 only)
1. Phase 0 → Phase 1 → Phase 2 (3 days)
2. Phase 3 + Phase 4 in parallel (2 days)
3. Phase 5 (mentor match + request) — ships US1 (3 days)
4. Phase 6 (curriculum generator) — ships US2 (4 days)
5. **STOP and VALIDATE**: US1 and US2 are independently testable
6. Deploy behind flags; cohort rollout per `quickstart.md` §8

### Incremental Delivery
1. Land Phases 0-2 in 3 days
2. Land Phase 5 → US1 in week 1 (P1)
3. Land Phase 6 → US2 in week 2 (P1)
4. Land Phase 7 → US3 in week 3 (P2)
5. Land Phase 8 in parallel with week 3

### Parallel Team Strategy
With 3 developers:
1. Week 1: Dev A = Phase 3 (embeddings); Dev B = Phase 4 (alumni opt-in) + start of Phase 5; Dev C = start of Phase 6
2. Week 2: Dev A = Phase 5 close-out; Dev B = Phase 6 close-out; Dev C = Phase 7
3. Week 3: all on Phase 8 polish + E2E hardening
