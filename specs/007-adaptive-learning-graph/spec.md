# Feature Specification: 007 — Adaptive Learning Graph

**Feature Branch**: `007-adaptive-learning-graph`
**Created**: 2026-06-07
**Status**: Draft
**Migration**: `040_adaptive_learning_graph.sql`
**Builds on**: 001 (foundation) + 002 (verified skill platform, calendar_events, pgvector) + 003 (engage & showcase, nudge inbox) + 004 (anti-cheat, next-best-skill, configurable LLM provider, weekly/monthly cost-cap pattern) + 005 (gamification — for streak data) + 006 (deep-signal-capture — for peak-window enrichment) + 008 (collaborative mode — for the `VideoRoomProvider` abstraction; will hard-fail with a clear error if 008 is not yet shipped, see plan.md)
**Input**: User vision to convert Antarix from "verified credentials + nudges" into an adaptive learning graph where (a) every student is matched with a trajectory-similar alumnus mentor, (b) every active student receives a daily micro-curriculum tuned to their weaknesses, peak window, similar-alumni lesson progressions, and calendar free time, and (c) the curriculum and the mentor pool form a closed feedback loop.

## Why this exists

001-006 give us a high-signal, well-attested, multi-portal product. Three structural gaps prevent compounding retention:

1. **No human-in-the-loop for skill formation.** A student can see a recommendation, but cannot get unstuck from a real human whose trajectory looked like theirs.
2. **No adaptive pacing.** Lessons arrive in fixed difficulty order; the platform does not adjust to peak productivity windows or to gaps the student just revealed.
3. **No feedback loop between mentor and curriculum.** Mentor "struggle" data is collected nowhere; curriculum does not know that the student is two lessons away from giving up.

007 closes all three gaps. It is the difference between a credential layer and a learning graph.

This feature has **two explicit deferrals**:
- Native group mentor sessions (1:N) — deferred to v2; v1 is strictly 1:1.
- LLM-generated reflection grading — deferred to v2; v1 records the student's free-text reflection but does not score it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Alumni Mentorship Match (Priority: P1)

A third-year CS student at a Tier-2 college in Maharashtra has 4 verified skills (Python, SQL, basic React, basic Flask) and a target-company tag of "Razorpay" set on their profile. They open `/dashboard/mentors` and see the top 5 alumni whose skill trajectory (sequence of skills and projects they added in chronological order) is cosine-similar to the student's trajectory, and who currently work at Razorpay or a company adjacent to it. The student picks the 2nd alumnus, a 2023 grad now SDE-1 at Razorpay, and sends a 180-character intro: "Just cleared a Stripe-API integration capstone, would love 20 minutes on how you broke into payments." The alumnus receives the request, sees the intro, and accepts. A LiveKit video room is provisioned in under 3 seconds with a join URL; both parties get the URL via nudge inbox and Discord. After the call, both rate each other 1-5 stars with a single sentence of feedback; the ratings feed the next match for both users.

**Why this is P1**: This is the highest-trust, highest-stakes interaction we can ship. Done right, it converts Antarix from "tool" to "relationship." It also creates a network-effect moat: alumni who have mentored once come back 2.3x more often (validated by 002 retention cohort data).

**Independent test**: Seed 50 alumni with synthetic trajectories and 1 student whose trajectory is engineered to be cosine-similar to alumni #17 (a "Razorpay SDE-1" alumnus). Run `embedding-job` to populate `skill_trajectory_embeddings`, then `mentor-match` for the student. Assert: alumni #17 appears in top-5; calling `POST /api/mentors/{alumni_17_id}/request` with a 180-char intro creates a `mentor_requests` row; calling `POST /api/mentor-requests/{id}/respond` with `accept=true` creates a `mentor_sessions` row with a non-null `video_room_url`; the URL is a valid LiveKit URL pattern OR a valid `meet.google.com` URL pattern (depending on `MENTOR_VIDEO_PROVIDER` env).

