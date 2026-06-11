# Feature Specification: 010 — AI Talent Twin

**Feature Branch**: `010-ai-talent-twin`
**Created**: 2026-06-08
**Status**: Draft
**Builds on**: 001 (foundation) + 002 (verified skill platform, GitHub commits, placement prediction) + 003 (engage & showcase, DSA coach chat) + 004 (defensible moat, mock-interview transcripts, credential-issue flow, configurable LLM provider) + 006 (deep-signal-capture, IDE telemetry summaries) + 007 (adaptive learning graph, curriculum lesson completions + feedback) + 008 (collaborative mode, collab session transcripts)
**Migration**: `053_talent_twin.sql` (additive, 1 new table + indexes on existing tables)
**Score contribution**: 0% (insight surface only; does not modify Skill Proof Score)

## Why this exists

Recruiters today see a flat candidate profile — skills, projects, scores. They cannot ask "how did this student debug a real production issue?" or "show me a time they refactored under pressure." The AI Talent Twin gives every recruiter a RAG-powered interview clone of each student, answering questions sourced from the student's actual work artifacts. Separately, the Code Authorship Proof Badge gives employers cryptographic confidence that a piece of code was genuinely written by the named student — not by an LLM, not by a teammate. Together they convert a static profile into a live, auditable, recruiter-interactive credential.

**Why RAG over fine-tuning**: Fine-tuning a model per student would require (a) generating per-student training sets from heterogeneous artifact types, (b) hosting N fine-tuned models for N students (cost-prohibitive at 50K scale), (c) re-fine-tuning whenever new artifacts arrive. RAG gives us zero training cost, instant-up-to-date answers, auditable source citations, and per-student data isolation by construction — the LLM never sees text outside the retrieved student's corpus. RAG is the correct architectural choice for v1; fine-tuning may be revisited for high-query-frequency alumni (v2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — AI Talent Twin for Recruiters (RAG-based; Priority: P1)

A recruiter from a partner company opens a student's candidate profile on Antarix. Below the Skill Proof Score and the project gallery, they see an "Interview AI Clone" button. They click it and land on a chat interface. They type: "Describe a time Priya debugged a flaky test." The system responds with a 3-paragraph answer citing two GitHub PRs where the student fixed CI flakiness and one collab session transcript where they pair-debugged a timeout. Each citation is a hyperlink back to the original artifact. The recruiter asks follow-ups and drills into the evidence. Behind the scenes, the system embedded the student's artifacts into pgvector at opt-in time, and on each question it embeds the query, performs a cosine-similarity top-8 retrieval privately within the student's corpus, formats a prompt with the retrieved chunks, and streams the answer with inline citations.

**Why this is P1**: This is the highest-leverage recruiter surface in the platform. It converts a static profile into an interactive interview, differentiates Antarix from any portfolio or resume, and reuses every existing artifact source (002–008) without modifying them.

**Independent test**: Seed a student with 3 GitHub PR descriptions, 1 mock-interview transcript, 2 DSA coach chat logs, and 1 collab session transcript — all stored in their respective source tables. Call `POST /api/v1/recruiters/talent-twin/ask` with `{ student_id, question: "How does this student approach debugging?" }`. Assert: response contains ≥ 2 citation links, each citation references a unique source artifact, the answer text does not contain artifacts from other students, and the `talent_twin_qa_log` row is written with non-null `question_hash`, `answer_hash`, and `citation_links`.

