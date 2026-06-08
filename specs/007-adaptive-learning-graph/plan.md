# Implementation Plan: 007 — Adaptive Learning Graph

**Branch**: `007-adaptive-learning-graph` | **Date**: 2026-06-07 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/007-adaptive-learning-graph/spec.md)
**Input**: Feature specification from `specs/007-adaptive-learning-graph/spec.md`
**Builds on**: 001 (foundation) + 002 (verified skill platform, calendar_events, pgvector) + 003 (engage & showcase, nudge inbox) + 004 (anti-cheat, next-best-skill, configurable LLM provider, weekly/monthly cost-cap pattern) + 005 (gamification — streak data) + 006 (deep-signal-capture — peak-window enrichment) + 008 (collaborative mode — `VideoRoomProvider` abstraction; **hard prerequisite for US1 mentor match**)
**Migration**: `045_adaptive_learning_graph.sql` (single additive migration; 9 new tables)

## Summary

Three P1/P2 product moves on top of 001-006: (US1, P1) alumni mentorship match via trajectory embeddings + cosine similarity, with 1:1 video calls; (US2, P1) daily adaptive micro-curriculum, 3 lessons/day per active student, tuned to next-best-skill, peak window, similar-alumni progression, and calendar free time; (US3, P2) curriculum-mentor closed loop where 2+ lesson struggles auto-suggest a mentor and accepted sessions re-weight the next 3 lessons. All three are gated by feature flags, all share the 004 LLM client + cost-cap pattern, and all reuse 002's `calendar_events` and 003's nudge dispatcher.

**Technical approach**: Reuse the entire 001-006 stack. Add one additive SQL migration (`045_adaptive_learning_graph.sql`) creating 9 new tables, enable `pgvector` if not already on, and create an HNSW index on the embedding column. Add 4 new edge functions (`embedding-job`, `curriculum-generator`, `curriculum-struggle-detector`, `mentor-match-batch` for backfill), 6 new Next.js API routes, 4 new UI pages, and shared types under `packages/types/`. All new surfaces behind feature flags.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+ *(inherited from 001-006)*
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, next-intl, handlebars, web-push, discord-verify, pgvector, sentence-transformers (already running in 002 embedding service)
**Primary Dependencies (new)**: None — every dependency is already in the stack. The `VideoRoomProvider` from 008 is the only new module surface; it is **not** implemented in 007, only consumed.
**Storage**: PostgreSQL (via Supabase) + pgvector — 9 new tables in 1 additive migration (`040`); no destructive changes. New `vector(384)` column type, new HNSW index.
**Testing**: Vitest (unit) + Playwright (e2e) + Supabase CLI integration *(inherited)*
**Target Platform**: Web (Next.js 15 App Router multi-portal), Supabase Edge Functions (Deno), external video room providers via 008 *(inherited)*
**Project Type**: Web service (multi-portal SaaS) + Edge Functions *(inherited)*
**Performance Goals (inherited)**: Dashboard p95 < 2s, search p95 < 5s
**Performance Goals (new)**:
- Mentor match query p95 ≤ 1.5s at 50K student scale (HNSW-cosine over `skill_trajectory_embeddings`)
- Embedding rebuild (full pass) p95 ≤ 6h for 50K users
- Daily curriculum cron completion ≤ 2h wall-clock for full active cohort
- Video room create p95 ≤ 3s (delegated to 008)
- LLM lesson generation p95 ≤ 8s per lesson (3 lessons per student per day, batched)
- HNSW index size ≤ 200 MB at 50K × 384-dim × 4 bytes raw + ~2× overhead
**Constraints (inherited)**: India market, opt-in privacy, RLS-enforced, no destructive migrations
**Constraints (new)**:
- 008 MUST be merged before 007's first cohort rollout; otherwise mentor match returns HTTP 503 (FR-MATCH-008)
- LLM cost cap: `LESSON_WEEKLY_TOKEN_CAP=30000` per student per week, `LESSON_MONTHLY_TENANT_TOKEN_CAP=3000000` per tenant per month (inherited 004 pattern)
- HNSW parameters: `m=16, ef_construction=64, ef_search=40` (research.md D2)
- Embedding model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim); if a new model is chosen, dimension must stay 384
- Mentor session privacy: 200-char intro cap, opt-out propagation ≤ 60s, embeddings dropped on account deletion
- Video room provider: `MENTOR_VIDEO_PROVIDER=livekit|meet`; default `livekit`; `meet` is 008-delayed fallback
**Scale/Scope (inherited)**: 50K students Y2
**Scale/Scope (new)**: 50K student ceiling; mentor match handles ~500 QPS at peak (3 cohort windows); embedding rebuild runs weekly off-peak; curriculum cron runs 06:00 local per student (split into timezone-bucketed waves)

