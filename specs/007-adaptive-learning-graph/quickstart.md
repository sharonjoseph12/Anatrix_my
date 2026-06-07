# Quickstart: Adaptive Learning Graph

**Date**: 2026-06-06
**Prereqs**: 001 + 002 + 003 + 004 + 006 quickstarts already executed. `pgvector` is enabled in 002 per the original spec brief; if the live env does not have it, migration 043 enables it. The 004 `mock-interview-llm` function is the LLM provider — its env vars already exist.

## 1. New environment variables

Add to `.env.local` (and document in `.env.local.example`):

```env
# === Adaptive Learning Graph (007) ===

# Embedding model
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIM=384
EMBEDDING_INFERENCE_URL=http://embedding-service:8080/embed   # local Python sidecar or hosted MiniLM endpoint
EMBEDDING_BATCH_SIZE=64

# pgvector
PGVECTOR_HNSW_M=16
PGVECTOR_HNSW_EF_CONSTRUCTION=64
PGVECTOR_HNSW_EF_SEARCH=40

# Curriculum cost caps (reuse 004 caps; no new provider surface)
# These were already set in 004:
#   MOCK_INTERVIEW_WEEKLY_TOKEN_CAP=50000
#   MOCK_INTERVIEW_MONTHLY_TOKEN_CAP=5000000
# 007 adds the same-named aliases for clarity (no value change):
CURRICULUM_WEEKLY_TOKEN_CAP=50000
CURRICULUM_MONTHLY_TENANT_TOKEN_CAP=5000000

# Curriculum generation schedule
CURRICULUM_CRON_HOUR_LOCAL=5            # 05:00 student local time
CURRICULUM_LESSONS_PER_DAY=3
CURRICULUM_LESSON_MIN_MINUTES=10
CURRICULUM_LESSON_MAX_MINUTES=15
CURRICULUM_CALENDAR_BLOCK_MINUTES=15    # how long the calendar block is
CURRICULUM_MAX_INTRO_CHARS=200
CURRICULUM_MAX_EXPLAINER_WORDS=300
CURRICULUM_MAX_REFLECTION_CHARS=280
CURRICULUM_MAX_SPECIALTY_TAGS=10
CURRICULUM_MAX_SIMILAR_ALUMNI=3

# Struggle → mentor-suggestion loop
STRUGGLE_MIN_NEGATIVE_FEEDBACKS=2
STRUGGLE_WINDOW_DAYS=14
STRUGGLE_SUGGESTION_CRON_HOUR_LOCAL=9
STRUGGLE_TUNED_LESSON_COUNT=3           # next 3 lessons get mentor_tuning

# Mentor match
MENTOR_MATCH_TOP_K=5
MENTOR_MATCH_HOLD_MINUTES=15
MENTOR_MATCH_REQUEST_EXPIRY_HOURS=24
MENTOR_RATING_BOOST_MAX_POSITIONS=3
MENTOR_AVAILABILITY_FORWARD_WEEKS=4

# Video room provider
VIDEO_PROVIDER=livekit                  # or 'google_meet'
LIVEKIT_API_URL=wss://livekit.example.com
LIVEKIT_API_KEY=<livekit-api-key>
LIVEKIT_API_SECRET=<livekit-api-secret>
GOOGLE_MEET_CALENDAR_ID=primary          # for the Calendar API conferenceData fallback
```

## 2. Migrations (run in order)

```bash
pnpm supabase db push       # applies 043 in sequence (others already applied)
```

Migration order:
1. `045_adaptive_learning_graph.sql` — enables `pgvector`; creates 9 new tables; creates HNSW index on `skill_trajectory_embeddings.embedding`; RLS policies; CHECK constraints; updated_at triggers

> **Note on migration number**: the spec brief stated `040` for this feature, but 040-042 are already taken in the live env. 043 is the next free number; confirm with the migration-ledger owner before apply.

## 3. New Edge Functions to deploy

```bash
pnpm supabase functions deploy embedding-rebuild
pnpm supabase functions deploy mentor-match
pnpm supabase functions deploy curriculum-generate-daily
pnpm supabase functions deploy video-room-create
```

Each function uses the secret bundle declared in step 1.

## 4. LLM provider setup (reuse 004)

The LLM provider is the existing 004 `mock-interview-llm` client. No new keys are required. Confirm:
- `MOCK_INTERVIEW_PROVIDER=groq` (or `openai`, `together`)
- `MOCK_INTERVIEW_API_KEY=<provider-api-key>`
- `MOCK_INTERVIEW_MODEL=llama-3.1-70b-versatile` (or provider equivalent)