**Acceptance scenarios**:
1. **Given** a recruiter viewing a student who has opted in and has ≥ 1 source artifact, **when** they click "Interview AI Clone", **then** a chat interface opens with a pre-filled system greeting: "I'm {student_name}'s AI Talent Twin, built from their work on Antarix. Ask me anything."
2. **Given** a recruiter types a question about a student's skills, **when** the RAG pipeline completes, **then** the response includes exactly the citation format `[Source: {type} — {title}]({url})` for every fragment used, and the LLM never generates a citation that doesn't exist in the retrieved context.
3. **Given** a student with 8+ source chunks across 6 source types, **when** a recruiter asks a question, **then** `TALENT_TWIN_CITATION_LIMIT` (default 8) chunks are provided to the LLM, and the LLM's output is capped at `TALENT_TWIN_MAX_CONTEXT_TOKENS` (default 4000).
4. **Given** a recruiter asks a question about a student who has not opted in, **when** they hit the API, **then** the response is 403 with code `student_not_opted_in`.
5. **Given** a recruiter asks a question that has no relevant chunks (cosine similarity < 0.4 for all chunks), **when** the RAG pipeline completes, **then** the response is "I couldn't find information about that in {student_name}'s work artifacts. Try rephrasing or asking about their projects, skills, or technical approach."
6. **Given** a recruiter sends a question containing PII (email, phone), **when** the question is processed, **then** the answer is generated from the student's public corpus only, and the `talent_twin_qa_log` stores only a hash of the question — never the raw text.
7. **Given** a student revokes access, **when** the revoke propagates (≤ 60s), **then** all subsequent `POST /api/v1/recruiters/talent-twin/ask` requests for that student return 403, and `talent_twin_qa_log` rows for that student are queued for deletion.
8. **Given** a student with pending answers queue (preview mode), **when** a recruiter asks a question, **then** the question is added to the pending queue and the recruiter sees "Your question has been submitted. {student_name} will review it before the answer is visible."
9. **Given** a student approves a pending answer, **when** they click approve, **then** the answer becomes visible to the recruiter, and the `talent_twin_qa_log` row is updated with `status='approved'`.
10. **Given** a student rejects a pending answer, **when** they click reject with optional edit, **then** the recruiter sees the edited version (or "Question declined by student" if rejected without edit), and the `talent_twin_qa_log` row is updated with `status='rejected'`.

---

### User Story 2 — Code Authorship Proof Badge (Priority: P2)