## Dependency Map

| Feature | What 007 depends on | Notes |
|---|---|---|
| 001 (foundation) | `users`, `institutions`, Supabase auth, RLS, audit table | Inherited; no changes |
| 002 (verified skill platform) | `users.last_active_at`, `users.locale`, `calendar_events`, Google Calendar OAuth, pgvector, embedding service | Reuse `calendar_events` directly (FR-CC-006); reuse embedding service infrastructure |
| 003 (engage & showcase) | `nudges` table, nudge dispatcher, `feature_flags` table | Reuse nudge dispatcher for both curriculum and mentor requests (assumption 4) |
| 004 (11/10) | `next_best_skill` (FR-NBS-*), configurable LLM provider, weekly/monthly cost-cap pattern, `users.locale` | Reuse exactly: lesson generation consumes `next_best_skill`; cost-cap fn copied from 004 pattern |
| 005 (gamification) | streak data for `feedback_kind` aggregation | Read-only; no schema changes |
| 006 (deep-signal-capture) | `peak_window_start_local_hour`, `peak_window_end_local_hour` on `candidate_profiles` (from 002), telemetry enrichment | Read-only; no schema changes |
| 008 (collaborative mode) | `VideoRoomProvider` interface (`createRoom`, `getJoinUrl`, `cancelRoom`) | **Hard prerequisite for US1.** If 008 is not merged, FR-MATCH-008 returns HTTP 503 |

## Constitution Check

The project constitution (`.specify/memory/constitution.md`) remains the unmodified template — no custom principles ratified. This plan respects the *implicit* principles followed by 001-006:
- **Additive-only schema** (1 new migration, no DROP/ALTER on existing critical columns; `pgvector` enable is additive)
- **Privacy-first** (200-char intro cap enforced both client and server; opted-out alumni excluded from match within 60s; embeddings dropped immediately on account deletion; RLS-enforced on every new table)
- **Cost-aware** (LLM caps inherited from 004; per-lesson parse-failure fallback prevents token waste; struggle no-match log prevents wasted suggestion dispatches)
- **Observability** (every external dispatch — mentor request, video room create, lesson generation, struggle detection — logs to a feature-scoped audit row + `supabase.functions.invoke_log`)
- **Backward compatibility** (existing 001-006 functionality unchanged; 007 surfaces are opt-in via flags; 008 prerequisite is documented and fails closed)
- **Reuse over rebuild** (no new LLM provider abstraction, no new calendar schema, no new dispatch channel, no new embedding service — all reused)

**No violation blocks Phase 0 / Phase 1 of this plan.** Recommended: run `/speckit-constitution` before code, but not blocking. **One open risk**: 008 must be merged before US1 ships; this is captured in plan.md §"Rollout" and in tasks.md Phase 9.

## Project Structure

### Documentation (this feature)

```text
specs/007-adaptive-learning-graph/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 new decisions
├── data-model.md        # Phase 1 output — 9 new entities, 1 migration (040)
├── quickstart.md        # Phase 1 output — env vars, pgvector setup, embedding seeding
├── contracts/
│   └── api.md           # Phase 1 output — 6 internal API routes
├── checklists/
│   └── requirements.md  # From spec phase (12-item quality checklist)
└── tasks.md             # Phase 2 output — ~85 atomic tasks
```

### Source Code (repository root)

Inherits 001-006 layout unchanged. New files:

