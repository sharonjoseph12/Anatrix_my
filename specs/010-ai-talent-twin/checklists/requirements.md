# 010 — AI Talent Twin — Requirements Checklist

## US1 — RAG-based Talent Clone (Recruiter)

- [ ] **RAG-001** Recruiter can enter free-text question on a candidate profile or search results page
- [ ] **RAG-002** System retrieves relevant code fragments via vector similarity over `talent_twin_chunks.embedding` (HNSW index)
- [ ] **RAG-003** LLM generates a concise answer with numbered citations
- [ ] **RAG-004** Each citation is a clickable link to the source (commit URL, PR URL, session page)
- [ ] **RAG-005** Default scope: recruiter's current search results (up to 50 candidates)
- [ ] **RAG-006** Expanded scope: recruiter's entire search history or a single candidate
- [ ] **RAG-007** Privacy gate: only candidates with `talent_twin_opt_in = true` are queryable
- [ ] **RAG-008** Non-technical recruiters can use natural language (no boolean syntax required)
- [ ] **RAG-009** Each Q&A is logged to `talent_twin_qa_log` (question hashed, answer truncated)
- [ ] **RAG-010** Response time: ≤ 5s for 10 candidates, ≤ 15s for 50 candidates
- [ ] **RAG-011** Rate limited: 30 questions/min/recruiter (controlled by `withRateLimit`)
- [ ] **RAG-012** Company-plan gate: Pro+ required; Starter plan gets 403 with explanation
- [ ] **RAG-013** Access denied query is logged with `qa_type = 'access_denied'`
- [ ] **RAG-014** Excluded candidates are reported in the response metadata
- [ ] **RAG-015** Integration test: seed data → ask → assert citations are accurate

## US2 — Code Authorship Proof Badge (Student)

- [ ] **BADGE-001** Student navigates to `/talent-twin` and sees top 50 claimable commits
- [ ] **BADGE-002** Claimable commits are ranked by: lines_changed × repo_stars × uniqueness_score
- [ ] **BADGE-003** Student selects individual commits or a range and generates a badge
- [ ] **BADGE-004** Badge SVG served at `/badges/authorship/<badge_id>.svg` (shields.io-compatible)
- [ ] **BADGE-005** Badge renders: student name, "X lines authored in Y repos" claim, top-3 repo names
- [ ] **BADGE-006** Badge signed as JWT with service-role key (v1); Ed25519 VC (v2, post-032)
- [ ] **BADGE-007** JWT claims: `sub`, `badge_nonce`, `commits[{sha, repo, lines, date, message_sha256}]`, `iat`, `exp`
- [ ] **BADGE-008** Each commit must have `authorship_score ≥ 0.8` (student wrote ≥ 80% of the diff)
- [ ] **BADGE-009** Student can revoke a badge → inserted into `badge_revocations` → verify API returns `verified: false`
- [ ] **BADGE-010** Recruiters see a "Badges" section on the candidate profile with verification links
- [ ] **BADGE-011** Badge verify endpoint is public (no auth)
- [ ] **BADGE-012** Rate limited: 5 badges/day/student, 30 verifications/min/IP
- [ ] **BADGE-013** Privacy gate: badges cannot be issued if `talent_twin_opt_in = false`
- [ ] **BADGE-014** SVG cached at CDN for 7 days (`Cache-Control: public, max-age=604800`)
- [ ] **BADGE-015** Integration test: issue badge → verify badge → revoke → verify revoked

## Privacy & Compliance

- [ ] **PRIV-001** `talent_twin_opt_in` defaults to `false` (explicit opt-in required)
- [ ] **PRIV-002** Opt-out deletes all student chunks via `delete_student_chunks()` within 60 seconds
- [ ] **PRIV-003** Recruiter queries to opted-out students are logged as `access_denied`
- [ ] **PRIV-004** Student can see aggregate query count at `/talent-twin/preview`
- [ ] **PRIV-005** Questions are hashed (SHA-256) in the audit log; plaintext is never stored
- [ ] **PRIV-006** Chunks are never returned directly to recruiters (only LLM-generated answers)
- [ ] **PRIV-007** RLS on `talent_twin_chunks`: no SELECT policies (service-role reads only)
- [ ] **PRIV-008** RLS on `talent_twin_qa_log`: recruiter can SELECT own rows; INSERT is service-role only
- [ ] **PRIV-009** Badge JWT `exp` is ≤ 12 months from `iat`
- [ ] **PRIV-010** Re-enabling the twin after opt-out takes ≥ 24 hours (next embedder cycle)

## Operational

- [ ] **OPS-001** Daily embedder cron at 04:00 UTC
- [ ] **OPS-002** Rate-limited to 1,000 embeddings/minute (respects OpenAI TPM limit)
- [ ] **OPS-003** Error budget: < 1% of embedding runs fail; failed chunks are retried next cycle
- [ ] **OPS-004** Q&A latency: p99 ≤ 15 seconds for 50-candidate scope
- [ ] **OPS-005** Badge generation: p99 ≤ 5 seconds
- [ ] **OPS-006** All functions wrapped in `withObservability` (structured JSON logs + trace headers)
- [ ] **OPS-007** Alert on: embedding-cron failure, Q&A p50 latency > 10s for 3 consecutive cycles
- [ ] **OPS-008** Load test: 50 concurrent queries against 10K chunks; p99 ≤ 15s

## Score Contribution

| Signal | Max percentage | Notes |
|---|---|---|
| RAG Q&A (recruiter engagement) | 0% (recruiter-only feature) | Does not affect student scores |
| Authorship badge issuance | 2% (badge_count × 0.5) | Capped at 4 badges → 2% |
| Twin opt-in | 0% (privacy, not a signal) | Toggle, not a metric |

**Total new score upside:** 2% (from badges). Zero from the RAG pipeline (it's a recruiter-only feature). Score impact is documented in `specs/004-eleven-of-ten/score-budget.md`.
