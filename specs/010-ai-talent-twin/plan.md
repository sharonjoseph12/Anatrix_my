# Implementation Plan: 010 — AI Talent Twin

**Branch**: `010-ai-talent-twin` | **Date**: 2026-06-08 | **Spec**: [spec.md](file.md)
**Input**: Feature specification from `specs/010-ai-talent-twin/spec.md`
**Builds on**: 001 (foundation) + 002 (verified skill platform, GitHub commits, placement prediction) + 003 (DSA coach chat) + 004 (mock-interview transcripts, configurable LLM provider, credential-issue flow, anti-cheat) + 006 (IDE telemetry summaries) + 007 (curriculum lesson completions + feedback, pgvector + MiniLM-L6-v2) + 008 (collab session transcripts, code sandbox)
**Migration**: `053_talent_twin.sql` (5 new tables, GIN indexes on existing source tables)

## Summary

Two recruiter-facing surfaces that turn static student work artifacts into interactive, verifiable credentials. US1 (P1) is a RAG-based AI Talent Twin that lets recruiters ask natural-language questions about a student and get answers with citations back to the original work. US2 (P2) is a Code Authorship Proof Badge that uses 006 stylometric baselines + a sandboxed writing session to mint a W3C Verifiable Credential attesting that code was genuinely written by the named student.

**Technical approach**: Reuse the entire 001-008 stack — Next.js 15, Supabase (pgvector, Edge Functions, RLS), 004 LLM client, 007 embedding service, 006 IDE telemetry pipeline, 008 code sandbox, 004 credential-issue flow. Add 1 SQL migration (053) creating 5 new append-only/audit tables and GIN indexes on 6+ existing source tables. Add 1 new Supabase Edge Function (`talent-twin-embedding-job`), 6 new Next.js API routes, 2 new UI pages (recruiter chat, student preview queue), 1 privacy-center integration, 1 authorship-proof sandbox flow. No new deployables, no new LLM provider, no new embedding model.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+ *(inherited)*
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, pgvector, sentence-transformers/all-MiniLM-L6-v2 (384-dim), 004 configurable LLM provider client
**Primary Dependencies (new)**: None — every dependency is already in the stack. 008's code sandbox and 004's credential-issue flow are consumed, not reimplemented.
**Storage**: PostgreSQL (via Supabase) + pgvector — 5 new tables in 1 additive migration (053); GIN indexes on existing source tables; no destructive changes.
**Testing**: Vitest (unit) + Playwright (e2e) *(inherited)*
**Target Platform**: Web (Next.js 15 App Router), Supabase Edge Functions (Deno) *(inherited)*
**Project Type**: Web service (multi-portal SaaS) + Edge Functions *(inherited)*
**Performance Goals (inherited)**: Dashboard p95 < 2s, API p95 ≤ 1s
**Performance Goals (new)**: RAG pipeline p95 ≤ 5s (embedding + retrieval + LLM generation); embedding rebuild full-pass ≤ 4h for 50K students; authorship proof sandbox boot p95 ≤ 3s; credential verification p95 ≤ 500ms
**Constraints (inherited)**: India market, opt-in privacy, RLS-enforced, feature-flagged, additive-only migrations
**Constraints (new)**: LLM uses 004 cost-cap pattern (`TALENT_TWIN_WEEKLY_TOKEN_CAP` per recruiter); per-student corpus isolation MUST be enforced at the pgvector query level (WHERE student_id = ?); no cross-student data leakage even in error paths
**Scale/Scope (inherited)**: 50K students Y2
**Scale/Scope (new)**: 5 new tables (append-only, low write volume — 1 Q&A log row per recruiter question = ~500 rows/day at 10% adoption); embedding storage: 50K students × avg 500 chunks × 384-dim × 4 bytes = ~38 GB raw vector storage; talent_twin_qa_log: ~50 rows/student/year × 50K = 2.5M rows/year