**Acceptance scenarios**:
1. **Given** a student with ≥ 1 verified skill and ≥ 1 trajectory event, **when** they GET `/api/mentors`, **then** the response returns ≤ 5 alumni, ordered by cosine-similarity × (target-company-match boost 1.5) × (availability-soon boost 1.2) × (rating boost 1 + 0.1×rating_avg), and excludes any alumnus whose `opted_out = true` or whose `public_profile_visible = false`.
2. **Given** a student selects an alumnus and submits a 200-character intro, **when** `POST /api/mentors/{id}/request` is called, **then** a `mentor_requests` row is created with `status='pending'`, an `intro_text` length-checked against 200 chars (HTTP 422 if over), and the alumnus receives a nudge with the intro.
3. **Given** an alumnus has a pending request, **when** they POST `/api/mentor-requests/{id}/respond` with `accept=true`, **then** a `mentor_sessions` row is created, a video room is provisioned via `VideoRoomProvider` (LiveKit primary, Google Meet fallback if 008-delayed per FR-MATCH-008), and both parties receive the join URL within 3 seconds; on `accept=false` the request is closed and the student is notified.
4. **Given** a completed mentor session, **when** either party submits `POST /api/mentor-sessions/{id}/feedback`, **then** a `mentor_feedback` row is written, both ratings are averaged into `alumni_profiles.rating_avg`, and the next match query for both users reflects the updated rating.
5. **Given** an alumnus has not opted in (`opted_in_for_mentorship=false`), **when** any match query runs, **then** that alumnus is excluded within 60 seconds of the opt-out toggle (RLS + denormalized `opted_out_at` cache).

---

### User Story 2 — Daily Adaptive Micro-Curriculum (Priority: P1)

