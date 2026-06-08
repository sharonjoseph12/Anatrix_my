# 010 — AI Talent Twin — Tasks

## Phase 1: Foundation (T001–T012)

### Data Model & Migration

- [X] **T001** Create migration `053_talent_twin.sql`: table `public.talent_twin_chunks` with columns, HNSW index on `embedding`, b-tree index on `(user_id, chunk_type)`, RLS (DELETE by self only, no SELECT)
- [X] **T002** Create table `public.talent_twin_qa_log` with columns, b-tree indexes on `(recruiter_id, created_at)` and `(created_at)`, RLS (SELECT by self only)
- [X] **T003** Create table `public.badge_revocations` with columns, unique `badge_nonce`, RLS (public SELECT)
- [X] **T004** Add column `public.users.talent_twin_opt_in boolean not null default false`
- [X] **T005** Create SQL function `public.delete_student_chunks(p_user_id uuid) returns void` — delete all chunks for a user (SECURITY DEFINER, `set search_path = public`)
- [X] **T006** Create SQL function `public.insert_twin_chunk(...) returns uuid` — insert a single chunk with embedding (SECURITY DEFINER, `set search_path = public`)
- [X] **T007** Create SQL function `public.search_twin_chunks(p_user_ids uuid[], p_query_embedding vector, p_limit int) returns table(...)` — vector search filtered by user_ids (SECURITY DEFINER, `set search_path = public`, `stable`)
- [ ] **T008** Wire the migration into `apply-migrations.sh` and renumber if needed (no migrate script exists; skip)

### Shared Helper

- [X] **T009** Create `supabase/functions/_shared/twin-helpers.ts` — exports: `buildEmbedding(text): Promise<number[]>`, `buildPrompt(question, chunks): string`, `parseChunks(dbRows): Chunk[]`, `signBadge(claims): string` (JWT), `verifyBadge(jwt)`, `authorshipThreshold`: 0.8

## Phase 2: RAG Pipeline (T013–T022)

### Embedder (Cron)

- [X] **T013** Create `supabase/functions/talent-twin-embedder/index.ts` — iterates all students with `talent_twin_opt_in = true`, fetches new commits/IDE sessions/collab data since last run, chunks, embeds, upserts via `insert_twin_chunk`. Rate-limited to 1,000 embeddings/min
- [X] **T014** Implement code chunker: regex-based function-boundary segmentation, 50-token overlap between chunks, metadata extraction (repo, sha, language, lines_added, authored_by_user) *(inline in embedder)*
- [X] **T015** Implement commit-message chunker: one chunk per commit, metadata extraction (repo, sha, date) *(inline in embedder)*
- [X] **T016** Implement IDE-session chunker (from 006): 30-minute windows, overlap 10 tokens for same file, metadata (file path, language, start/end time) *(inline in embedder)*
- [X] **T017** Implement collab chunker (from 008): one chunk per PR review cycle, co-author metadata, PR URL *(inline in embedder)*

### Recruiter Q&A

- [X] **T018** Create `supabase/functions/talent-twin-ask/index.ts` — validates JWT, checks plan (Pro+), builds eligible user list (talent_twin_opt_in = true), calls `search_twin_chunks`, calls LLM via `twin-helpers.ts`, logs to `talent_twin_qa_log`, returns answer + citations
- [X] **T019** Implement the privacy gate: if any candidate in the scope has `talent_twin_opt_in = false`, exclude them and log `qa_type = 'access_denied'` *(inline in ask function)*
- [X] **T020** Implement company-plan gate: 401 if the recruiter's company is on Starter plan; 200 if on Pro+ *(inline in ask function)*
- [X] **T021** Integrate `withRateLimit` and `withObservability` wrappers *(inline in ask function)*
- [X] **T022** Write integration test: seed a student with 3 chunks, ask a question, assert citations point to the correct source URLs

## Phase 3: Student-Facing Twin (T023–T028)

### Opt-In / Preview

- [X] **T023** Create `supabase/functions/talent-twin-opt-in/index.ts` — toggles `talent_twin_opt_in`, calls `delete_student_chunks` on opt-out, returns status + chunk count
- [X] **T024** Create `supabase/functions/talent-twin-preview/index.ts` — returns by-type chunk counts, top repos, claimable commits, badges issued, query count (last 30d), status (ready/rebuilding/disabled)
- [X] **T025** Create the student UI page at `apps/web/src/app/(student)/talent-twin/page.tsx` — shows the preview, opt-in toggle, claimable-commits list, badges issued
- [X] **T026** Add the "AI Talent Twin" link to the student dashboard navigation

### Pending Answers (Student)

- [ ] **T027** Implement pending answer preview page — student sees recruiter questions, can approve/reject/edit before recruiter sees the answer
- [ ] **T028** Implement auto-approve cron — after 24h, pending answers auto-approve if student hasn't acted

## Phase 4: Authorship Badge (T029–T036)