If you want a separate provider pool for curriculum generation (recommended for cost visibility), set the same env vars with a `CURRICULUM_` prefix and configure `apps/web/src/lib/llm/client.ts` to fall back to the `CURRICULUM_*` set first.

## 5. Embedding-job seeding

The `embedding-rebuild` edge function is invoked nightly. To seed embeddings for the first time:

```bash
# 1. Start the local embedding service (or point EMBEDDING_INFERENCE_URL to a hosted MiniLM endpoint).
docker compose up embedding-service

# 2. Trigger a full rebuild via the Supabase SQL editor:
select net.http_post(
  url := 'https://<project-ref>.supabase.co/functions/v1/embedding-rebuild',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object('scope', 'all')
);
```

Or, for a single student:
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/embedding-rebuild" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"scope": "user", "user_id": "<uuid>"}'
```

## 6. Alumni opt-in (manual test path)

```bash
# Create an alumni profile (one row per alumnus)
psql $DATABASE_URL <<SQL
insert into public.alumni_profiles (user_id, opt_in, current_employer, current_role,
                                    target_company_tags, specialty_tags, career_stage)
values ('<alumnus-user-uuid>', true, 'Razorpay', 'Backend Engineer II',
        '{Razorpay,Stripe}', '{backend,system-design,go}', 'mid');
SQL

# Or use the API:
curl -X POST http://localhost:3000/api/alumni/opt-in \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "opt_in": true,
    "current_employer": "Razorpay",
    "current_role": "Backend Engineer II",
    "target_company_tags": ["Razorpay", "Stripe"],
    "specialty_tags": ["backend", "system-design", "go"],
    "career_stage": "mid",
    "weekly_template": [{"day": "Wed", "start_local": "19:00", "end_local": "21:00", "tz": "Asia/Kolkata"}]
  }'
```

The API call expands the weekly template into the next 4 weeks of `mentor_availability_slots`.

## 7. pgvector setup confirmation

The migration enables the extension, but to confirm it's working in your local env:

```sql
-- Should return 'vector' (extension info)
\dx vector

-- Should return 0 rows if you've never run the embedding-rebuild yet:
select count(*) from public.skill_trajectory_embeddings;

-- After running the seed in step 5, the HNSW index should exist:
select indexname, indexdef from pg_indexes
  where tablename = 'skill_trajectory_embeddings';
```

## 8. Feature flags (recommended rollout)

Behind feature flags from day 1 (use the existing `feature_flags` table from 003):
- `007_alumni_mentorship` — Day 0 GA (P1)
- `007_daily_curriculum` — Day 7 cohort rollout (P1)
- `007_curriculum_mentor_loop` — Day 21 cohort rollout (P2)

## 9. Smoke tests

```bash
pnpm test                                        # unit (incl. new cosine, prompt, cost-cap)
pnpm test:e2e -- --grep "mentor-match"          # E2E for mentor list
pnpm test:e2e -- --grep "mentor-request"        # E2E for request → accept → room
pnpm test:e2e -- --grep "video-fallback"        # E2E for LiveKit→Meet fallback
pnpm test:e2e -- --grep "curriculum"            # E2E for daily generation
pnpm test:e2e -- --grep "lesson-feedback"       # E2E for feedback → re-difficulty
pnpm test:e2e -- --grep "struggle-loop"         # E2E for struggle → mentor suggestion
pnpm test:e2e -- --grep "cost-cap"              # E2E for breach + stub fallback
```

## 10. Observability

- **Mentor match**: query `mentor_requests` joined to `mentor_sessions` for daily volume + accept rate; `mentor_feedback` for rating distribution.
- **Curriculum cost**: `curriculum_cost_counters` ordered by `tokens_used DESC` and `breach_log != '[]'` for breach events.
- **Struggle loop**: query `lesson_feedback WHERE rating IN ('too_hard','not_relevant')` for the input to the struggle detector.
- **Video rooms**: per-provider success rate in `mentor_sessions.video_provider` + `video_room_metadata.error` on failure.
- **Embeddings**: `skill_trajectory_embeddings` `snapshot_at` distribution to verify the nightly rebuild is hitting ≥ 95% of active users.

## 11. Rollback

Migration 043 is purely additive. To roll back:
```bash
pnpm supabase migration repair --status reverted 043
# then apply the corresponding DROP statements (held in supabase/migrations/_rollback/007/)
```

Feature flags allow logical rollback without DB migration reversal.
