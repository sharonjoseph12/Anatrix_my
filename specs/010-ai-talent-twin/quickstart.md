# 010 — AI Talent Twin — Quickstart

## Prerequisites

- The 002, 004, 006, and 008 migrations are applied (002 = GitHub + credentials, 004 = anti-cheat, 006 = IDE telemetry, 008 = collaborative mode)
- `text-embedding-3-small` access through the OpenAI API key already configured for nudges (env var `OPENAI_API_KEY`)
- pgvector extension enabled (`create extension if not exists vector;`)
- Supabase project on a plan that supports pgvector + HNSW indexes (Pro or above)

## Environment Variables

```
# Required
OPENAI_API_KEY=sk-...                # Already configured for nudges (004)
SUPABASE_SERVICE_ROLE_KEY=...         # Already configured
SUPABASE_URL=https://<project>.supabase.co

# Tuning (optional)
TALENT_TWIN_CHUNK_LIMIT=20           # Max chunks retrieved per query (default 20)
TALENT_TWIN_MAX_SCOPE=50             # Max candidates scoped per query (default 50)
TALENT_TWIN_LLM_MODEL=gpt-4o-mini    # LLM for answer generation
TALENT_TWIN_LLM_TEMPERATURE=0.1      # LLM temperature (default 0.1)
TALENT_TWIN_EMBEDDING_MODEL=text-embedding-3-small
```

## Setup Steps

### 1. Apply the migration

```bash
supabase migration up 053_talent_twin
```

This creates `talent_twin_chunks` (with the HNSW index), `talent_twin_qa_log`, and `badge_revocations`. Adds `talent_twin_opt_in` to `users`.

### 2. Deploy the Edge Functions

```bash
supabase functions deploy talent-twin-ask --no-verify-jwt  # No: it IS JWT-protected
supabase functions deploy talent-twin-ask                   # With JWT verification
supabase functions deploy talent-twin-opt-in
supabase functions deploy talent-twin-preview
supabase functions deploy talent-twin-badge-issue
supabase functions deploy talent-twin-badge-verify --no-verify-jwt  # Public
```

### 3. Set up the daily embedder cron

If you have a migration that owns cron jobs (e.g. `029_cron_002.sql`), add:

```sql
select cron.schedule(
  'talent-twin-embedder-daily',
  '0 4 * * *',  -- 04:00 UTC daily
  $$ select net.http_post(
    url:='https://<project>.supabase.co/functions/v1/talent-twin-embedder',
    headers:='{"Authorization":"Bearer <service-role-key>"}'::jsonb,
    body:='{}'::jsonb
  ) as req_id;
  $$
);
```

Or run it manually:

```bash
supabase functions serve talent-twin-embedder --no-verify-jwt
curl -X POST http://localhost:54321/functions/v1/talent-twin-embedder
```

### 4. Seed the embedder (first run)

On the first run, the embedder iterates all students and creates chunks for their existing GitHub contributions, IDE sessions, and collab data. For a cohort of 500 students with ~100 commits each, this takes ~5–10 minutes (rate-limited to 1,000 embeddings/minute to avoid OpenAI rate limits).

### 5. Verify the pipeline

```bash
# Ask a question as a recruiter
curl -X POST https://<project>.supabase.co/functions/v1/talent-twin-ask \
  -H "Authorization: Bearer <recruiter-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["<student-uuid>"], "question": "What distributed-systems work has this candidate done?"}'

# Expected: an answer with 1-3 citations, each a commit URL
```

### 6. Test the badge flow (as a student)

```bash
# List claimable commits
curl -X GET https://<project>.supabase.co/functions/v1/talent-twin-preview \
  -H "Authorization: Bearer <student-jwt>"

# Issue a badge
curl -X POST https://<project>.supabase.co/functions/v1/talent-twin-badge-issue \
  -H "Authorization: Bearer <student-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"commits": ["<sha1>", "<sha2>"]}'

# Expected: { badge_id: "<uuid>", badge_svg_url: "/badges/authorship/<uuid>.svg", issued: true }
```

### 7. Test the privacy gate

```bash
# As a student, opt in
curl -X POST https://<project>.supabase.co/functions/v1/talent-twin-opt-in \
  -H "Authorization: Bearer <student-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"opt_in": true}'

# Ask about the opted-in student (as a recruiter)
# Should succeed

# Opt out
curl -X POST ... -d '{"opt_in": false}'

# Ask again
# Should return: {"error": "access_denied", "message": "This candidate has not opted in to the AI Talent Twin"}
```

## Test Suite

```bash
# Run the integration test (uses seeded data)
supabase test run -n talent-twin-ask

# Run the badge flow test
supabase test run -n talent-twin-badge
```

## Rollback

```bash
# Drop the tables and column (deletes all chunks permanently)
supabase migration down 053
```

Or just disable via the privacy gate: set `talent_twin_opt_in = false` for all users. The chunks remain (for undo) but are inaccessible.