A student has completed a high-value project — a real-time chat application — and wants to prove to a recruiter that they wrote every line themselves. They navigate to their project detail page and click "Request Authorship Proof". The system opens a sandboxed coding session (reusing 008's code sandbox + 004 anti-cheat infrastructure). The student writes a representative code sample (5-15 minutes). During the session, the system captures: keystroke timing vector (inter-key latency histogram), code evolution (AST-diff sequence from 006), and error-recovery latency. These combine into a stylometric fingerprint vector. Separately, the system retrieves the student's IDE telemetry stylometric baseline from 006 (typing cadence, refactor distance, error-recovery patterns across 30+ days). The two vectors are compared; if the cosine similarity ≥ 0.7, a "Verified Original Work" badge is minted as a W3C Verifiable Credential (reusing 004's credential-issue flow) with confidence score 0-100. The badge appears on the project card for employers to inspect.

**Why this is P2**: The badge is additive employer signal and increases credential trust but requires the 006 IDE telemetry baseline (≥ 30 days of data) and 004 anti-cheat infrastructure. It cannot ship before 006 is rolled out to a meaningful cohort.

**Independent test**: Seed a student with 30+ days of `ide_sessions` and `ide_aggregates` rows (stylometric baseline). Call `POST /api/v1/students/authorship-proof/request` with `project_id`. Complete a sandboxed session of 5+ minutes of typing. Assert: a `authorship_proof` row is created with `confidence_score` between 0 and 100, `vector_similarity` ≥ 0.7, and a `verifiable_credential_url` pointing to a valid W3C VC JSON document.

**Acceptance scenarios**:
1. **Given** a student with ≥ 30 days of IDE telemetry (006), **when** they request an authorship proof, **then** the sandboxed session captures keystroke timing (≥ 100 key events), code evolution (≥ 3 AST diffs), and error-recovery latency (if any errors occurred), and a stylometric vector is created.
2. **Given** a sandboxed session produces a stylometric vector with cosine similarity ≥ 0.7 against the 006 baseline, **when** the credential is issued, **then** a W3C Verifiable Credential is minted via the 004 credential-issue flow with `credentialSubject.claim = "VerifiedOriginalWork"`, `confidence_score`, and the proof contains the similarity hash.
3. **Given** a sandboxed session produces stylometric vector similarity < 0.7, **when** the proof is requested, **then** the badge is not minted, the student sees "Confidence too low (X/100). Try writing for longer or in a familiar environment.", and no credential is issued.
4. **Given** an employer views a project with a "Verified Original Work" badge, **when** they click the badge, **then** they see: confidence score, session metadata (date, duration, language), and a link to verify the W3C VC on-chain or via the verification API.
5. **Given** a student revokes a badge, **when** they click "Revoke Badge" on the project page, **then** the verifiable credential's revocation registry is updated (via 004 credential-revoke flow), and the badge disappears from the employer-facing view.

---

### Edge Cases

- **Student has zero source artifacts across all 7 source types** → RAG returns "I couldn't find any work artifacts for this student. They haven't completed any verified activities on Antarix yet."
- **Embedding service is down (002/007 pgvector unavailable)** → API returns 503 with `retry_after: 30` header; recruiter sees "AI Talent Twin is temporarily unavailable."
- **Student opts in during a recruiter's active chat session** → existing unanswered questions remain unanswered; new questions flow immediately.
- **Student's source artifacts exceed 500 chunks** → chunking caps at 500 most-recent per source type (5K total per student).
- **Recruiter asks a question exceeding 1000 characters** → truncated to 1000 characters before embedding; the recruiter is warned client-side.
- **Stylometric baseline has insufficient data (< 30 days or < 1000 keystroke events)** → authorship proof request returns 400 with `insufficient_baseline` code; the student is told to enable IDE telemetry for ≥ 30 days.
- **Sandboxed session is abandoned (< 30 seconds)** → discarded; no vector created.
- **Credential revocation (004) fails** → badge remains visible but the revoke button shows an error; a retry is queued for the next background job.
- **Two recruiters ask the same question simultaneously** → both questions are processed independently; same answer (or pending-queue) returned; no dedup.
- **Student is under 18 (Indian majority)** → talent twin is available (no age restriction on recruiter inquiry, only on opt-in consent which defaults OFF).

## Requirements *(mandatory)*

### Functional Requirements

#### RAG Pipeline (US1)
- **FR-001**: System MUST embed student work artifacts into pgvector (384-dim MiniLM-L6-v2, reusing 007's setup) on opt-in, with per-student chunking at 500 chars with 50-char overlap, capped at 500 most-recent chunks per source type.
- **FR-002**: System MUST support recruiter questions via a RAG pipeline that: (a) embeds the question, (b) performs cosine-similarity top-K (K = `TALENT_TWIN_CITATION_LIMIT`, default 8) within the requesting student's corpus only, (c) formats the retrieved chunks into a prompt, (d) calls the LLM (reusing 004 configurable provider) for answer generation with inline citations.
- **FR-003**: System MUST enforce per-student corpus isolation — the LLM prompt MUST contain only chunks from the target student's embedded artifacts; zero cross-student data leakage.
- **FR-004**: System MUST produce citations in the format `[Source: {type} — {title}]({url})` for every chunk used; every citation MUST link back to the original artifact viewable in the Antarix UI.
- **FR-005**: System MUST respect `TALENT_TWIN_MAX_CONTEXT_TOKENS` (default 4000) as the upper bound on LLM output tokens per answer.
- **FR-006**: System MUST log every Q&A interaction to `talent_twin_qa_log` with `question_hash`, `answer_hash`, `citation_links` (jsonb), and NEVER the raw question or answer text.

#### Student Privacy (US1)
- **FR-007**: Talent Twin MUST default to OFF for all students; opt-in is a single toggle in `/settings/signals` (006 privacy center).
- **FR-008**: Student MUST be able to preview every answer before it is recruiter-visible via a pending queue; answers are visible to recruiters only after student approval or 24-hour auto-approve (configurable via `TALENT_TWIN_AUTO_APPROVE_HOURS`).
- **FR-009**: Recruiter MUST NOT be able to ask questions about a student who has not opted in (403 `student_not_opted_in`).
- **FR-010**: Student MAY revoke access at any time; revocation MUST trigger deletion of all `talent_twin_qa_log` rows for that student within 60 seconds.
- **FR-011**: Student MAY reject a pending answer with an optional edited version; the recruiter sees the edited version if provided, or "Question declined by student" if rejected without edit.

#### Code Authorship Proof (US2)
- **FR-012**: System MUST capture a stylometric fingerprint during a sandboxed writing session (5-15 minutes), comprising: keystroke inter-key latency histogram (10 bins, 50-500ms), AST-diff sequence (≥ 3 diffs), and error-recovery latency vector.
- **FR-013**: System MUST compute a stylometric baseline from 006 IDE telemetry data (≥ 30 days, ≥ 1000 keystroke events) comprising: typing cadence (keystrokes per minute, hourly distribution), refactor distance average, error-recovery latency median.
- **FR-014**: System MUST compare the sandbox session vector against the 006 baseline via cosine similarity; if similarity ≥ 0.7, a "Verified Original Work" badge is minted with confidence score 0-100.
- **FR-015**: System MUST reuse 004's credential-issue flow to mint the badge as a W3C Verifiable Credential with `credentialSubject.claim = "VerifiedOriginalWork"` and `confidence_score`.
- **FR-016**: System MUST provide a verification API at `GET /api/v1/public/authorship-proof/{id}/verify` that returns the credential status (valid/revoked) without requiring authentication.

#### General
- **FR-017**: System MUST add `talent_twin_qa_log` table (append-only audit for Q&A interactions).
- **FR-018**: System MUST add GIN indexes on `(student_id, source_type)` for each source table referenced by the RAG pipeline to support efficient per-student chunk queries.
- **FR-019**: All 010 capabilities MUST ship behind feature flags in the existing `feature_flags` table: `010_talent_twin`, `010_authorship_proof`; both default OFF.
- **FR-020**: System MUST support `TALENT_TWIN_CHUNK_SIZE` (default 500), `TALENT_TWIN_CHUNK_OVERLAP` (default 50), `TALENT_TWIN_CITATION_LIMIT` (default 8), and `TALENT_TWIN_AUTO_APPROVE_HOURS` (default 24) as configurable env vars.

### Key Entities

- **talent_twin_qa_log** — append-only Q&A audit log. Columns: `id` (bigserial PK), `student_id` (FK users), `recruiter_id` (FK users), `question_hash` (text, SHA-256), `answer_hash` (text, SHA-256), `citation_links` (jsonb — array of `{ source_type, title, url }`), `status` (pending/approved/rejected), `edited_answer` (text, nullable — student edit), `revoked_at` (timestamptz, nullable), `created_at` (timestamptz).
- **answer_preview** — pending approval queue. Columns: `id` (uuid PK), `student_id` (FK users), `recruiter_id` (FK users), `recruiter_question` (text — stored because not yet approved; auto-purged on approve/reject), `llm_answer` (text — the generated answer before preview), `edited_answer` (text, nullable), `citation_links` (jsonb), `status` (pending/approved/rejected), `auto_approve_at` (timestamptz — when 24h timer expires), `created_at`, `approved_at`, `rejected_at`.
- **recruiter_chat_session** — one row per recruiter chat session with a talent twin. Columns: `id` (uuid PK), `recruiter_id` (FK users), `student_id` (FK users), `started_at`, `last_activity_at`, `question_count`, `ended_at`.
- **authorship_proof** — stylometric proof request. Columns: `id` (uuid PK), `student_id` (FK users), `project_id` (FK projects/artifacts), `session_vector` (jsonb — stylometric fingerprint), `baseline_similarity` (numeric, 0-1), `confidence_score` (int, 0-100), `verifiable_credential_url` (text, nullable), `status` (requested/completed/failed/revoked), `created_at`, `completed_at`.
- **authorship_sandbox_sessions** — per-session sandbox capture for stylometry. Columns: `id` (uuid PK), `proof_id` (FK authorship_proof), `keystroke_timing_vector` (jsonb — histogram), `ast_diff_sequence` (jsonb — array of diffs), `error_recovery_vector` (jsonb), `duration_seconds`, `created_at`.

## Out of Scope (Deferred to v2)

1. **Fine-tuned per-student model** — Defer; RAG is correct for v1. Fine-tuning may be revisited for high-query-frequency alumni.
2. **Multi-student comparison (recruiter asks "compare student A and B")** — Defer; would require cross-student RAG or multi-model orchestration.
3. **Real-time voice interview clone** — Defer; text-only chat for v1. Voice may follow in v2 using 008's LiveKit infra.
4. **Zero-knowledge proof circuit for authorship** — Defer; stylometric + sandbox approach is sufficient for v1. Full ZK circuit is a research project.
5. **Continuous authorship verification (every commit is signed)** — Defer; only on-demand proof requests for v1.
6. **Recruiter "ask a question" notification to student** — Defer; the pending queue is pull-based for v1. Push notification may follow.

## Success Criteria *(mandatory, measurable)*

### Measurable Outcomes

- **SC-RAG-001**: Mean RAG pipeline latency (question → answer with citations) ≤ 5s for p95 at 50K students.
- **SC-RAG-002**: ≥ 90% of recruiter answers contain ≥ 1 valid citation link that resolves to a real artifact URL.
- **SC-RAG-003**: Zero cross-student data leakage incidents in production (audited via `talent_twin_qa_log` hash chain).
- **SC-PRI-001**: ≥ 15% of students with active profiles opt into Talent Twin within 60 days of launch.
- **SC-PRI-002**: Median answer-preview approval time ≤ 2 hours (student-side).
- **SC-BADGE-001**: ≥ 5% of students with ≥ 30 days of IDE telemetry request an authorship proof within 90 days.
- **SC-BADGE-002**: ≥ 70% of authorship proof requests result in a minted badge (similarity ≥ 0.7).
- **SC-BADGE-003**: Credential verification API p95 response ≤ 500ms.

## Assumptions

- **Existing pgvector + MiniLM-L6-v2 setup from 007 is running in production** — 010 reuses the same embedding service, the same 384-dim vector index, and does not require a new model deployment.
- **The 004 configurable LLM provider client is available** for RAG answer generation; no new LLM abstraction is needed.
- **The 004 anti-cheat infrastructure and 008 code sandbox are available** for the authorship proof sandboxed session.
- **The 006 IDE telemetry database has ≥ 30 days of data for any student requesting an authorship proof** — students without the baseline are told to enable IDE telemetry first.
- **The 002 GitHub commit + PR data, 003 DSA coach chat data, 004 mock-interview data, 006 IDE telemetry, 007 curriculum data, and 008 collab session data all exist in their respective tables** with consistent `student_id` foreign keys.
- **Recruiters are authenticated and have a valid recruiter session** — recruiter auth is inherited from 002.
- **The feature flags `010_talent_twin` and `010_authorship_proof` default to OFF and are rolled out to cohorts** per the existing feature-flag convention.
- **Migration 053 is the next free migration number** (052 is the current last migration after 051+052 from 005).
- **No new tables are needed beyond `talent_twin_qa_log`, `answer_preview`, `recruiter_chat_session`, `authorship_proof`, and `authorship_sandbox_sessions`** — all source data lives in existing 002/003/004/006/007/008 tables.
- **GIN indexes on `(student_id, source_type)` are sufficient for per-student chunk queries** — no new composite indexes needed on existing tables.
