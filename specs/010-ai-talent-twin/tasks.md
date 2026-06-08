# Tasks: 010 — AI Talent Twin

**Feature**: `010-ai-talent-twin`
**Generated**: 2026-06-08
**Source**: `specs/010-ai-talent-twin/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

Atomic, dependency-ordered tasks. `[P]` = parallelizable with siblings sharing the same phase prefix. **Bold** tasks are critical-path. `[US1]` / `[US2]` maps each task to its user story for traceability. 57 tasks total.

---

## Phase 0 — Pre-flight

- [ ] T001 [P] Verify 001-009 task completion (confirmed: 001-009 shipped / in progress)
- [ ] T002 [P] Survey existing migrations (001-052 present); confirm next free migration number is 053
- [ ] T003 [P] Survey existing edge functions and app routes; confirm no name clashes for `talent-twin-embedding-job` or new API routes
- [ ] T004 [P] Add 010 env vars to `.env.local.example` per `quickstart.md` §1 (TALENT_TWIN_*, AUTHORSHIP_*)
- [ ] T005 [P] Add 010 env vars to `turbo.json` `globalEnv` array
- [ ] T006 [P] Insert 2 new `feature_flags` rows in `supabase/seed.sql` per `quickstart.md` §6 (`010_talent_twin`, `010_authorship_proof`); both default `enabled=false`, `cohort_pct=0`

---

## Phase 1 — Migration 053

- [ ] **T010** [US1+US2] Create `supabase/migrations/053_talent_twin.sql` with DDL for 5 new tables, GIN indexes on existing source tables, RLS policies, all in a single atomic migration file
- [ ] T011 [P] [US1] Add `talent_twin_qa_log` DDL block (bigserial PK, student_id FK, recruiter_id FK, question_hash, answer_hash, citation_links jsonb, status, created_at) with indexes: `(student_id, created_at DESC)`, `(recruiter_id, created_at DESC)`, `(question_hash, student_id)`; RLS: student sees own, recruiter sees own approved, service role full
- [ ] T012 [P] [US1] Add `answer_preview` DDL block (uuid PK, student_id FK, recruiter_id FK, recruiter_question, llm_answer, edited_answer nullable, citation_links jsonb, status, auto_approve_at, created_at, approved_at, rejected_at) with indexes: `(student_id, status, created_at DESC)`, `(auto_approve_at)`; RLS: student sees own pending, recruiter sees approved only
- [ ] T013 [P] [US1] Add `recruiter_chat_session` DDL block (uuid PK, recruiter_id FK, student_id FK, started_at, last_activity_at, question_count, ended_at) with indexes: `(recruiter_id, student_id, started_at DESC)`, `(last_activity_at)`; RLS as per data-model.md
- [ ] T014 [P] [US2] Add `authorship_proof` DDL block (uuid PK, student_id FK, project_id, session_vector jsonb nullable, baseline_similarity numeric nullable, confidence_score int nullable, verifiable_credential_url nullable, status, created_at, completed_at) with indexes: `(student_id, created_at DESC)`, `(project_id)`; RLS as per data-model.md
- [ ] T015 [P] [US2] Add `authorship_sandbox_sessions` DDL block (uuid PK, proof_id FK CASCADE, keystroke_timing_vector jsonb, ast_diff_sequence jsonb, error_recovery_vector jsonb, duration_seconds) with index: `(proof_id)`; RLS as per data-model.md
- [ ] T016 [P] Add GIN indexes on 8 existing source tables: `github_commits` (002), `pull_requests` (002), `dsa_coach_chat_logs` (003), `mock_interview_transcripts` (004), `faculty_grade_comments` (004), `ide_sessions` (006), `lesson_feedback` (007), `collab_artifacts` (008) — each on `(student_id, source_type)` where `source_type` is a text column (add generated column if missing)
- [ ] T017 [P] Create `supabase/migrations/054_cron_010.sql` with 2 `cron.schedule(...)` entries: `talent-twin-embedding-job` at `TALENT_TWIN_EMBEDDING_CRON_HOUR_UTC`, `talent-twin-auto-approve` at `TALENT_TWIN_AUTO_APPROVE_CRON_HOUR_UTC`

**Checkpoint**: All 5 new tables created. GIN indexes on 8 source tables. 2 cron jobs scheduled. `pnpm supabase db reset` is clean. RLS verified.

---

## Phase 2 — Shared types (all parallel after Phase 1)

- [ ] T020 [P] Create `packages/types/talent-twin.ts` — `TalentTwinQA`, `AnswerPreview`, `RecruiterChatSession` interfaces mirroring the table columns, `CitationLink` type, `TalentTwinStatus` union (`'pending'|'approved'|'rejected'|'revoked'`), `SourceType` union (8 values)
- [ ] T021 [P] Create `packages/types/authorship-proof.ts` — `AuthorshipProof`, `AuthorshipSandboxSession`, `StylometricVector`, `KeystrokeTimingVector`, `ASTDiff`, `ErrorRecoveryVector` interfaces
- [ ] T022 [P] Create Zod schemas in `packages/types/zod/talent-twin.ts` mirroring request bodies for all 8 API routes
- [ ] T023 [P] Create Zod schemas in `packages/types/zod/authorship-proof.ts` mirroring request bodies for `POST /api/v1/students/authorship-proof/request` and `POST /api/v1/students/authorship-proof/{id}/complete-session`

---

## Phase 3 — RAG pipeline (US1) [critical path]

### 3a. Source adapters (parallel)

- [ ] **T030 [P]** [US1] Create `apps/web/src/lib/talent-twin/source-adapter.ts` — `SourceAdapter` interface + registry; adapter registration for all 8 source types
- [ ] T031 [P] [US1] Create adapter for 002 GitHub commits (`apps/web/src/lib/talent-twin/adapters/github-commits.ts`) — `fetchChunks(studentId)` returns array of `{ text, source_type, source_id, title, url }`
- [ ] T032 [P] [US1] Create adapter for 002 pull requests (`apps/web/src/lib/talent-twin/adapters/github-prs.ts`)
- [ ] T033 [P] [US1] Create adapter for 003 DSA coach chat (`apps/web/src/lib/talent-twin/adapters/dsa-chat.ts`)
- [ ] T034 [P] [US1] Create adapter for 004 mock-interview transcripts (`apps/web/src/lib/talent-twin/adapters/mock-interview.ts`)
- [ ] T035 [P] [US1] Create adapter for 004 faculty grade comments (`apps/web/src/lib/talent-twin/adapters/faculty-comments.ts`)
- [ ] T036 [P] [US1] Create adapter for 006 IDE telemetry summaries (`apps/web/src/lib/talent-twin/adapters/ide-summary.ts`)
- [ ] T037 [P] [US1] Create adapter for 007 curriculum lesson completions + feedback (`apps/web/src/lib/talent-twin/adapters/curriculum.ts`)
- [ ] T038 [P] [US1] Create adapter for 008 collab artifacts (`apps/web/src/lib/talent-twin/adapters/collab-artifact.ts`)

### 3b. Chunking + embedding (parallel with 3a)

- [ ] **T040 [P]** [US1] Create `apps/web/src/lib/talent-twin/chunker.ts` — `chunkText(text, chunkSize=500, overlap=50): Chunk[]`; text splitter with 500-char window, 50-char overlap; produces `{ text, index, token_count }` per chunk
- [ ] **T041 [P]** [US1] Create `apps/web/src/lib/talent-twin/embedding-service.ts` — `embedChunks(studentId, chunks): Promise<void>`; calls the 007 embedding service (MiniLM-L6-v2, 384-dim), upserts to `talent_twin_embeddings` table with `(student_id, chunk_id, embedding vector(384), source_type, source_id, chunk_text, created_at)`
- [ ] **T042 [P]** [US1] Create `apps/web/src/lib/talent-twin/rag.ts` — `ask(studentId, question, options): Promise<RAGResult>`; (1) embed question via MiniLM, (2) cosine-similarity top-K (WHERE student_id = ?), (3) format context string, (4) build LLM prompt with system template, (5) call 004 LLM provider, (6) extract citations, (7) return answer + citations
- [ ] **T043 [P]** [US1] Create `apps/web/src/lib/talent-twin/citation-formatter.ts` — `validateCitations(answer, retrievedChunks): CitationLink[]`; parses markdown citations from LLM output, validates each URL exists in the retrieved chunk set, drops hallucinated citations

### 3c. Edge function + cron

- [ ] **T045** [US1] Create `supabase/functions/talent-twin-embedding-job/index.ts` — weekly cron; iterates all opted-in students, for each: fetch source artifacts via adapters → chunk → embed → upsert; emits `{ student_id, chunks_count, source_types, duration_ms }`; handles partial failures per student (one student failing does not abort the batch)
- [ ] T046 [P] [US1] Create `supabase/functions/talent-twin-auto-approve/index.ts` — hourly cron; scans `answer_preview` WHERE `auto_approve_at < now()` AND `status = 'pending'`; for each: set status to `'approved'`, copy citation links to `talent_twin_qa_log`, delete the `answer_preview` row

### 3d. RAG tests (depend on 3b)

- [ ] T047 [P] [US1] Unit test `tests/unit/rag-pipeline.test.ts` — mock embedding service + LLM provider; assert correct prompt format, citation validation, fallback for no relevant chunks
- [ ] T048 [P] [US1] Unit test `tests/unit/chunker.test.ts` — assert 500-char windows, 50-char overlap, correct token count estimation
- [ ] T049 [P] [US1] Unit test `tests/unit/citation-formatter.test.ts` — assert valid citations preserved, hallucinated citations dropped, correct markdown parsing
- [ ] T050 [P] [US1] Unit test `tests/unit/source-adapter.test.ts` — mock each source table; assert each adapter returns correct `{ text, source_type, source_id, title, url }` shape

---

## Phase 4 — Recruiter chat UI (US1) [parallel with Phase 3 after 3b]

- [ ] **T055 [P]** [US1] Create `apps/web/src/app/(recruiter)/candidates/[studentId]/talent-twin/page.tsx` — recruiter chat interface: message list, question input, citation links rendered as hyperlinks, session sidebar
- [ ] T056 [P] [US1] Create `apps/web/src/app/(recruiter)/candidates/[studentId]/talent-twin/chat-message.tsx` — message bubble component with citation rendering
- [ ] T057 [P] [US1] Create `apps/web/src/app/(recruiter)/candidates/[studentId]/talent-twin/citation-link.tsx` — inline citation link that opens the original artifact URL in a new tab
- [ ] T058 [P] [US1] Create `apps/web/src/app/(recruiter)/candidates/[studentId]/talent-twin/pending-banner.tsx` — "Your question has been submitted. The student will review it before the answer is visible." banner for pending answers

---

## Phase 5 — Privacy center integration (US1) [parallel with Phase 4]

- [ ] **T060 [P]** [US1] Extend `apps/web/src/app/(student)/settings/signals/page.tsx` — add "AI Talent Twin" card to the signal sources list with opt-in toggle + pending queue link
- [ ] **T061 [P]** [US1] Create `apps/web/src/app/(student)/settings/signals/talent-twin-card.tsx` — talent twin opt-in toggle card with status pill, pending count badge, and "View Pending Answers" link
- [ ] T062 [P] [US1] Create `apps/web/src/app/(student)/talent-twin/page.tsx` — pending answers preview queue listing all pending answers with approve/reject/edit actions
- [ ] T063 [P] [US1] Create `apps/web/src/app/(student)/talent-twin/answer-card.tsx` — single pending answer card with generated answer, citations, approve button, reject button + edit textarea
- [ ] T064 [P] [US1] Create `apps/web/src/app/(student)/talent-twin/history.tsx` — paginated history of approved/rejected answers
- [ ] T065 [P] [US1] Create `apps/web/src/app/(student)/talent-twin/opt-in-button.tsx` — reusable opt-in toggle (also used in signals page)

---

## Phase 6 — API routes (US1) [parallel with Phases 4+5]

- [ ] **T070 [P]** [US1] Create `apps/web/src/app/api/v1/recruiters/talent-twin/ask/route.ts` — POST; recruiter auth, Zod validation, check opt-in status, call RAG pipeline, insert answer_preview, insert talent_twin_qa_log, return response
- [ ] **T071 [P]** [US1] Create `apps/web/src/app/api/v1/recruiters/talent-twin/sessions/[id]/route.ts` — GET; recruiter auth, fetch session with questions, return paginated list
- [ ] T072 [P] [US1] Create `apps/web/src/app/api/v1/students/talent-twin/pending/route.ts` — GET; student auth, fetch pending answers
- [ ] T073 [P] [US1] Create `apps/web/src/app/api/v1/students/talent-twin/answers/[id]/approve/route.ts` — POST; student auth, approve answer, copy to qa_log, delete preview
- [ ] T074 [P] [US1] Create `apps/web/src/app/api/v1/students/talent-twin/answers/[id]/reject/route.ts` — POST; student auth, reject with optional edit, update qa_log, delete preview
- [ ] T075 [P] [US1] Create `apps/web/src/app/api/v1/students/talent-twin/opt-in/route.ts` — POST; toggle opt-in, handle enable/revoke side effects (embedding queue, purge), write signal_audit

---

## Phase 7 — Authorship proof (US2) [parallel with Phases 4-6]

### 7a. Stylometric infrastructure

- [ ] **T080 [P]** [US2] Create `apps/web/src/lib/authorship/stylometric-extractor.ts` — `extractSessionVector(sandboxData): StylometricVector`; computes keystroke timing histogram, AST-diff sequence summary, error-recovery vector
- [ ] **T081 [P]** [US2] Create `apps/web/src/lib/authorship/baseline-comparator.ts` — `compareToBaseline(sessionVector, studentId): { similarity, confidence }`; fetches 30+ days of ide_sessions/ide_aggregates, computes baseline vector, cosine similarity, maps to confidence score
- [ ] **T082 [P]** [US2] Create `apps/web/src/lib/authorship/badge-minter.ts` — `mintBadge(proofId, studentId, confidenceScore): Promise<{ url }>`; reuses 004 credential-issue flow to mint W3C VC with `claim = "VerifiedOriginalWork"` and `confidence_score`

### 7b. API routes + sandbox UI

- [ ] **T085 [P]** [US2] Create `apps/web/src/app/api/v1/students/authorship-proof/request/route.ts` — POST; check 006 baseline sufficiency, check feature flag, INSERT authorship_proof row, return sandbox URL
- [ ] **T086 [P]** [US2] Create `apps/web/src/app/api/v1/students/authorship-proof/[id]/complete-session/route.ts` — POST; validate session data, call stylometric-extractor, call baseline-comparator, if similarity ≥ threshold call badge-minter, update authorship_proof, return result
- [ ] **T087 [P]** [US2] Create `apps/web/src/app/api/v1/students/authorship-proof/[id]/badge/route.ts` — GET return badge status + metadata
- [ ] T088 [P] [US2] Create `apps/web/src/app/api/v1/public/authorship-proof/[id]/verify/route.ts` — GET public verification endpoint; return credential status + W3C VC JSON
- [ ] **T089 [P]** [US2] Create `apps/web/src/app/(student)/projects/[projectId]/authorship-proof/page.tsx` — sandboxed writing session page with editor (reuses 008's sandbox), progress indicator, instructions
- [ ] T090 [P] [US2] Create `apps/web/src/app/(student)/projects/[projectId]/authorship-proof/sandbox-editor.tsx` — Monaco editor wrapper with keystroke capture, AST-diff tracking, error-recovery monitoring; emits session data on completion
- [ ] T091 [P] [US2] Create `apps/web/src/app/(student)/projects/[projectId]/authorship-proof/progress-indicator.tsx` — progress bar showing keystroke events vs minimum, session duration vs minimum

### 7c. Authorship tests

- [ ] T092 [P] [US2] Unit test `tests/unit/stylometric-extractor.test.ts` — sample keystroke timing data; assert correct histogram bins, AST-diff sequence summary, error-recovery vector
- [ ] T093 [P] [US2] Unit test `tests/unit/baseline-comparator.test.ts` — mock 006 ide_sessions/ide_aggregates; assert similarity score, confidence mapping, insufficient data error
- [ ] T094 [P] [US2] Unit test `tests/unit/badge-minter.test.ts` — mock 004 credential-issue flow; assert W3C VC JSON structure, revocation registry entry

---

## Phase 8 — Cross-cutting tests

- [ ] T100 [P] [US1] E2E `tests/e2e/recruiter-talent-twin-ask.spec.ts` — sign in as recruiter, navigate to candidate profile, ask a question, assert pending answer, assert citation links
- [ ] T101 [P] [US1] E2E `tests/e2e/student-preview-queue.spec.ts` — sign in as student, view pending answers, approve one, reject one with edit, assert recruiter sees edited answer
- [ ] T102 [P] [US1] E2E `tests/e2e/student-opt-in.spec.ts` — toggle talent twin opt-in, toggle off, assert recruiter gets 403 after revoke
- [ ] T103 [P] [US2] E2E `tests/e2e/authorship-proof-request.spec.ts` — request proof, complete sandbox session with sufficient keystrokes, assert badge minted with confidence score
- [ ] T104 [P] [US2] E2E `tests/e2e/authorship-proof-verify.spec.ts` — verify a completed badge via public endpoint, assert W3C VC JSON, verify revoked badge returns revoked status
- [ ] T105 [P] [US1] E2E `tests/e2e/talent-twin-privacy-revoke.spec.ts` — recruiter asks questions, student revokes access, assert recruiter gets 403, assert talent_twin_qa_log has `status='revoked'` for all rows
- [ ] T106 [P] [US1] E2E `tests/e2e/talent-twin-no-cross-student.spec.ts` — seed 2 students, ask about student A, assert no student B data in answer, assert citation links point only to student A's artifacts
- [ ] T107 [P] [US1] E2E `tests/e2e/talent-twin-auto-approve.spec.ts` — set TALENT_TWIN_AUTO_APPROVE_HOURS=0, ask question, assert answer is immediately visible to recruiter (no pending state)

---

## Phase 9 — Cross-cutting polish

- [ ] T110 [P] Update `AGENTS.md` to reference the active 010 plan
- [ ] T111 [P] Update top-level `README.md` with one paragraph describing AI Talent Twin + Authorship Proof
- [ ] T112 [P] Add `specs/010-ai-talent-twin/rollout-runbook.md` — operator runbook for staged rollout per quickstart.md §6
- [ ] T113 [P] Add `pnpm test:010` aggregator script to root `package.json` that runs all 010-tagged E2E and unit tests
- [ ] T114 [P] Run a final `pnpm lint && pnpm typecheck` from the monorepo root and resolve any new violations

---

## Parallel Opportunities

- Phase 0 (T001-T006) all parallel.
- Phase 1 (T010-T017) — T010 is the critical-path file; T011-T017 add DDL blocks in parallel.
- Phase 2 (T020-T023) all parallel after Phase 1.
- Phase 3a (T030-T038) all parallel; 3b (T040-T043) all parallel with 3a; 3c (T045-T046) all parallel after 3b.
- Phases 4 (T055-T058), 5 (T060-T065), and 6 (T070-T075) all parallel after Phase 2 + Phase 3b.
- Phase 7a (T080-T082) and 7b (T085-T091) all parallel after Phase 2; 7b depends on 7a for the badge minter.
- Phase 8 (T100-T107) all parallel after their respective dependencies.
- Phase 9 (T110-T114) last (consolidation).

## Task Count Summary

| Phase | Tasks | Critical Path |
|---|---|---|
| 0 — Pre-flight | 6 | — |
| 1 — Migration 053 | 8 | T010 |
| 2 — Shared types | 4 | T020 |
| 3 — RAG pipeline | 15 | T030, T040, T041, T042, T043, T045 |
| 4 — Recruiter chat UI | 4 | T055 |
| 5 — Privacy center integration | 6 | T060, T061 |
| 6 — API routes (US1) | 6 | T070, T071 |
| 7 — Authorship proof | 12 | T080, T081, T082, T085 |
| 8 — Tests | 8 | T100, T103 |
| 9 — Polish | 5 | T113 |
| **Total** | **57** | |

## Rollout Recommendation

1. Land Phases 0-1 + Phase 2 in sprint 1 (foundation; migration + types).
2. Land Phases 3 + 4 + 6 in sprint 2 (RAG pipeline + recruiter chat + API routes).
3. Land Phase 5 in sprint 3 (privacy center integration + student preview queue).
4. Land Phase 7 in sprint 4 (authorship proof — depends on 006 IDE telemetry maturity).
5. Land Phase 8 + Phase 9 in parallel with sprint 3/4 finish.
6. Cohort rollout dates per quickstart.md §6.