## Constitution Check

The project constitution (`.specify/memory/constitution.md`) principles are respected:

- **Additive-only schema** (1 new migration, 5 new tables, GIN indexes only — no DROP/ALTER on existing columns)
- **Privacy-first** (opt-in default OFF, per-student corpus isolation by construction, pending-answer preview, one-click revoke with 60s purge, question/answer hashed in audit log — never raw text)
- **Cost-aware** (RAG pipeline reuses 004 LLM cost caps per recruiter; embedding rebuild runs weekly off-peak)
- **Observability** (every Q&A interaction logged to `talent_twin_qa_log` with hashes and citation links; append-only)
- **Backward compatibility** (zero score contribution; no existing table modified; all source tables remain unchanged)
- **Reuse over rebuild** (no new embedding model, no new LLM provider, no new sandbox — all consumed from 004/006/007/008)

**No violation blocks Phase 0 / Phase 1 of this plan.** Recommended: run `/speckit-constitution` before code, but not blocking.

## Project Structure

### Documentation (this feature)

```text
specs/010-ai-talent-twin/
├── plan.md              # This file
├── research.md          # Phase 0 output — 8 new decisions
├── data-model.md        # Phase 1 output — 5 new entities, GIN indexes
├── quickstart.md        # Phase 1 output — env vars, migration 053, embedding rebuild
├── contracts/
│   └── api.md           # Phase 1 output — 8 API routes
├── checklists/
│   └── requirements.md  # From spec phase (12-item quality checklist)
└── tasks.md             # Phase 2 output — ~57 atomic tasks
```

### Source Code (repository root)

Inherits 001-008 layout unchanged. New files:

```text
supabase/
├── migrations/
│   └── 053_talent_twin.sql              # talent_twin_qa_log, answer_preview,
│                                        # recruiter_chat_session, authorship_proof,
│                                        # authorship_sandbox_sessions + GIN indexes
└── functions/
    └── talent-twin-embedding-job/       # weekly: chunk + embed all opted-in students' artifacts

apps/web/src/
├── app/
│   ├── (recruiter)/
│   │   └── candidates/
│   │       └── [studentId]/
│   │           └── talent-twin/         # Recruiter chat interface (US1)
│   │               ├── page.tsx
│   │               ├── chat-message.tsx
│   │               ├── citation-link.tsx
│   │               └── pending-banner.tsx
│   ├── (student)/
│   │   └── settings/
│   │       └── signals/                 # Extended privacy center (opt-in toggle for talent twin)
│   │           ├── page.tsx             # Extended with talent-twin card
│   │           └── talent-twin-card.tsx # New — opt-in toggle + pending queue link
│   │   └── talent-twin/
│   │       ├── page.tsx                 # Pending answers preview queue
│   │       ├── answer-card.tsx          # Approve/reject/edit UI
│   │       └── history.tsx              # Past Q&A history
│   ├── (student)/
│   │   └── projects/
│   │       └── [projectId]/
│   │           └── authorship-proof/    # Sandboxed session for authorship proof
│   │               ├── page.tsx
│   │               ├── sandbox-editor.tsx
│   │               └── progress-indicator.tsx
│   └── api/
│       ├── v1/
│       │   └── recruiters/
│       │       └── talent-twin/
│       │           ├── ask/route.ts              # POST — recruiter asks a question
│       │           └── sessions/[id]/route.ts    # GET — chat history
│       ├── v1/
│       │   └── students/
│       │       ├── talent-twin/
│       │       │   ├── pending/route.ts           # GET — pending answers
│       │       │   ├── answers/[id]/
│       │       │   │   ├── approve/route.ts       # POST — approve
│       │       │   │   └── reject/route.ts        # POST — reject
│       │       │   └── opt-in/route.ts            # POST — toggle opt-in
│       │       └── authorship-proof/
│       │           ├── request/route.ts           # POST — request proof
│       │           └── [id]/
│       │               ├── badge/route.ts         # GET — badge status
│       │               └── verify/route.ts        # GET — public verification
│       └── v1/
│           └── public/
│               └── authorship-proof/[id]/verify/route.ts  # GET — public verification
├── lib/
│   ├── talent-twin/
│   │   ├── rag.ts                          # RAG pipeline (embed → search → format → LLM)
│   │   ├── chunker.ts                      # Text chunker (500-char, 50-overlap)
│   │   ├── source-adapter.ts              # Adapters: fetch per-student from 002-008 tables
│   │   └── citation-formatter.ts          # [Source: {type} — {title}]({url})
│   ├── authorship/
│   │   ├── stylometric-extractor.ts       # Extract vector from sandbox session
│   │   ├── baseline-comparator.ts         # Compare vs 006 IDE telemetry baseline
│   │   └── badge-minter.ts                # Reuse 004 credential-issue flow
│   └── privacy/
│       └── talent-twin-opt-out.ts         # Revoke + purge handler

packages/
└── types/
    ├── talent-twin.ts                      # NEW
    └── authorship-proof.ts                 # NEW

tests/
├── e2e/
│   ├── recruiter-talent-twin-ask.spec.ts   # NEW
│   ├── student-preview-queue.spec.ts       # NEW
│   ├── student-opt-in.spec.ts             # NEW
│   ├── authorship-proof-request.spec.ts   # NEW
│   ├── authorship-proof-verify.spec.ts    # NEW
│   └── talent-twin-privacy-revoke.spec.ts # NEW
└── unit/
    ├── rag-pipeline.test.ts               # NEW
    ├── chunker.test.ts                    # NEW
    ├── citation-formatter.test.ts         # NEW
    ├── stylometric-extractor.test.ts      # NEW
    ├── baseline-comparator.test.ts        # NEW
    └── source-adapter.test.ts             # NEW
```

