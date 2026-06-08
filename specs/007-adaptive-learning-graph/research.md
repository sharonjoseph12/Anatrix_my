# Phase 0 Research: 007 — Adaptive Learning Graph

**Date**: 2026-06-07
**Status**: Decisions ratified; ready for Phase 1

Ten architectural decisions for feature 007. Each captures the choice, the rejected alternatives, and the rationale.

---

## D1. Embedding model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim)

**Decision**: Use `sentence-transformers/all-MiniLM-L6-v2` to embed per-user skill trajectories into 384-dim vectors. The model is already running in the 002 embedding service (used for semantic-skill-matching in `next_best_skill`); 007 reuses the same model and the same 384-dim output.

**Alternatives considered**:
- `BAAI/bge-small-en-v1.5` (384-dim, MTEB slightly higher) — rejected: would require a second model in the embedding service; not worth the operational complexity for a marginal recall gain at this scale.
- `text-embedding-3-small` (OpenAI, 1536-dim) — rejected: 4× the index size; per-call cost; the trajectory signal is short and structured enough that a small local model is sufficient.
- `Cohere embed-english-v3.0` (1024-dim) — rejected: same cost/operational concerns as OpenAI.
- One-hot / bag-of-skills representation — rejected: loses chronological structure and weight (e.g. "added React after Flask" is a different signal from "added React before Flask").

**Rationale**: MiniLM-L6-v2 is fast (< 50ms per embedding on CPU), small (90 MB), license-friendly (Apache 2.0), MTEB-validated for sentence-level semantic similarity, and already deployed. The trajectory-as-sentence approach (see D2) maps cleanly to its pretraining objective.

---

## D2. pgvector index: HNSW with `m=16, ef_construction=64`, `ef_search=40`

**Decision**: Use HNSW (Hierarchical Navigable Small World) for the cosine-similarity index on `skill_trajectory_embeddings.embedding`. Parameters: `m=16` (max connections per node), `ef_construction=64` (build-time search depth), `ef_search=40` (query-time search depth).

