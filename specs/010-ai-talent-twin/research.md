# Phase 0 Research: 010 — AI Talent Twin

**Date**: 2026-06-08
**Status**: Decisions ratified; ready for Phase 1

Eight architectural decisions for feature 010. Each captures the choice, the rejected alternatives, and the rationale.

---

## D1. RAG over fine-tuning for per-student Q&A

**Decision**: Use Retrieval-Augmented Generation (RAG) with per-student pgvector corpus isolation. The LLM is never fine-tuned per student; instead, on each recruiter question, the system retrieves the top-K relevant chunks from the target student's embedded artifacts and includes them in the LLM prompt.

**Alternatives considered**:
- **Per-student fine-tuned model** (rejected — would require N models for N students; cost-prohibitive at 50K scale; requires re-fine-tuning on every new artifact; per-student data isolation is not guaranteed by the model;auditing what the model "knows" is impossible)
- **Hybrid RAG + fine-tuning** (rejected — adds complexity of maintaining both pipelines; no clear recall gain for the recruiter Q&A use case where retrieved context is short and structured)
- **No RAG — LLM trained only on public student profile** (rejected — loses all the rich artifact signal that differentiates the talent twin from a simple resume summary)

**Rationale**: RAG gives us zero training cost, instant-up-to-date answers (new artifacts are available as soon as they are embedded), auditable source citations (every answer links to the source), and per-student data isolation by construction — the LLM prompt is assembled from a single student's chunks. Fine-tuning is deferred to v2 for high-query-frequency alumni.

**Failure modes**:
- Low-recall retrieval (no relevant chunks found) → graceful "I couldn't find information" response
- LLM hallucinates a citation → `citation-formatter` validates that every cited URL exists in the retrieved set; if not, the citation is dropped

---

## D2. Chunking strategy: 500-character windows with 50-character overlap

**Decision**: Text chunks are 500 characters with a 50-character overlap, per source document. Chunks are created at opt-in time and stored in a `talent_twin_chunks` table (or equivalent embedding storage) keyed by `(student_id, source_type, source_id)`.