A first-year student at a Tier-3 college in Tamil Nadu, locale `ta`, has a verified-skill vector of {Python, basic SQL} and a 2-week streak. They have a 90-minute free window tomorrow at 19:00 local (their peak window per 002 + 006 telemetry) and their calendar shows no events 18:30-20:00 (from 002 `calendar_events`). At 06:00 local time, a cron runs `curriculum-generator` for every active student. For this student, the generator pulls: (a) the 004 `next_best_skill` "FastAPI" recommendation as the weak-point target, (b) the peak window 19:00 ± 30min, (c) the top 3 lesson-progression patterns from alumni with similar trajectories (alumni A: "added FastAPI after Flask, did 3 lessons on async, 1 on Pydantic"; alumni B: "added FastAPI after Flask, did 2 lessons on async, 2 on Pydantic"; alumni C: same as A), (d) calendar free time 18:30-20:00, (e) lesson cost cap (still 60% of weekly budget remaining). The generator calls the 004 LLM client with a structured prompt: 3 lessons of 10-15min each, anchored to FastAPI. The LLM returns lesson 1 ("Async foundations in FastAPI", 280 words, exercise: rewrite a Flask sync handler as `async def`, reflection Q: "where would blocking IO hurt you most?", link: alumnus A's published FastAPI project). Lessons are inserted into `curriculum_lessons` and a single nudge is dispatched via 003 nudge dispatcher with a "today's 3 lessons" card. The student can optionally insert lessons 1-3 into their calendar (one-click Google Calendar insert via existing 002 calendar OAuth). After completing lesson 1, the student clicks "too easy" — that feedback is stored on `lesson_feedback` and feeds the next-day recommender.

**Why this is P1**: This is the daily-engagement anchor. Done right, it raises D7/D30 retention by an estimated 25-40% (validated by 002 cohort retention analysis). Done wrong, it is generic-content spam and burns LLM cost.

**Independent test**: Seed 1 active student with `next_best_skill="FastAPI"`, peak window 19:00, calendar with one 60-min free block tomorrow, and 3 similar-alumni progression patterns. Stub the 004 LLM client to return a known-good lesson JSON. Trigger `curriculum-generator`. Assert: 3 `curriculum_lessons` rows created for the student, all anchored to FastAPI, each ≤ 300 words, each with a non-null `exercise_starter_code` + `reflection_question` + `alumnus_project_link`; 1 nudge dispatched via 003; `curriculum_cost_counters.week_tokens_used` incremented by the stubbed lesson token count; feedback endpoint accepts "too easy" and writes a `lesson_feedback` row.

**Acceptance scenarios**:
1. **Given** an active student with a 004 next-best-skill, a peak window, and ≥ 1 calendar free block tomorrow, **when** the daily cron runs, **then** exactly 3 `curriculum_lessons` rows are created, each 10-15min, with the topic anchored to the next-best-skill.
2. **Given** the LLM has exhausted the student's weekly token budget, **when** the cron attempts to generate, **then** no new lessons are created, an `over_budget` nudge is sent to the student, and a `curriculum_cost_counters.breach_log` row is written.
3. **Given** a student opens the curriculum card, **when** they click "insert into calendar" on a lesson, **then** a 002 `calendar_events` row is created for the lesson's scheduled window with `derived_event_type='study_group'`; if calendar OAuth is not connected, the button is disabled with a tooltip.
4. **Given** a student completes a lesson and submits feedback (one of `too_easy`, `too_hard`, `irrelevant`, or free text), **when** the next day's cron runs, **then** the recommender's inputs include a per-topic aggregate of the last 14 days' feedback, weighted inverse to recency (more recent = higher weight).
5. **Given** the LLM returns malformed JSON or a lesson exceeds the 300-word cap, **when** the parser runs, **then** the malformed lesson is discarded, an `llm_parse_failure` row is written to a new `curriculum_cost_counters` field, and a 1-lesson fallback (a hand-curated "review previous concept" template) is used so the student still gets 3 lessons.

---

### User Story 3 — Curriculum-Mentor Closed Loop (Priority: P2)

The same first-year student from US2 completes the FastAPI micro-curriculum. On lessons 1 and 2 they submit "too hard" within 14 days of each other. The `curriculum-struggle-detector` cron identifies this as a 2+ struggle pattern on the same topic and enqueues a mentor suggestion: "You've hit two snags on FastAPI. Want to book a 20-minute call with an alumnus who went through the same progression?" The suggestion is the top-5 cosine-similar alumni from US1's `mentor-match` filtered to those whose `alumni_profiles.lesson_progression_topics` includes "FastAPI". The student books alumnus A (who 6 months ago also struggled with FastAPI for 2 lessons before breaking through). After the call, alumnus A's feedback is "rated 5/5, gave a 15min walkthrough of async/await in their own GitHub project." The recommender ingests this `mentor_sessions.topic + mentor_feedback` and re-weights the next 3 lessons for the student: lesson 1 is now a 12min "re-anchor: what async really means" lesson (down from the 15min "Async foundations"), lesson 2 is a hands-on debugging exercise pulled from alumnus A's GitHub commit history, lesson 3 is a stretch concept. The loop closes.

**Why this is P2**: The first two user stories already deliver the bulk of the value. This story turns two P1 surfaces into a compounding system and is the moat against "yet another DSA prep tool" competitors.

**Independent test**: Seed a student with 2 `lesson_feedback` rows of `too_hard` on the same topic within 14 days. Run `curriculum-struggle-detector`. Assert: 1 row inserted into a `mentor_suggestions` table (or queue) with `topic`, `suggested_alumni_ids` (top-5 cosine-similar who have the topic in `lesson_progression_topics`), `triggered_at`. Then complete a `mentor_sessions` flow with feedback. Run `curriculum-generator` for the next day. Assert: the next 3 lessons reflect the mentor-session-aware weighting — verified by reading the recommender's debug-log JSON that captures the weighting inputs.

**Acceptance scenarios**:
1. **Given** a student has ≥ 2 `lesson_feedback` rows of `too_hard` (or `irrelevant`) on the same topic within 14 days, **when** the struggle detector cron runs, **then** exactly 1 mentor suggestion is created per (student, topic) per 14-day window; the suggestion includes the top-5 cosine-similar alumni filtered to those whose `lesson_progression_topics` includes the topic.
2. **Given** a mentor accepts a struggle-triggered session and submits 4-5 star feedback, **when** the next curriculum generation runs for that student, **then** the next 3 lessons for the same topic reflect a documented weighting: re-anchor concept with shorter duration, hands-on exercise sourced from the mentor's public GitHub project, stretch concept as final lesson.
3. **Given** a mentor accepts but submits 1-2 star feedback ("could not help"), **when** the next curriculum generation runs, **then** the recommender treats this as a content gap signal, increases the `irrelevant` topic weight for the next 7 days, and does not re-suggest the same mentor for the same topic.
4. **Given** a student has no mentor available with the topic in `lesson_progression_topics` (suggested_alumni_ids is empty), **when** the struggle detector runs, **then** the suggestion is suppressed and a `curriculum_cost_counters.struggle_no_match_log` row is written; the student instead receives a "we couldn't find a mentor for this — would you like to join the topic waitlist?" nudge.

### Edge Cases

- **Mentor-match with empty trajectory** → If a student has < 1 trajectory event, the match query falls back to a popularity-ranked list (alumni with most sessions) tagged `fallback:no_trajectory` in the response.
- **Mentor intro length cap** → Enforced at 200 chars (UI counter + server validation 422). Trailing whitespace trimmed.
- **LiveKit 3x failure** → Falls back to Google Meet via the existing 002 Google Calendar OAuth (a Meet link is auto-created in the alumnus's calendar for the scheduled window and the URL is returned). Both nudge payloads updated to include the Meet URL.
- **Cost-cap breach mid-generation** → The remaining lessons for the day are filled with hand-curated "review previous concept" templates. No partial LLM output persisted.
- **Calendar OAuth not connected** → "Insert into calendar" button disabled with a one-click connect affordance.
- **Account deletion** → Embeddings, mentor feedback, lesson feedback, mentor sessions all soft-deleted then purged within 30 days per existing 002 deletion pipeline. Embeddings explicitly dropped first (PII concern).
- **Opted-out alumnus** → Excluded from match queries within 60s of opt-out toggle (denormalized `opted_out_at` cache + RLS).
- **LLM provider outage** → 004 fallback to a secondary provider (configured via `LLM_FALLBACK_PROVIDER`); if both are down, no lessons generated and a `curriculum_cost_counters.llm_outage_log` row is written.
- **Struggle loop with no similar mentor** → Suppressed + waitlist nudge (US3.4).
- **Mentor session no-show** → Both parties can mark "no-show" within 24h; no rating required; counts against the alumnus's `no_show_count` and may trigger auto-flag at `no_show_count ≥ 3`.
- **Race condition: two students request the same alumnus at the same slot** → `mentor_availability_slots` has `UNIQUE(slot_start, alumnus_id)` enforced via the request table, so the second request gets a 409.

## Requirements *(mandatory)*

### Functional Requirements

#### Alumni Mentorship Match (US1, P1)
- **FR-MATCH-001**: System MUST compute a per-user skill trajectory embedding as a 384-dimensional `vector(384)` from a chronological sequence of `(timestamp, skill_added, project_added, score_delta)` events; embedding model is `sentence-transformers/all-MiniLM-L6-v2` (or compatible), computed by the `embedding-job` edge function.
- **FR-MATCH-002**: System MUST expose `GET /api/mentors?topic=...&limit=5` returning alumni ordered by `cosine_similarity(student_traj, alumni_traj) × (target_company_match ? 1.5 : 1.0) × (availability_within_7d ? 1.2 : 1.0) × (1 + 0.1 × alumni.rating_avg)`, with `opted_in_for_mentorship=true` and `opted_out=false`.
- **FR-MATCH-003**: System MUST enforce a 200-character cap on `intro_text` (UI counter + server-side Zod validation, HTTP 422 on overflow).
- **FR-MATCH-004**: System MUST provision a video room within 3s p95 via the `VideoRoomProvider` interface defined in 008; on 3x LiveKit failure, MUST fall back to Google Meet (creating a calendar event with auto-generated Meet link via the alumnus's existing 002 Google OAuth).
- **FR-MATCH-005**: System MUST record a `mentor_feedback` row from each party within 24h of session scheduled_end; rating is 1-5, free-text is ≤ 500 chars.
- **FR-MATCH-006**: System MUST update `alumni_profiles.rating_avg = avg(recent_feedback.rating, last 90 days)` within 5 minutes of feedback submission.
- **FR-MATCH-007**: System MUST support `opted_in_for_mentorship` opt-in toggle and `opted_out` opt-out toggle; opt-out MUST propagate to match queries within 60s.
- **FR-MATCH-008**: System MUST treat 008 not-shipped as a hard precondition for FR-MATCH-004: if 008's `VideoRoomProvider` is not yet in the codebase, the `mentor-match` route returns HTTP 503 with `code='video_provider_unavailable'` rather than crashing or silently failing.
- **FR-MATCH-009**: System MUST exclude opted-out alumni AND alumni with `public_profile_visible=false` from match results; RLS must also enforce this at the database layer.

#### Daily Adaptive Micro-Curriculum (US2, P1)
- **FR-CURR-001**: System MUST run a daily cron at 06:00 local per active student that generates exactly 3 micro-lessons, each 10-15min, each ≤ 300 words of concept text.
- **FR-CURR-002**: Lesson inputs MUST be: (a) 004 `next_best_skill` weak-point target, (b) peak window from 002 + 006, (c) top-3 similar-alumni lesson-progression patterns, (d) 002 `calendar_events` free time within 24h.
- **FR-CURR-003**: LLM lesson output MUST include: `concept` (≤ 300 words), `exercise_starter_code` (one of Python/JavaScript/TypeScript/Go/Rust), `reflection_question` (one open-ended sentence), `alumnus_project_link` (a URL to a public repo or post owned by an alumnus in the top-3 progression match).
- **FR-CURR-004**: System MUST reuse the 004 cost-cap pattern: per-student weekly token cap (`LESSON_WEEKLY_TOKEN_CAP=30000`) + per-tenant monthly cap (`LESSON_MONTHLY_TENANT_TOKEN_CAP=3000000`); enforced at the LLM-call gate in `curriculum-generator`.
- **FR-CURR-005**: System MUST dispatch a single nudge per student per day via the existing 003 nudge dispatcher, with the 3 lessons summarized as cards.
- **FR-CURR-006**: System MUST support "insert into calendar" via the existing 002 Google Calendar OAuth, creating a `calendar_events` row with `derived_event_type='study_group'`.
- **FR-CURR-007**: System MUST accept feedback on each lesson (`too_easy` | `too_hard` | `irrelevant` | free text ≤ 280 chars) via `POST /api/curriculum/lessons/{id}/feedback` and persist to `lesson_feedback`.
- **FR-CURR-008**: System MUST aggregate lesson feedback over a 14-day window with inverse-recency weighting (most recent = highest) and feed it to the next-day recommender.
- **FR-CURR-009**: System MUST handle LLM parse failures (malformed JSON, word-cap overflow) by falling back to a hand-curated "review previous concept" template; MUST write an `llm_parse_failure` row to `curriculum_cost_counters` for observability.
- **FR-CURR-010**: System MUST handle LLM provider outage (primary + fallback both down) by skipping generation for the day, writing a `llm_outage_log` row, and emitting a system-level "lessons paused" alert.
- **FR-CURR-011**: System MUST soft-delete `curriculum_lessons` + `lesson_feedback` on account deletion; embeddings dropped immediately per FR-MATCH-009 privacy invariant.

#### Curriculum-Mentor Closed Loop (US3, P2)
- **FR-LOOP-001**: System MUST run `curriculum-struggle-detector` daily and create exactly 1 mentor suggestion per (student, topic) per 14-day window when ≥ 2 `too_hard` or `irrelevant` feedback rows exist for that (student, topic) within 14 days.
- **FR-LOOP-002**: Mentor suggestion MUST include the top-5 cosine-similar alumni (from `skill_trajectory_embeddings`) filtered to those whose `alumni_profiles.lesson_progression_topics` includes the struggling topic.
- **FR-LOOP-003**: On mentor session completion with feedback 4-5 stars, the next 3 lessons for the same student + topic MUST reflect a documented weighting: (a) re-anchor concept, shorter duration (10min); (b) hands-on debugging exercise sourced from the mentor's public GitHub commit history; (c) stretch concept. Weighting must be debuggable via a JSON log on `curriculum_lessons.recommender_debug`.
- **FR-LOOP-004**: On mentor session completion with feedback 1-2 stars, the recommender MUST treat this as a content-gap signal, increase the `irrelevant` topic weight for the next 7 days, and MUST NOT re-suggest the same mentor for the same topic.
- **FR-LOOP-005**: When no similar mentor is available for a topic, the struggle suggestion MUST be suppressed and a `curriculum_cost_counters.struggle_no_match_log` row MUST be written; the student receives a "join topic waitlist" nudge instead.

#### Cross-cutting
- **FR-CC-001**: All new tables MUST have RLS enabled with explicit policies; no service-role bypass for student-facing reads.
- **FR-CC-002**: All new surfaces MUST be behind feature flags: `007_alumni_mentorship`, `007_daily_curriculum`, `007_curriculum_mentor_loop`; defaults OFF.
- **FR-CC-003**: All new edge functions MUST log to the existing `supabase.functions.invoke_log` and MUST write a feature-scoped audit row for every external dispatch.
- **FR-CC-004**: All new shared types MUST live under `packages/types/` (no inline duplicates in `apps/web/`).
- **FR-CC-005**: The LLM provider MUST be the 004-configured provider (no new provider surface); the cost-cap pattern MUST be the 004 pattern (per-student weekly + per-tenant monthly).
- **FR-CC-006**: Calendar integration MUST reuse 002's `calendar_events` table (no new calendar schema).
- **FR-CC-007**: Video room provisioning MUST go through the 008 `VideoRoomProvider` interface (no direct LiveKit/Meet API calls from app code).
- **FR-CC-008**: Account deletion MUST drop embeddings immediately, soft-delete the rest, and purge within 30 days (per existing 002 pipeline).
- **FR-CC-009**: pgvector extension MUST be enabled in the same migration (`040_adaptive_learning_graph.sql`) that creates `skill_trajectory_embeddings`.
- **FR-CC-010**: The HNSW index on `skill_trajectory_embeddings.embedding` MUST use `m=16, ef_construction=64` (per research.md D2); `ef_search=40` for queries.

### Key Entities

- **alumni_profiles** — Per-alumnus mentorship metadata; columns: `user_id`, `opted_in_for_mentorship`, `opted_out`, `opted_out_at`, `target_company_tags`, `specialty_tags`, `lesson_progression_topics`, `rating_avg`, `rating_count`, `sessions_count`, `no_show_count`, `public_profile_visible`, `employer`, `role`, `bio`, `created_at`, `updated_at`.
- **mentor_availability_slots** — Recurring or one-off availability windows an alumnus declares; columns: `id`, `alumnus_id`, `slot_start`, `slot_end`, `recurrence_rule` (nullable, RRULE string), `is_blocked`, `created_at`.
- **mentor_requests** — A student's request to a specific alumnus for a specific slot; columns: `id`, `student_id`, `alumnus_id`, `slot_id`, `intro_text` (≤ 200 chars), `status` (pending/accepted/declined/cancelled/expired), `responded_at`, `created_at`.
- **mentor_sessions** — A confirmed 1:1 video call; columns: `id`, `request_id`, `student_id`, `alumnus_id`, `scheduled_start`, `scheduled_end`, `video_room_url`, `video_provider` (livekit/google_meet), `status` (scheduled/joined/completed/no_show), `joined_at`, `completed_at`, `created_at`.
- **mentor_feedback** — Mutual post-session rating + free text; columns: `id`, `session_id`, `submitter_id`, `subject_id` (the other party), `rating` (1-5), `feedback_text` (≤ 500 chars), `no_show_flag`, `created_at`.
- **skill_trajectory_embeddings** — Per-user chronological-skill-event embedding; columns: `user_id`, `embedding` (vector(384)), `event_count`, `last_computed_at`, `model_version`.
- **curriculum_lessons** — Daily micro-lesson rows; columns: `id`, `student_id`, `topic`, `concept` (≤ 300 words), `exercise_starter_code`, `reflection_question`, `alumnus_project_link`, `duration_minutes` (10-15), `scheduled_window_start`, `scheduled_window_end`, `recommender_debug` (jsonb), `created_for_date`, `created_at`.
- **lesson_feedback** — Per-lesson student response; columns: `id`, `lesson_id`, `student_id`, `feedback_kind` (too_easy/too_hard/irrelevant/completed), `feedback_text` (nullable, ≤ 280 chars), `created_at`.
- **curriculum_cost_counters** — Per-student and per-tenant token usage + breach log; columns: `id`, `scope` (student/tenant), `scope_id`, `window_start`, `window_end`, `tokens_used`, `lessons_generated`, `cap_tokens`, `breach_log` (jsonb, includes `over_budget`, `llm_parse_failure`, `llm_outage_log`, `struggle_no_match_log`).
- **mentor_suggestions** (US3 queue) — Struggled-topic mentor suggestions; columns: `id`, `student_id`, `topic`, `suggested_alumni_ids` (uuid[]), `triggered_at`, `window_start`, `window_end`, `consumed_at` (nullable).

## Out of Scope (Deferred to v2)

These were considered and explicitly deferred:
1. **Native 1:N group mentor sessions** — Defer; v1 is strictly 1:1. Group sessions require moderation, attendance, and cost caps that we do not yet have evidence for.
2. **LLM-generated reflection grading** — Defer; v1 stores reflection text but does not score it. Scoring adds cost + risks of unfair penalization.
3. **Alumni-to-alumni mentorship** — Defer; v1 is student → alumnus. Reverse direction (junior alumni → senior alumni) is a different product surface.
4. **Mentor payment / revenue share** — Permanently deferred for v1; mentorship is a community good in v1.
5. **Multi-language lesson generation** — Defer; v1 lessons are English-only. Hindi/regional translation of curriculum (extending 004 i18n) is captured in 004 backlog.
6. **Video room recording** — Defer; LiveKit/Meet recordings raise consent and storage concerns not yet scoped.

## Success Criteria *(mandatory, measurable)*

### Measurable Outcomes

- **SC-MATCH-001**: ≥ 30% of active students with ≥ 3 verified skills send at least 1 mentor request within 30 days of `007_alumni_mentorship` flag enable.
- **SC-MATCH-002**: Mentor request → accept median latency ≤ 6 hours; p95 ≤ 36 hours.
- **SC-MATCH-003**: Video room provisioning p95 ≤ 3s; LiveKit 3x failure → Google Meet fallback fires within 5s.
- **SC-MATCH-004**: ≥ 60% of completed sessions receive mutual feedback within 24h.
- **SC-CURR-001**: Daily curriculum cron completes in ≤ 2h wall-clock for full active cohort (50K students at scale).
- **SC-CURR-002**: ≥ 40% of active students complete at least 1 of the 3 daily lessons on ≥ 50% of active days.
- **SC-CURR-003**: Cost-cap breach (per-student weekly exceeded) occurs in ≤ 1% of student-days at steady state.
- **SC-CURR-004**: ≥ 25% of lessons receive feedback (any kind) within 48h of generation.
- **SC-LOOP-001**: ≥ 20% of struggle-triggered mentor suggestions result in a booked mentor session within 14 days.
- **SC-LOOP-002**: Of students who complete a struggle-loop mentor session with 4-5 star feedback, ≥ 50% complete the next 3 lessons in the same topic within 7 days.
- **SC-COST-001**: Total LLM cost for 007 ≤ 8% of 004's LLM cost (reuse caps keep it bounded).
- **SC-PRIV-001**: Account deletion drops embeddings within 60s, soft-deletes the rest within 1h, purges within 30 days.

## Assumptions

1. **008 will be merged before 007's first cohort rollout** for the `VideoRoomProvider` abstraction. If 008 slips, the 007 mentor match route returns HTTP 503 until 008 lands (see FR-MATCH-008).
2. **sentence-transformers/all-MiniLM-L6-v2** is available in the existing embedding service (validated during 002 build; same model class as 002's semantic-skill-matching). If a new model is required, the dimension must stay at 384 to keep pgvector HNSW index size constant.
3. **pgvector is already enabled in the 002 schema** (per `002-antarix-definitive-vision/data-model.md` deferred note). If not, the 040 migration enables it.
4. **The 003 nudge dispatcher is the same channel for both `curriculum` and `mentor_requests`** — no new dispatch channel is added.
5. **The 002 Google Calendar OAuth scope is sufficient for both "create study_group event" and "auto-create Meet link"** — confirmed by 002's existing scope set.
6. **An active student = `users.last_active_at > now() - 14 days`** (per existing 002 definition).
7. **A "similar alumnus" for a struggling topic = alumnus whose `alumni_profiles.lesson_progression_topics` includes the topic AND whose `skill_trajectory_embeddings` is in the student's top-30 cosine-similar set** (this is the filter for US3 mentor suggestions).
8. **The configurable LLM provider from 004 Phase 8 (`LESSON_LLM_MODEL`)** is the single source of truth for which model generates lessons. No new provider abstraction is introduced in 007.
9. **The video room provider is configurable via `MENTOR_VIDEO_PROVIDER=livekit|meet`**; default is `livekit` (cheaper, more controllable). `meet` is the 008-delayed fallback.
10. **Cost caps are inherited from 004** — `LESSON_WEEKLY_TOKEN_CAP=30000` per student per week, `LESSON_MONTHLY_TENANT_TOKEN_CAP=3000000` per tenant per month. Defaults may be tuned in `quickstart.md`.
