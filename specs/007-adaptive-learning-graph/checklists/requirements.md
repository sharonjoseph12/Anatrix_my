# Requirements Quality Checklist: Adaptive Learning Graph

**Purpose**: Verify the spec, plan, data-model, contracts, and tasks are internally consistent, complete, and unambiguous *before* implementation starts.
**Created**: 2026-06-06
**Feature**: `007-adaptive-learning-graph`
**Source**: `specs/007-adaptive-learning-graph/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`, `tasks.md`

Each item is a pass/fail check. All items should be `[x]` before the implementation phase begins.

---

## Spec Completeness

- [ ] CHK001 Every user story has a **Why this priority** explanation that ties to a product goal
- [ ] CHK002 Every user story has a concrete **Independent test** that does not require another user story to be live
- [ ] CHK003 Every user story has ≥ 3 acceptance scenarios using Given/When/Then
- [ ] CHK004 Every edge case listed in the spec is mapped to a functional requirement OR is explicitly deferred
- [ ] CHK005 Functional requirements use the `FR-{STORY}-{NUMBER}` naming convention consistently
- [ ] CHK006 All `NEEDS CLARIFICATION` markers are surfaced in this checklist's "Open Questions" section
- [ ] CHK007 Success criteria are measurable (have a number, a timeframe, and a population)
- [ ] CHK008 Out-of-scope items are listed and explicitly named as deferred

## Data Model Correctness

- [ ] CHK010 Every entity named in the spec's **Key Entities** section has a table in `data-model.md`
- [ ] CHK011 Every table has an explicit RLS policy plan
- [ ] CHK012 Every FK resolves to an existing 001-006 table OR to a table created in migration 043
- [ ] CHK013 Every CHECK constraint is justified by a functional requirement
- [ ] CHK014 Every performance-critical query path (mentor-match, today's lessons) has a supporting index
- [ ] CHK015 The HNSW index parameters (`m`, `ef_construction`) are documented and consistent with research.md D2
- [ ] CHK016 `pgvector` extension is enabled in the same migration that creates the embedding table
- [ ] CHK017 All `vector(384)` columns are 384-dim (matches the chosen embedding model)
- [ ] CHK018 Migration is idempotent (`if not exists`, `drop policy if exists` + `create policy`)

## API Contract Correctness

- [ ] CHK020 Every endpoint listed in the spec's acceptance scenarios appears in `contracts/api.md`
- [ ] CHK021 Every endpoint has explicit auth requirements (session, service role, etc.)
- [ ] CHK022 Every endpoint has explicit error codes for documented failure modes
- [ ] CHK023 Request bodies use Zod-validatable JSON (or equivalent)
- [ ] CHK024 Response bodies do not leak PII (alumnus email, alumnus phone, etc.)
- [ ] CHK025 All `200/201/4xx/5xx` status codes are correct per REST conventions
- [ ] CHK026 The error response shape is consistent across all endpoints
- [ ] CHK027 The 200-char intro cap is enforced server-side AND reflected in the UI counter

## Architectural Constraints

- [ ] CHK030 All new shared types live under `packages/types/`
- [ ] CHK031 All new API routes live under `apps/web/src/app/api/`
- [ ] CHK032 All new edge functions live under `supabase/functions/`
- [ ] CHK033 The LLM provider is the existing 004 client (no new provider surface)
- [ ] CHK034 The cost-cap pattern is the 004 pattern (per-student weekly + per-tenant monthly)
- [ ] CHK035 Calendar integration reuses 002's `calendar_events` table (no new calendar schema)
- [ ] CHK036 Video room provider is the `VideoRoomProvider` abstraction (LiveKit preferred, Google Meet fallback)
- [ ] CHK037 All new tables have RLS enabled
- [ ] CHK038 All new surfaces are behind feature flags (`007_alumni_mentorship`, `007_daily_curriculum`, `007_curriculum_mentor_loop`)
- [ ] CHK039 The brief's "Migration number for this feature is 040" is reconciled (043 used; see Open Questions)

## Performance & Scale

- [ ] CHK050 `GET /api/mentors` p95 ≤ 1.5s at 50K student scale (verified by plan and research)
- [ ] CHK051 Embedding rebuild (full pass) p95 ≤ 6h for 50K users
- [ ] CHK052 Daily cron completion ≤ 2h wall-clock for full active cohort
- [ ] CHK053 Video room create p95 ≤ 3s
- [ ] CHK054 HNSW index size ≤ 200 MB at 50K × 384-dim × 4 bytes raw + ~2× overhead

## Test Coverage

- [ ] CHK060 Every E2E test in `tasks.md` has a corresponding entry in `tests/e2e/`
- [ ] CHK061 Every unit test in `tasks.md` has a corresponding entry in `tests/integration/`
- [ ] CHK062 Mentor match correctness test asserts: cosine ranking, target-company match boost, availability-soon boost, rating boost, opted-out exclusion
- [ ] CHK063 Cost-cap breach test asserts: stub lessons, breach_log row, dashboard notification
- [ ] CHK064 Video fallback test asserts: LiveKit 3x failure → Google Meet path; both nudge payloads
- [ ] CHK065 Struggle-loop test asserts: ≥ 2 negative in 14d → suggestion queued; mentor accept → next 3 lessons tuned

## Privacy & Compliance

- [ ] CHK070 Opted-out alumni are excluded from match queries within 60s
- [ ] CHK071 Account deletion drops embeddings immediately (PII concern)
- [ ] CHK072 Mentor intros are visible only to the chosen alumnus
- [ ] CHK073 Public-by-default fields on `alumni_profiles` are explicitly enumerated and limited (employer, role, specialty_tags, rating_avg, sessions_count — NOT email, phone, name beyond first name)
- [ ] CHK074 DPDP / SOC2 audit log: every LLM call, every match, every video-room create, every mentor request flow event is recorded

## Rollout

- [ ] CHK080 Feature flags default to off; cohort rollout dates documented in `quickstart.md` §8
- [ ] CHK081 Observability hooks (cost counters, invoke_log) are wired before any flag is enabled
- [ ] CHK082 Rollback path (migration revert + flag flip) is documented in `quickstart.md` §11

## Open Questions (NEEDS CLARIFICATION)

- [ ] CHK-OC-1 **Migration number**: spec brief stated 040 for this feature; migrations 040-042 are already taken in the live env. Plan uses 043 (next free). *Need: human confirmation from the migration-ledger owner that 043 is acceptable for this feature.*
- [ ] CHK-OC-2 **Data retention for trajectory embeddings + completed lessons + feedback**: spec did not specify retention. Default proposal in `data-model.md` is "soft-delete on account deletion; embeddings dropped immediately". *Need: confirmation of retention policy and the legal/regulatory basis (DPDP, GDPR if expanded).*
- [ ] CHK-OC-3 **Video room auto-join UX**: spec says "video-call room" but does not specify auto-join behavior. Default proposal in `contracts/api.md` is "return a `join_url`; UI shows a 'Join Call' button 10 minutes before scheduled_start; do not auto-open tabs (browser security)". *Need: product confirmation on auto-join vs explicit-click UX, and the behavior when *both* the student and the alumnus are present in the room (who's host? does it matter?).*

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- Link to relevant resources or documentation
- Items are numbered sequentially for easy reference
- This checklist should be re-run after every spec/plan/tasks revision