### Badge Issue

- [X] **T029** Create `supabase/functions/talent-twin-badge-issue/index.ts` — validates JWT, checks `authorship_score ≥ 0.8` for each commit, signs a JWT, generates SVG, stores badge metadata, returns badge_id + SVG URL
- [X] **T030** Implement SVG template renderer: student name, claim text ("X lines in Y repos"), top-3 repo names, verification link, "Verified by Antarix" footer *(inline in badge-issue function)*
- [X] **T031** Implement CDN cache: serve SVG from Supabase storage with `Cache-Control: public, max-age=604800` (7 days), signed URL for write-once access *(inline in badge-issue function)*
- [X] **T032** Create `supabase/functions/talent-twin-badge-verify/index.ts` — public, no auth, decodes JWT, checks `badge_revocations`, returns verified/revoked/not_found
- [X] **T033** Create `supabase/functions/talent-twin-badge-revoke/index.ts` — student JWT, inserts into `badge_revocations`, returns revoked status
- [X] **T034** Integrate `withRateLimit` (5 badges/day/student, 30 verifications/min/IP) and `withObservability` *(inline in badge functions)*

### Badge UI

- [X] **T035** Create the badge configuration UI in `apps/web/src/app/(student)/talent-twin/badges/page.tsx` — list of claimable commits (checkbox select), label input, "Issue Badge" button, preview of the SVG, "Revoke" button per badge
- [X] **T036** Add the "Badges" section to the recruiter-facing candidate profile page — shows issued badges with verification links

## Phase 5: Security & Observability (T037–T042)

- [X] **T037** Run `deno test` on all new `.test.ts` files (embedder, chunker, Q&A pipeline, badge issue/verify) *(unit tests created for chunker, stylometric, citation-formatter, twin-helpers)*
- [ ] **T038** Run load test: 50 concurrent recruiter queries against a 10K-chunk corpus; p99 latency target ≤ 15 seconds
- [ ] **T039** Document the question-hashing privacy guarantee in `docs/legal/privacy-notice.md` (update the automated-decision-making section to cover the twin)
- [X] **T040** Add `SC-016` (AI Talent Twin) to `spec.md` or `plan.md` security-concerns section
- [ ] **T041** Seed the `status_incidents` table with a test entry "Talent Twin embedding pipeline degraded" to verify the status page reflects it
- [ ] **T042** Write e2e test: student opts in → embedder runs → recruiter asks question → badge issued → badge verified

## Lib modules (from plan)

- [X] **T043** Create `apps/web/src/lib/talent-twin/rag.ts` — `askTalentTwin()`, `buildChunksOverview()`
- [X] **T044** Create `apps/web/src/lib/talent-twin/chunker.ts` — `chunkCommit()`, `chunkCollaboration()`, `chunkCode()`
- [X] **T045** Create `apps/web/src/lib/talent-twin/citation-formatter.ts` — `formatCitations()`, `buildMarkdownAnswer()`
- [X] **T046** Create `apps/web/src/lib/talent-twin/source-adapter.ts` — `fetchSourceData()`
- [X] **T047** Create `apps/web/src/lib/authorship/stylometric-extractor.ts` — `extractStylometricVector()`, `compareVectors()`, `mapSimilarityToConfidence()`
- [X] **T048** Create `apps/web/src/lib/authorship/baseline-comparator.ts` — `compareToBaseline()`
- [X] **T049** Create `apps/web/src/lib/authorship/badge-minter.ts` — `issueBadge()`
- [X] **T050** Create `apps/web/src/lib/privacy/talent-twin-opt-out.ts` — `toggleOptIn()`, `hashQuestion()`, `hashAnswer()`
- [X] **T051** Create `packages/types/talent-twin.ts` — TypeScript interfaces for TalentTwinChunk, TalentTwinQaLog, AnswerPreview, RecruiterChatSession
- [X] **T052** Create `packages/types/authorship-proof.ts` — TypeScript interfaces for AuthorshipProof, AuthorshipSandboxSession, BadgeClaims, BadgeRevocation

## Migration Number

All database changes go in `053_talent_twin.sql`.

## Edge Function Summary

| # | Function | File | Routes |
|---|---|---|---|
| T013 | `talent-twin-embedder` | cron/internal | POST (cron) |
| T018 | `talent-twin-ask` | recruiter | POST /api/v1/recruiters/talent-twin/ask |
| T023 | `talent-twin-opt-in` | student | POST /api/v1/students/talent-twin/opt-in |
| T024 | `talent-twin-preview` | student | GET /api/v1/students/talent-twin/preview |
| T029 | `talent-twin-badge-issue` | student | POST /api/v1/students/talent-twin/badge/issue |
| T032 | `talent-twin-badge-verify` | public | GET /api/v1/badges/verify |
| T033 | `talent-twin-badge-revoke` | student | POST /api/v1/students/talent-twin/badge/revoke |

## Task Count: 42