```text
supabase/
├── migrations/
│   └── 045_adaptive_learning_graph.sql    # alumni_profiles, mentor_availability_slots,
│                                          # mentor_requests, mentor_sessions, mentor_feedback,
│                                          # skill_trajectory_embeddings, curriculum_lessons,
│                                          # lesson_feedback, curriculum_cost_counters,
│                                          # mentor_suggestions + pgvector enable + HNSW index
└── functions/
    ├── embedding-job/                     # NEW — weekly: rebuild trajectory embeddings
    ├── curriculum-generator/              # NEW — daily 06:00 cron: 3 lessons/student
    ├── curriculum-struggle-detector/      # NEW — daily: detect 2+ struggle patterns
    └── mentor-match-batch/                # NEW — one-off: backfill matching for cohort

apps/web/src/
├── app/
│   ├── api/
│   │   ├── mentors/
│   │   │   └── route.ts                                  # NEW — GET /api/mentors
│   │   ├── mentors/[id]/
│   │   │   └── request/route.ts                          # NEW — POST request
│   │   ├── mentor-requests/[id]/
│   │   │   └── respond/route.ts                          # NEW — POST accept/decline
│   │   ├── mentor-sessions/[id]/
│   │   │   └── feedback/route.ts                         # NEW — POST feedback
│   │   ├── curriculum/
│   │   │   ├── today/route.ts                            # NEW — GET today's lessons
│   │   │   └── lessons/[id]/
│   │   │       ├── feedback/route.ts                     # NEW — POST feedback
│   │   │       ├── complete/route.ts                    # NEW — POST complete
│   │   │       └── insert-into-calendar/route.ts        # NEW — POST calendar insert
│   │   └── alumni/availability/route.ts                  # NEW — POST/GET/DELETE slots
│   ├── (student)/
│   │   ├── dashboard/
│   │   │   ├── mentors/page.tsx                          # NEW — mentor match + request
│   │   │   └── curriculum/page.tsx                       # NEW — today's 3 lessons
│   │   └── settings/
│   │       └── mentorship/page.tsx                       # NEW — opt-in/opt-out toggle
│   ├── (alumni)/
│   │   └── alumni/
│   │       ├── availability/page.tsx                     # NEW — declare availability slots
│   │       └── requests/page.tsx                         # NEW — incoming request queue
│   └── (company)/...                                     # unchanged
├── lib/
│   ├── mentor/
│   │   ├── trajectory-embedder.ts                        # NEW — pure fn: events → text → 384-dim
│   │   ├── mentor-matcher.ts                             # NEW — pure fn: weighted cosine + boosts
│   │   ├── availability-resolver.ts                      # NEW — pure fn: slots → "within 7d" boolean
│   │   └── video-room-dispatcher.ts                      # NEW — thin wrapper over 008 VideoRoomProvider
│   ├── curriculum/
│   │   ├── lesson-prompt.ts                              # NEW — pure fn: inputs → LLM prompt
│   │   ├── lesson-parser.ts                              # NEW — pure fn: LLM output → structured lesson
│   │   ├── recommender.ts                                # NEW — pure fn: feedback + patterns → weights
│   │   └── struggle-detector.ts                          # NEW — pure fn: feedback → suggestions
│   ├── algorithms/
│   │   └── trajectory-similarity.ts                      # NEW — pure fn: pgvector cosine query helper
│   └── cost/
│       └── lesson-cost-cap.ts                            # NEW — 004-pattern cost gate
├── components/
│   ├── mentor-card.tsx                                   # NEW
│   ├── lesson-card.tsx                                   # NEW
│   ├── intro-textarea-counter.tsx                        # NEW — 200-char UI counter
│   └── curriculum-feedback-buttons.tsx                   # NEW — too_easy/too_hard/irrelevant
├── messages/                                             # next-intl catalogs
│   ├── en.json                                           # extend with mentor + curriculum keys
│   ├── hi.json                                           # extend
│   ├── ta.json                                           # extend
│   ├── te.json                                           # extend
│   └── mr.json                                           # extend

apps/web/public/                                          # unchanged

packages/
├── types/
│   ├── alumni.ts                                         # NEW
│   ├── mentor.ts                                         # NEW — request, session, feedback types
│   ├── curriculum.ts                                     # NEW — lesson, feedback, recommender debug
│   ├── trajectory.ts                                     # NEW — embedding + similarity types
│   ├── video-room.ts                                     # NEW — VideoRoomProvider interface (re-exported from 008)
│   └── database.ts                                       # UPDATE — add 040 table types
└── utils/
    ├── intro-length.ts                                   # NEW — 200-char cap helper
    └── lesson-cap.ts                                     # NEW — 004-pattern cap helpers

tests/
├── e2e/
│   ├── mentor-match-top5.spec.ts                         # NEW
│   ├── mentor-request-flow.spec.ts                       # NEW
│   ├── mentor-video-fallback.spec.ts                     # NEW — LiveKit 3x fail → Meet
│   ├── curriculum-today-3lessons.spec.ts                 # NEW
│   ├── curriculum-feedback-loop.spec.ts                  # NEW
│   ├── curriculum-cost-cap.spec.ts                       # NEW
│   ├── struggle-mentor-suggestion.spec.ts                # NEW
│   └── account-deletion-embeddings.spec.ts               # NEW
└── integration/
    ├── trajectory-similarity.test.ts                     # NEW
    ├── mentor-matcher.test.ts                            # NEW
    ├── lesson-prompt.test.ts                             # NEW
    ├── lesson-parser.test.ts                             # NEW
    ├── recommender.test.ts                               # NEW
    ├── struggle-detector.test.ts                         # NEW
    └── lesson-cost-cap.test.ts                           # NEW
```

