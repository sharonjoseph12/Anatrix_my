# Quickstart: 010 — AI Talent Twin

**Date**: 2026-06-08
**Prereqs**: 001 + 002 + 003 + 004 + 006 + 007 + 008 quickstarts already executed. The 007 pgvector + MiniLM embedding service MUST be running. The 004 configurable LLM provider MUST be configured. The 006 IDE telemetry pipeline MUST have ≥ 30 days of data for authorship proof testing.

## 1. New environment variables

Add to `.env.local` (and document in `.env.local.example`):

```env
# === RAG Pipeline ===
TALENT_TWIN_MAX_CONTEXT_TOKENS=4000
TALENT_TWIN_CHUNK_SIZE=500
TALENT_TWIN_CHUNK_OVERLAP=50
TALENT_TWIN_CITATION_LIMIT=8
TALENT_TWIN_AUTO_APPROVE_HOURS=24

# === Recruiter cost caps (reuses 004 pattern) ===
TALENT_TWIN_WEEKLY_TOKEN_CAP=10000
TALENT_TWIN_MONTHLY_TENANT_TOKEN_CAP=1000000

# === Embedding ===
TALENT_TWIN_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
TALENT_TWIN_EMBEDDING_DIM=384
TALENT_TWIN_EMBEDDING_MAX_CHUNKS_PER_SOURCE=500

# === Authorship Proof ===
AUTHORSHIP_MIN_KEYSTROKE_EVENTS=100
AUTHORSHIP_MIN_SESSION_SECONDS=300
AUTHORSHIP_SIMILARITY_THRESHOLD=0.7
AUTHORSHIP_MAX_RETRIES=3

# === Cron ===
TALENT_TWIN_EMBEDDING_CRON_HOUR_UTC=5
TALENT_TWIN_AUTO_APPROVE_CRON_HOUR_UTC=0
```

## 2. Migration

```bash
pnpm supabase db push       # applies 053_talent_twin.sql
```

Migration `053_talent_twin.sql` creates:
1. `talent_twin_qa_log` — append-only Q&A audit log
2. `answer_preview` — pending answer preview queue
3. `recruiter_chat_session` — recruiter chat session tracking
4. `authorship_proof` — authorship proof lifecycle
5. `authorship_sandbox_sessions` — stylometric capture data
6. GIN indexes on 8 existing source tables

## 3. New Edge Function to deploy

```bash
pnpm supabase functions deploy talent-twin-embedding-job
```