**Structure Decision**: Pure additive. No new top-level packages, no new build pipelines. The chat UI lives under `apps/web/src/app/(recruiter)/candidates/[studentId]/talent-twin/` and the preview queue under `apps/web/src/app/(student)/talent-twin/`. The privacy-center toggle is an extension card added to the existing `apps/web/src/app/(student)/settings/signals/` page. The authorship-proof sandbox reuses 008's editor component.

## Complexity Tracking

No constitution violations to justify. The biggest single net-new risk is **cross-student data leakage in RAG** — mitigated by strict `WHERE student_id = ?` on every pgvector similarity search, a per-student embedding namespace (partitioned by `student_id`), and a prompt-level guard that rejects contexts containing multiple `student_id` values. The second is **embedding storage cost** (~38 GB for 50K full-coverage students) — mitigated by tiered storage: hot chunks in pgvector, cold chunks in Supabase Storage (embeddings > 6 months old are archived and re-embedded on demand).

One explicit deferral (fine-tuned model, multi-student comparison, ZK proofs) is documented in spec.md "Out of Scope" with rationale.

## Re-Evaluation of Constitution Check (post-design)

Still no violations. Plan respects:
- **Additive-only schema** (1 new migration, 5 new tables, GIN indexes only — no DROP/ALTER on existing)
- **Privacy-first** (opt-in default OFF, per-student corpus isolation, pending-answer preview, hash-only audit log, 60s revoke purge)
- **Cost-aware** (RAG reuses 004 LLM caps, embedding rebuild weekly off-peak, cold storage for old embeddings)
- **Observability** (every Q&A interaction logged to append-only `talent_twin_qa_log` with citation links; authorship proof sessions logged to `authorship_sandbox_sessions`)
- **Backward compatibility** (zero score contribution; no existing table modified; all 002-008 source tables remain untouched)
- **Reuse over rebuild** (embedding from 007, LLM from 004, sandbox from 008, credential-issue from 004, privacy center from 006)