**Structure Decision**: Pure additive. No new top-level packages, no monorepo split, no new build pipelines, no new LLM provider abstraction. Every new capability is one or more of: a Supabase Edge Function (cron or HTTP), a Next.js API route (Supabase-auth-gated, RLS-enforced), a UI page rendered inside the existing 3-portal app, or a Postgres table in migration 040.

## Complexity Tracking

No constitution violations to justify. The biggest single net-new risk is the **008 prerequisite for US1 mentor match** — mitigated with FR-MATCH-008 (return HTTP 503 with `code='video_provider_unavailable'` until 008 ships) and a documented rollout gate in §"Rollout" below.

Three explicit deferrals (group sessions, reflection grading, multi-language lessons) are documented in spec.md "Out of Scope" with the rationale.

Two additional soft risks, each with a mitigation:
- **Embedding dimension drift** — If the team later wants to swap `all-MiniLM-L6-v2` for a 768-dim or 1024-dim model, the HNSW index must be rebuilt AND every cosine query must be updated. The plan pins 384-dim in `data-model.md` and `research.md` D2 to make the cost of swap explicit (would require a new migration + index rebuild).
- **LLM cost-cap blowup** — A bad prompt that retries infinitely on parse failure could burn tokens. Mitigated with FR-CURR-004 (gate at the LLM call) + FR-CURR-009 (max-2 retries on parse failure, then hand-curated fallback).

## Re-Evaluation of Constitution Check (post-design)

Still no violations. Plan respects:
- **Additive-only schema** (1 new migration, no DROP/ALTER on existing critical columns; `pgvector` enable is additive)
- **Privacy-first** (200-char intro cap; opted-out exclusion ≤ 60s; embeddings dropped immediately; RLS on every table; mentor intros visible only to the chosen alumnus; feedback submission gated by session membership)
- **Cost-aware** (LLM caps inherited from 004; struggle no-match log prevents wasted suggestions; LLM parse-failure fallback prevents token waste; account deletion drops embeddings immediately)
- **Observability** (every external dispatch logged; cost-cap breach log; LLM parse-failure log; struggle no-match log; recommender debug JSON on every lesson; video-room create/dispatch logged)
- **Backward compatibility** (existing 001-006 functionality unchanged; 007 surfaces are opt-in via flags; 008 prerequisite is documented and fails closed; pgvector enable is idempotent)
- **Reuse over rebuild** (no new LLM provider, no new calendar schema, no new dispatch channel, no new embedding service — all reused from 002/003/004/008)

## Rollout

1. **Pre-flight (Phase 0)**: confirm 008 is merged or has a hard ship date; confirm 002 `next_best_skill` is GA; confirm pgvector is enabled in the 002 schema.
2. **Phase 1 (migration 040 + types)**: ship migration with `pgvector` enable (idempotent) + 9 tables + HNSW index. Generate TS types.
3. **Phase 2 (embedding job + types)**: build `embedding-job` for a small cohort (10 students, 5 alumni) to validate the 384-dim embedding + cosine pipeline.
4. **Phase 3 (mentor match)**: ship `mentor-match` + `mentor-availability` behind `007_alumni_mentorship` flag. Roll out to a 100-student cohort.
5. **Phase 4 (curriculum generator)**: ship `curriculum-generator` behind `007_daily_curriculum` flag. Roll out to a 100-student cohort with cost caps at 50% of full budget.
6. **Phase 5 (struggle detector)**: ship `curriculum-struggle-detector` + US3 logic behind `007_curriculum_mentor_loop` flag. Roll out to a 50-student cohort.
7. **Phase 6 (cohort expansion)**: 100 → 1K → 10K → 50K students over 4 weeks, monitoring cost caps, match latency, lesson completion rate, and feedback rate.
8. **Phase 7 (GA)**: flip all 3 flags to 100% after SC-MATCH-001, SC-CURR-001, SC-LOOP-001 are on track.