This function:
- Runs weekly at `TALENT_TWIN_EMBEDDING_CRON_HOUR_UTC` (default 05:00 UTC)
- Iterates all opted-in students, fetches their source artifacts via adapters, chunks at 500-char / 50-overlap, embeds via MiniLM (reusing 007's embedding service), and upserts to the vector store
- Logs progress: `{ student_id, chunks_count, source_types, duration_ms }`

A manual trigger is available for development:

```bash
pnpm supabase functions invoke talent-twin-embedding-job --no-verify-jwt
```

## 4. Embedding rebuild command

To rebuild embeddings for all opted-in students (full pass):

```bash
# Manual trigger
pnpm supabase functions invoke talent-twin-embedding-job --no-verify-jwt

# Or for a single student via SQL
select embed_talent_twin_student('student-uuid-here');
```

Expected duration: ~4h for 50K students (at ~12 students/second, 384-dim embedding, 500 chunks/student worst case).

## 5. Local testing setup

### 5.1. Start the local Supabase stack

```bash
pnpm supabase start
```

### 5.2. Run the migration

```bash
pnpm supabase db reset
```

### 5.3. Seed test data

```bash
pnpm supabase db seed --file supabase/seed/010_talent_twin_test.sql
```

This creates:
- A test student `talent-twin-test@antarix.test` with opt-in enabled and 2 GitHub PR descriptions, 1 mock-interview transcript, and 1 collab session transcript
- A test recruiter `recruiter-test@partner-company.com` with a valid recruiter session

### 5.4. Trigger embedding rebuild (dev only)

```bash
pnpm supabase functions invoke talent-twin-embedding-job --no-verify-jwt
```

### 5.5. Recruiter Q&A testing

```bash
# Ask a question about the test student
curl -X POST http://localhost:54321/api/v1/recruiters/talent-twin/ask \
  -H "Authorization: Bearer $RECRUITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"student_id": "<student-uuid>", "question": "What projects has this student worked on?"}'
```

Expected response:
```json
{
  "answer": "Based on their Antarix work, I can see... [Source: GitHub PR — Refactor auth middleware](https://...)",
  "citations": [
    { "source_type": "github_pr", "title": "Refactor auth middleware", "url": "https://..." }
  ],
  "session_id": "uuid",
  "status": "pending"
}
```

### 5.6. Student preview queue testing

```bash
# Sign in as the test student, view pending answers
curl -H "Authorization: Bearer $STUDENT_TOKEN" \
  http://localhost:54321/api/v1/students/talent-twin/pending

# Approve an answer
curl -X POST http://localhost:54321/api/v1/students/talent-twin/answers/<answer-id>/approve \
  -H "Authorization: Bearer $STUDENT_TOKEN"

# Reject with edit
curl -X POST http://localhost:54321/api/v1/students/talent-twin/answers/<answer-id>/reject \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"edited_answer": "I actually led the auth refactor, not just participated..."}'
```

### 5.7. Authorship proof testing

```bash
# Request proof (requires ≥ 30 days of 006 IDE telemetry)
curl -X POST http://localhost:54321/api/v1/students/authorship-proof/request \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "<project-uuid>"}'

# Check badge status
curl -H "Authorization: Bearer $STUDENT_TOKEN" \
  http://localhost:54321/api/v1/students/authorship-proof/<proof-id>/badge

# Public verification (no auth required)
curl http://localhost:54321/api/v1/public/authorship-proof/<proof-id>/verify
```

## 6. Feature flags

Add to `supabase/seed.sql`:

```sql
insert into feature_flags (key, enabled, cohort_pct, description) values
  ('010_talent_twin',        false, 0, 'AI Talent Twin recruiter Q&A + student preview queue (US1)'),
  ('010_authorship_proof',    false, 0, 'Code Authorship Proof Badge with stylometric verification (US2)');
```

Recommended cohort rollout:
- `010_talent_twin` — Week 1: 5% students (internal), Week 2: 25% + 5 partner recruiters, Week 3: 100%
- `010_authorship_proof` — Week 4: 10% eligible students (≥ 30 days IDE telemetry), Week 6: 100%

## 7. Observability

- **RAG pipeline latency**: p95 ≤ 5s tracked via `supabase.functions.invoke_log` with `duration_ms`
- **Embedding job progress**: `talent-twin-embedding-job` emits `{ students_processed, chunks_created, errors }` per run
- **Answer preview funnel**: count of pending → approved → rejected per student per week
- **Authorship proof success rate**: `count(completed) / count(requested)` per week
- **Cross-student data leakage**: zero-tolerance metric monitored via `talent_twin_qa_log` hash-chain integrity check (weekly cron asserts no duplicate `question_hash` across different `student_id` values — a real leak would show the same hash for two students)

## 8. DPDP data-principal-rights runbook

When a student revokes talent twin access:

1. Student toggles talent twin OFF in `/settings/signals`
2. `POST /api/v1/students/talent-twin/opt-in { enabled: false }`
3. Server-side handler:
   a. Sets `users.talent_twin_opted_in = false`
   b. Sets `talent_twin_qa_log.status = 'revoked'` for all rows with `student_id = me`
   c. Deletes all `answer_preview` rows for `student_id = me`
   d. Deletes all `recruiter_chat_session` rows for `student_id = me`
   e. Triggers deletion of all embedding chunks for `student_id = me`
   f. Writes a `signal_audit` row with `action = 'talent_twin_revoked'`
4. All operations complete within 60 seconds (FR-010)

## 9. Rollback

```bash
pnpm supabase migration repair --status reverted 053
# then drop statements in supabase/migrations/_rollback/010/053.sql
```

Feature flags allow logical rollback without DB migration reversal. Flip `010_talent_twin` to OFF and all recruiter-facing surfaces return 404/403.