**Alternatives considered**:
- **Semantic chunking (paragraph/sentence boundaries)** (rejected — source artifacts vary widely: a commit description may be 200 chars, a collab transcript paragraph may be 2000 chars. Fixed-size windows with small overlap give predictable chunk count and consistent embedding quality)
- **200-char chunks** (rejected — too short for meaningful semantic context; would increase chunk count 2.5x)
- **1000-char chunks** (rejected — may exceed MiniLM's 256-token effective context; 500 chars ≈ 125 tokens is safe)
- **No overlap** (rejected — risks losing context at chunk boundaries for questions that span the boundary)

**Rationale**: 500 chars (≈125 tokens) is well within MiniLM-L6-v2's effective input length, produces predictable chunk counts (a 2000-char commit description → 4-5 chunks), and the 50-char overlap ensures boundary-spanning questions still retrieve relevant context.

**Per-student cap**: 500 most-recent chunks per source type (7 source types × 500 = 3,500 chunks max per student). At 384-dim × float32 = 1,536 bytes per chunk vector = ~5.4 MB per student worst case. 50K students × 5.4 MB = ~270 GB raw, reduced via daily-only update + cold tiering.

---

## D3. Embedding model: `all-MiniLM-L6-v2` (384-dim), reusing 007's setup

**Decision**: Use the exact same `sentence-transformers/all-MiniLM-L6-v2` model already deployed for 007. No new model deployment, no new embedding infrastructure.

**Alternatives considered**:
- `text-embedding-3-small` (OpenAI, 1536-dim) — rejected: 4× the index size; per-call cost; MiniLM is already deployed and sufficient for short-chunk similarity
- `BAAI/bge-base-en-v1.5` (768-dim) — rejected: would require a second model instance; marginal gain for structured Q&A context
- Cohere embed-english-v3.0 (1024-dim) — rejected: cost and operational complexity

**Rationale**: MiniLM-L6-v2 is fast (< 50ms per chunk on CPU), Apache 2.0 licensed, MTEB-validated, and already running in production for 007. The 384-dim HNSW index from 007 can host 010's chunks in the same vector namespace partitioned by `student_id`. No new model means zero operational risk for the embedding path.

---

## D4. Recruiter prompt template structure

**Decision**: A structured system prompt that enforces (a) per-student isolation, (b) citation format, (c) "I don't know" fallback, and (d) token budget.

**Template**:

```
SYSTEM: You are the AI Talent Twin for {student_name}, a {role} at {college}. 
You answer questions from recruiters about this student's skills, work, and approach.
You have access to excerpts from the student's real work on Antarix — GitHub commits, 
DSA practice, mock interviews, collab sessions, coding telemetry, placement predictions, 
course feedback, and faculty comments.

RULES:
1. Answer based ONLY on the context provided below. Do NOT use any external knowledge.
2. If the context does not contain relevant information, say: "I couldn't find information 
   about that in {student_name}'s work artifacts. Try rephrasing or asking about their 
   projects, skills, or technical approach."
3. Every factual claim MUST include a citation in the format:
   [Source: {type} — {title}]({url})
   Do NOT invent citations. Only cite sources from the context.
4. Be specific — reference actual project names, technologies, and outcomes from the context.
5. Maximum response length: {max_tokens} tokens.
6. Do NOT reveal that you are an AI or LLM. You are the student's AI Talent Twin.

CONTEXT:
{retrieved_chunks_formatted}

USER QUESTION: {recruiter_question}
```

**Alternatives considered**:
- **No system prompt — pure context injection** (rejected — the LLM may use pre-training knowledge about the student's college or generic skill stereotypes; the system prompt forces evidence-only answers)
- **Multi-turn conversation history** (rejected — first version is single-turn Q&A; conversation history may be added in v2)
- **JSON-only responses** (rejected — the recruiter chat UX expects natural prose; citations are inline markdown links)

**Rationale**: The system prompt is the privacy and quality gate. Rule 1 enforces per-student isolation. Rule 3 prevents hallucinated citations. Rule 4 ensures factual specificity. The template is stored in a `TALENT_TWIN_SYSTEM_PROMPT` env var for hot-swap without deployment.

---

## D5. Privacy gate design: opt-in default OFF, pending-answer preview, hash-only audit

**Decision**: Three-layer privacy:
1. **Opt-in toggle** in `/settings/signals` (006 privacy center) — default OFF. Student must explicitly enable the talent twin.
2. **Pending-answer preview** — every answer is held in `answer_preview` until the student approves, rejects, or 24h auto-approve expires. Recruiters see "Your question has been submitted" until approval.
3. **Hash-only audit** — `talent_twin_qa_log` stores SHA-256 hashes of question and answer, never the raw text. The `answer_preview` table stores raw text temporarily (auto-purged on approve/reject).

**Alternatives considered**:
- **Direct answer — no preview** (rejected — students must have control over what recruiters see about them; pending preview is essential for DPDP compliance and student trust)
- **No hashing in audit log — store raw Q&A** (rejected — DPDP right-to-erasure means we must be able to delete raw Q&A; hashing makes the audit log immutable while honoring deletion)
- **Global opt-in (all students on by default)** (rejected — violates DPDP Section 6 explicit consent; default OFF is the only safe posture)

**Rationale**: The three-layer approach satisfies DPDP Act 2023 (consent, control, erasure) while giving recruiters near-real-time answers (24h auto-approve is the safety valve). The hash-only audit log preserves the forensic chain while achieving erasure compliance — the raw data lives only in the ephemeral `answer_preview` table which is purged on action.

---

## D6. Stylometric fingerprint approach (authorship proof)

**Decision**: Combine two vectors — (1) a **baseline vector** from 006 IDE telemetry (30+ days of typing cadence, refactor distance, error-recovery latency) and (2) a **session vector** from a sandboxed writing session (keystroke inter-key latency histogram, AST-diff sequence, error-recovery latency). Compare via cosine similarity; if ≥ 0.7, mint the badge.

**Baseline vector** (from `ide_aggregates` + `ide_sessions`):
- `mean_keystrokes_per_minute` (per active hour)
- `keystroke_per_minute_hourly_distribution` (24-value array — normalized per hour)
- `mean_refactor_distance` (over all sessions)
- `mean_error_resolution_latency_ms`
- `p95_error_resolution_latency_ms`
- `active_time_per_day_avg_minutes`
- `language_distribution_entropy`

**Session vector** (from sandbox):
- `keystroke_inter_key_latency_histogram` (10 bins: 50-100, 100-150, ..., 450-500ms)
- `ast_diff_sequence_vector` (mean nodes_added, mean nodes_removed, max_depth_delta)
- `error_recovery_latency_ms`
- `total_keystroke_events` (≥ 100 required)
- `total_active_seconds` (≥ 300 required)

**Alternatives considered**:
- **Full ZK circuit** (rejected — not production-ready; would require a circuit compiler, trusted setup, and gas costs; deferred to v2)
- **LLM style analysis** (rejected — LLM style detection is unreliable and can be gamed)
- **Keystroke dynamics only** (rejected — keystroke rhythm alone is insufficient; code evolution (AST-diff) provides complementary signal)
- **Text authorship attribution (stylometry on written prose)** (rejected — the v1 focus is code authorship; prose stylometry is a v2 candidate)

**Rationale**: The two-vector approach reuses existing 006 data (baseline) and 008 sandbox infrastructure (session). Cosine similarity is a well-understood, deterministic comparison method that produces an auditable score. The 0.7 threshold is the standard minimum for "strong similarity" in stylometric research; it can be tuned post-launch.

**Confidence score** mapping:
- similarity ≥ 0.95 → confidence 95-100
- similarity 0.85-0.94 → confidence 80-94
- similarity 0.75-0.84 → confidence 65-79
- similarity 0.70-0.74 → confidence 50-64
- similarity < 0.70 → no badge minted

---

## D7. Source adapter pattern for heterogeneous artifact retrieval

**Decision**: Implement a `SourceAdapter` interface that abstracts over the 7 source tables (GitHub from 002, DSA coach from 003, mock-interview from 004, collab sessions from 008, IDE telemetry from 006, placement prediction from 002, faculty grades from 004, curriculum from 007). Each adapter implements `fetchChunks(studentId, options): Promise<ArtifactChunk[]>`.

**Alternatives considered**:
- **Single materialized view** (rejected — would require modifying 6+ existing schemas; violates additive-only principle)
- **ETL to a unified `talent_twin_source_artifacts` table** (rejected — duplicate storage; sync lag)
- **RAW SQL UNION ALL** (rejected — brittle; every new source type requires a schema change to the query)

**Rationale**: The adapter pattern keeps each source query isolated, testable, and independently deployable. Adding a new source type in v2 requires only a new adapter file and registration. The adapters are called by the embedding job (batch) and by the RAG pipeline (on-demand retrieval — though in v1, retrieval will query the pre-computed embeddings, not the raw source tables, to avoid latency).

**Source types** (v1):
- `github_commit` (002 — `github_commits`)
- `github_pr` (002 — `pull_requests` + `pull_request_descriptions`)
- `dsa_chat` (003 — `dsa_coach_chat_logs`)
- `mock_interview` (004 — `mock_interview_transcripts`)
- `collab_transcript` (008 — `collab_artifacts`)
- `ide_telemetry_summary` (006 — `ide_aggregates` score breakdown)
- `placement_prediction` (002 — `placement_predictions` reasoning text)
- `faculty_grade_comment` (004 — `faculty_grade_comments`)
- `curriculum_completion` (007 — `curriculum_lessons` + `lesson_feedback`)

---

## D8. Feature-flagged rollout with cohort gating

**Decision**: Both US1 and US2 ship behind their own feature flags (`010_talent_twin`, `010_authorship_proof`), both default OFF. Rollout order:

- **Week 1** — `010_talent_twin` to 5% of students (invited), no recruiters yet. Internal testing of the RAG pipeline + pending-answer flow.
- **Week 2** — `010_talent_twin` to 25% of students + 5 partner recruiters. Begin recruiter Q&A.
- **Week 3** — `010_talent_twin` to 100% of students who opt in, all partner recruiters.
- **Week 4** — `010_authorship_proof` to 10% of students with ≥ 30 days IDE telemetry.
- **Week 6** — `010_authorship_proof` to 100% eligible students.

**Alternatives considered**:
- **Both features ship together** (rejected — authorship proof depends on 006 telemetry maturity; talent twin is independent)
- **No feature flag — ship directly** (rejected — violates constitution principle VI; too risky for a recruiter-facing surface)

**Rationale**: The staged rollout follows the same pattern as 006/007/008. US1 can ship as soon as the RAG pipeline and privacy center integration are ready; US2 waits for IDE telemetry adoption to reach critical mass (≥ 30 days of baseline data for a meaningful cohort).

---

## Cross-cutting decisions (inherited from 004/007)

- **LLM cost caps**: Reuse 004's `WEEKLY_TOKEN_CAP_DEFAULT` and `MONTHLY_TENANT_TOKEN_CAP_DEFAULT` via `packages/config/llm-cost-caps.ts` for the RAG pipeline. New env var `TALENT_TWIN_WEEKLY_TOKEN_CAP` (default 10000) per recruiter per week.
- **Migrations land additive (053)**: No destructive changes. The migration is independently reversible via `pnpm supabase migration repair --status reverted 053`.
- **All new edge functions emit structured logs** to `supabase.functions.invoke_log` for the existing observability stack.
- **Feature flags via existing `feature_flags` table** (added in 002, extended in 003, 004, 006, 007): `010_talent_twin` and `010_authorship_proof` default OFF.
- **RLS on every new table**: students see own data; recruiters see only approved answers for opted-in students; service role full access.