**Alternatives considered**:
- IVFFlat — rejected: requires choosing `lists` upfront, has worse recall at low `lists`, and is much slower to build at 50K scale. HNSW gives us O(log N) query time with no `lists` choice.
- IVFPQ (product quantization) — rejected: would compress the index but reduces recall; not needed at 50K × 384-dim (~75 MB raw + ~2× overhead ≈ 200 MB total, well within Supabase's per-database storage budget).
- No index (sequential scan) — rejected: would not meet the SC-MATCH-001 p95 ≤ 1.5s target at 50K users.

**Rationale**: HNSW is the pgvector-recommended default for ≤ 1M rows, has the best recall/latency tradeoff, and is the right choice at 50K students × 384-dim. `m=16` is the pgvector default; `ef_construction=64` is a 2× build-time cost for ~3% recall gain over the default of 32. `ef_search=40` is tuned for our `LIMIT 50` mentor-suggestion query (5 results × 8 filter slots ≈ 40 candidates).

**Index size**: 50K rows × 384-dim × 4 bytes/float32 = 73.7 MB raw, plus HNSW graph overhead (≈ 2× raw) ≈ 200 MB total. Well within Supabase limits.

---

## D3. Trajectory-to-text encoding: chronological event list

**Decision**: Encode a user's skill trajectory as a single string of chronologically-ordered events: `"2024-09-15 added Python via DSA profile; 2024-11-20 added Flask via project; 2025-02-10 added React via project; 2025-05-01 added FastAPI via project; score_delta=+12"`. Pass the string to MiniLM-L6-v2 to get the 384-dim embedding.

**Alternatives considered**:
- Multi-vector per skill (one embedding per skill, aggregate at query time) — rejected: requires storing N vectors per user; complex aggregation; no clear recall benefit.
- Per-event embeddings + learned aggregation — rejected: requires training an aggregator; over-engineering for v1.
- Bag-of-skills + timestamp-weighted average — rejected: collapses order information.

**Rationale**: The single-string approach preserves chronological order, makes the trajectory auditable (the string is human-readable), reuses the existing embedding service with no code changes, and gives MiniLM-L6-v2 enough signal (the dates, the action verbs, the project context) to produce meaningful similarity.

**Cache invalidation**: Recompute on (a) new skill added, (b) new project added, (c) score delta > 5, (d) weekly cron as a backstop. Stored with `event_count` and `last_computed_at` for observability.

---

## D4. LLM lesson prompt: structured JSON output with strict word caps

**Decision**: Lesson generation uses a single LLM call per lesson with a structured JSON prompt. The prompt template:

```
SYSTEM: You are a micro-curriculum generator for {student.first_name}, a {year}-year {branch} student at {college}. Output STRICT JSON, no prose.
USER: Generate 1 micro-lesson on {topic} for a student with these weak points: {next_best_skill_reasoning}.
Peak window: {peak_window}. Available minutes: 10-15. Free blocks tomorrow: {free_blocks}.
Similar alumni lesson progressions on this topic: {top_3_progression_patterns}.
Output schema:
{
  "concept": "<= 300 words, 2-3 short paragraphs, NO markdown headings>",
  "exercise_starter_code": "<one of Python/JS/TS/Go/Rust, 5-20 lines, runnable>",
  "reflection_question": "<one open-ended sentence, <= 20 words>",
  "alumnus_project_link": "<URL to a public repo/post owned by an alumnus in top_3>",
  "duration_minutes": <10|12|15>
}
CONSTRAINTS:
- Concept must NOT exceed 300 words (we will hard-truncate if it does).
- exercise_starter_code must be runnable as-is.
- alumnus_project_link must resolve to a real public URL (no placeholder.com).
- Tone: peer-to-peer, encouraging, no condescension.
```

**Alternatives considered**:
- Free-form text + post-parse — rejected: brittle, hard to validate, and prone to LLM "creativity" leaking into production.
- Multi-turn conversation (clarifying questions) — rejected: 3 lessons × N students × clarifying rounds = cost blowup; the inputs are structured and constrained.
- Per-student fine-tuned model — rejected: over-engineering for v1; reuse 004's configurable provider.

**Rationale**: Structured JSON output is parseable, validatable, and rejects hallucinations on the `alumnus_project_link` field. The 300-word hard cap is enforced both in the prompt AND in the parser (post-parse truncation, then a parse-failure log if truncation was needed). The `alumnus_project_link` requirement forces the LLM to ground every lesson in a real public artifact, which is a major trust signal.

---

## D5. Cost-cap strategy: 004 pattern, two-tier (per-student weekly, per-tenant monthly)

**Decision**: Reuse the 004 cost-cap pattern exactly. Two gates, checked before every LLM call in `curriculum-generator`:
1. **Per-student weekly** (`LESSON_WEEKLY_TOKEN_CAP=30000`) — if a student's `curriculum_cost_counters` row for the current ISO week has `tokens_used >= 30000`, skip generation for that student and emit an `over_budget` nudge.
2. **Per-tenant monthly** (`LESSON_MONTHLY_TENANT_TOKEN_CAP=3000000`) — if a tenant's counter for the current month has `tokens_used >= 3000000`, skip generation for ALL students in the tenant and emit a system-level "lessons paused" alert.

**Alternatives considered**:
- Single global cap — rejected: a heavy user could starve light users.
- Per-lesson cap — rejected: too granular; doesn't reflect the real cost driver (the cumulative load on the LLM).
- Hard kill switch (no cap) — rejected: risk of cost blowup from a bad prompt or a malicious cohort.
- Token-bucket with refill — rejected: over-engineering; weekly/monthly is what 004 ships and it's been validated.

**Rationale**: 004's pattern is battle-tested, the code path is copy-paste from `mock-interview-llm`, and the defaults (`30000` weekly per student, `3M` monthly per tenant) are calibrated to keep 007's total LLM cost ≤ 8% of 004's cost (SC-COST-001). The `curriculum_cost_counters.breach_log` JSONB captures every breach event with full context (student/tenant, current usage, lesson that triggered the breach) for observability.

**Fallback on breach**: 3 lessons per day are non-negotiable. On breach, fill the remaining slots with a hand-curated "review previous concept" template (3-5 templates rotated deterministically by topic). The student still gets 3 lessons; the LLM is bypassed for the breached scope.

---

## D6. Mentor availability: per-slot rows with optional RRULE recurrence

**Decision**: Mentor availability is stored as one row per availability window in `mentor_availability_slots`. Each row has `slot_start` (timestamp), `slot_end` (timestamp), and an optional `recurrence_rule` (RRULE string, e.g. `"FREQ=WEEKLY;BYDAY=MO,WE,FR"`). On read, the resolver expands recurring slots into concrete instances within the query window (default 7 days forward). Blocked slots are soft-deleted (`is_blocked=true`).

**Alternatives considered**:
- One row per occurrence (denormalize at write time) — rejected: explode the row count for weekly-recurring mentors; hard to update a series.
- A single `availability_json` blob on `alumni_profiles` — rejected: unindexable, hard to query, hard to RLS.
- Google Calendar free/busy lookup only — rejected: adds a per-query Google API call; brittle when OAuth is disconnected; we already have a 002 calendar OAuth story but availability is a separate signal from calendar events.
- Cal.com / SavvyCal integration — rejected: third-party dependency; not needed for v1.

**Rationale**: The per-slot + RRULE approach is simple, queryable (`SELECT * FROM mentor_availability_slots WHERE alumnus_id = ? AND slot_start BETWEEN now() AND now() + interval '7 days' AND is_blocked = false`), and the RRULE standard is well-supported (we can use `rrule` npm package for expansion). The slot granularity matches the 1:1 mentor session model (30-60 min slots).

**Race condition handling**: When a student sends a `mentor_requests` row, the system attempts to claim the slot via `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM mentor_requests WHERE slot_id = ? AND status IN ('pending', 'accepted'))`. The `mentor_availability_slots` table does NOT need a UNIQUE constraint because the slot itself is not exclusive; the request is. A second request for the same slot by a different student gets a 409.

---

## D7. Video room provider abstraction: `VideoRoomProvider` (008), LiveKit primary, Google Meet fallback

**Decision**: All video room provisioning goes through the `VideoRoomProvider` interface from feature 008. 007 does NOT implement `VideoRoomProvider`; it only consumes it. The interface (defined in 008, re-exported in `packages/types/video-room.ts`):

```ts
export interface VideoRoomProvider {
  createRoom(opts: { sessionId: string; scheduledStart: Date; scheduledEnd: Date }): Promise<{ providerName: 'livekit' | 'google_meet'; joinUrl: string; roomId: string; expiresAt: Date }>;
  cancelRoom(roomId: string, providerName: string): Promise<void>;
  getRoomStatus(roomId: string, providerName: string): Promise<'scheduled' | 'active' | 'ended' | 'expired'>;
}
```

**Primary**: `LiveKitVideoRoomProvider` (cheaper, more controllable, supports custom branding).
**Fallback**: `GoogleMeetVideoRoomProvider` (creates a calendar event with auto-Google-Meet link via 002 Google Calendar OAuth).

**Selection logic** (in `video-room-dispatcher.ts`):
1. Read `MENTOR_VIDEO_PROVIDER` env. If `meet`, use Google Meet.
2. If `livekit` (default), call `LiveKitVideoRoomProvider.createRoom`.
3. On 3x failure (with 1s, 2s, 4s backoff), call `GoogleMeetVideoRoomProvider.createRoom`.
4. On 008 not-shipped: `video-room-dispatcher` throws `VideoProviderUnavailableError`; the mentor-requests respond route returns HTTP 503 with `code='video_provider_unavailable'` (FR-MATCH-008).

**Alternatives considered**:
- Direct LiveKit API call from 007 — rejected: violates the 008 abstraction boundary; will be reworked when 008 ships.
- Daily.co / Whereby — rejected: vendor lock-in, less India-region coverage than Google Meet.
- Zoom — rejected: enterprise-only, OAuth flow is heavier than what students can complete.

**Rationale**: 008 is the right home for this abstraction. 007's job is to consume it correctly. The LiveKit → Google Meet fallback is the same pattern 002 uses for calendar creation; the existing Google OAuth scope covers it.

---

## D8. Opt-out propagation: denormalized `opted_out_at` cache + RLS

**Decision**: Opt-out state lives on `alumni_profiles` with three columns: `opted_in_for_mentorship` (bool), `opted_out` (bool), `opted_out_at` (timestamptz, nullable). On toggle, the API route sets `opted_out=true, opted_out_at=now()`. The `mentor-matcher` pure function adds a WHERE clause: `opted_out = false OR (opted_out = true AND opted_out_at < now() - interval '60 seconds')` — but in practice we set `opted_out=false` immediately and rely on RLS to exclude. The 60s claim is satisfied by: (a) the API route updates the row synchronously; (b) PostgREST publishes schema cache invalidations within ~1s; (c) the RLS policy `alumni_profiles_opted_out_false` denies reads on `opted_out = true`.

**Alternatives considered**:
- Soft-delete with 30-day purge — rejected: opt-out is a stronger signal than "deleted"; we want immediate effect.
- Event-driven invalidation (pub/sub on opt-out event) — rejected: pgvector's snapshot isolation gives us the right behavior; no need for custom invalidation.
- Sticky match cache (e.g. 5-min cached mentor list) — rejected: breaks the 60s opt-out guarantee.

**Rationale**: The denormalized flag + RLS combo is the simplest correct design. The "60s" claim in the spec is actually satisfied in <1s in practice; we keep the 60s as a conservative contractual commitment.

---

## D9. Struggle detector: 2+ negative feedback on same topic within 14 days

**Decision**: The `curriculum-struggle-detector` edge function runs daily and:
1. Queries `lesson_feedback` for the last 14 days.
2. Groups by `(student_id, topic)`.
3. For each group with `count(*) FILTER (WHERE feedback_kind IN ('too_hard', 'irrelevant')) >= 2`:
   - If no row in `mentor_suggestions` for this `(student_id, topic)` in the last 14 days, insert a new suggestion row.
   - The suggestion includes `suggested_alumni_ids` = top-5 cosine-similar alumni filtered to those whose `alumni_profiles.lesson_progression_topics @> ARRAY[topic]`.
   - If the filtered set is empty, write a `struggle_no_match_log` row and dispatch a "join topic waitlist" nudge.

**Alternatives considered**:
- Per-lesson struggle detection — rejected: too noisy; a single hard lesson is normal, not a pattern.
- 3+ negative threshold — rejected: too lenient; 2 is the right number to balance false positives vs missed signals.
- 7-day window — rejected: too short for a working student with weekend-only study; 14 days captures the typical "I tried for two weekends" pattern.
- Cross-topic struggle detection — rejected: the topic specificity is the signal; cross-topic is a different problem (and likely a different intervention).

**Rationale**: 2+ within 14 days is the validated threshold from 002's struggle-pattern retrospective. The 14-day `mentor_suggestions` dedup window prevents alert spam. The no-match fallback (waitlist nudge) preserves the user experience when the mentor pool doesn't have coverage.

---

## D10. Closed-loop recommender weighting: 004-style, with mentor-session signal

**Decision**: The `recommender.ts` pure function takes the standard 004 inputs (next-best-skill, peak window, similar-alumni patterns, calendar free time) AND adds two new 007 inputs:
- `mentor_session_weight`: if a mentor session was completed in the last 14 days with feedback 4-5 stars, apply a `mentor_session_topic_reweight` JSON (computed in step 1).
- `struggle_weight`: if a struggle suggestion was consumed in the last 14 days, apply a `re_anchor_lesson` template for the next 3 lessons on the same topic.

The recommender emits a `recommender_debug` JSON on every `curriculum_lessons` row, capturing the full weighted input set, so the output is auditable (FR-LOOP-003).

**Weighting table** (in `recommender.ts`):

| Signal | Default weight | Notes |
|---|---|---|
| `next_best_skill` topic | 1.0 | inherited from 004 |
| Mentor session 4-5 stars (last 14d, same topic) | 1.5 | boosts re-anchor |
| Mentor session 1-2 stars (last 14d, same topic) | 0.3 | suppresses same mentor for 7d |
| Struggle suggestion consumed (last 14d) | 1.3 | boosts re-anchor + hands-on |
| `too_hard` feedback (last 14d, same topic) | 1.4 | shortens duration to 10min |
| `too_easy` feedback (last 14d, same topic) | 0.6 | lengthens duration to 15min |
| `irrelevant` feedback (last 14d, same topic) | 0.4 | swaps to adjacent topic |

**Alternatives considered**:
- Reinforcement learning on feedback — rejected: cold-start problem; over-engineering for v1.
- Per-student fine-tuned model — rejected: 50K students × fine-tuning = cost blowup; reuse 004's configurable provider.
- Static rules only (no weights) — rejected: weights are how the loop closes; static rules cannot incorporate mentor feedback.

**Rationale**: The weighting table is auditable, deterministic, and debuggable via `recommender_debug`. The defaults are calibrated to keep the system in a "helpful, not overwhelming" regime; they can be tuned in `quickstart.md` §"Tunables" without code changes.

---

## Cross-cutting decisions

- **Migration lands as a single additive file (`045_adaptive_learning_graph.sql`).** No destructive changes. `pgvector` extension enable is `CREATE EXTENSION IF NOT EXISTS vector` (idempotent).
- **All new edge functions emit structured logs to `supabase.functions.invoke_log`** for the existing observability stack.
- **All new external dispatches (mentor request, video room create, lesson generation, struggle detection) log to a feature-scoped audit row** with `actor`, `subject`, `action`, `payload_hash`, `created_at`.
- **Feature flags via existing `feature_flags` table** (from 003): every 007 capability ships behind a flag for cohort rollout. Defaults: `007_alumni_mentorship` = OFF, `007_daily_curriculum` = OFF, `007_curriculum_mentor_loop` = OFF.
- **All P1 features are explicitly behind a flag from day 1** so they can be rolled out to small cohorts first.
- **The 008 `VideoRoomProvider` is a hard prerequisite for US1 mentor match.** US1 will return HTTP 503 until 008 is merged (FR-MATCH-008). US2 (curriculum) and US3 (struggle detection) do not depend on 008 and can ship independently.
