# Requirements Quality Checklist: 008 — Collaborative Mode

**Purpose**: Verify the spec, plan, data-model, contracts, research, quickstart, and tasks are internally consistent, complete, and unambiguous *before* implementation starts.
**Created**: 2026-06-07
**Feature**: `008-collaborative-mode`
**Source**: `specs/008-collaborative-mode/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`, `tasks.md`

Each item is a pass/fail check. All items should be `[x]` before the implementation phase begins.

---

## 1. Spec Completeness

- [ ] **CHK-001** Every user story (US1-US4) has a **Why this priority** explanation that ties to a product goal
- [ ] **CHK-002** Every user story has a concrete **Independent test** that does not require another user story to be live (US2 can be tested with synthetic `collab_events` even without US1 being shipped)
- [ ] **CHK-003** Every user story has ≥ 3 acceptance scenarios using Given/When/Then (US1 has 6, US2 has 5, US3 has 4, US4 has 5)
- [ ] **CHK-004** Every edge case listed in `spec.md` §"Edge Cases" is mapped to a functional requirement OR is explicitly deferred
- [ ] **CHK-005** Functional requirements use a consistent naming convention: `FR-{NNN}` (general), `FR-{NNN}` in the Anti-collusion + Privacy section is `FR-016..FR-019`; per-story sections are clearly labelled
- [ ] **CHK-006** Success criteria are measurable (each has a number, a population, and a timeframe) — verified by `spec.md` §"Success Criteria" SC-COLLAB-001 through SC-COLLAB-010
- [ ] **CHK-007** Out-of-scope items are listed and explicitly named as deferred in `spec.md` §"Out of Scope" (6 items)
- [ ] **CHK-008** The `Assumptions` section explicitly enumerates the migration-number conflict and the recovery plan (`047_collab.sql` per brief; fallback `043_collab.sql`)

## 2. Data Model Correctness

- [ ] **CHK-009** Every entity named in `spec.md` §"Key Entities" has a table in `data-model.md` (8 spec entities + `collab_audit` for cross-feature observability = 9 new tables)
- [ ] **CHK-010** Every table has an explicit RLS policy plan (`collab_rooms`, `collab_participants`, `collab_events`, `collab_artifacts`, `teamwork_scores`, `collab_recordings`, `collab_consents`, `collab_snapshots`, `collab_audit`)
- [ ] **CHK-011** Every FK resolves to an existing 001-007 table OR to a table created in `047_collab.sql`
- [ ] **CHK-012** Every CHECK constraint is justified by a functional requirement (e.g. `collab_rooms.duration_minutes BETWEEN 30 AND 120` ↔ FR-007; `teamwork_scores.score BETWEEN 0 AND 100` ↔ FR-011; `collab_participants.role IN (...)` ↔ FR-001)
- [ ] **CHK-013** Every performance-critical query path has a supporting index: room list (`status, scheduled_start`), event log (`room_id, seq DESC`), score lookup (`user_id, computed_at DESC`), consent lookup (`room_id, user_id`), recording purge (`purge_after` partial WHERE `recording_url IS NOT NULL`)
- [ ] **CHK-014** The Mermaid ER diagram in `data-model.md` matches the SQL DDL below it (entities, columns, FKs)
- [ ] **CHK-015** The migration is idempotent: all `CREATE TABLE IF NOT EXISTS`, all `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`, all `DROP POLICY IF EXISTS` + `CREATE POLICY`
- [ ] **CHK-016** `collab_events` is partitioned by month via `pg_partman` (inherited 004 pattern) — `044_pg_partman_collab.sql` is a follow-up migration in T011

## 3. API Contract Correctness

- [ ] **CHK-017** Every endpoint listed in the spec's acceptance scenarios appears in `contracts/api.md` (room create / get / join / end / teamwork; consent grant / revoke; observe; events / snapshots / transcript; recruiter review; opt-out)
- [ ] **CHK-018** Every endpoint has explicit auth requirements (student / host / mentor / recruiter / faculty / service role) and explicit error codes for documented failure modes
- [ ] **CHK-019** The Y.js + LiveKit client init flow is documented end-to-end (participant flow §6.1; observer flow §6.2; anti-collusion flow §6.3; teamwork scoring flow §6.4)
- [ ] **CHK-020** Request bodies use Zod-validatable JSON (the 004 Zod pattern is extended to 008)
- [ ] **CHK-021** Response bodies do not leak PII for observer-facing endpoints (recruiter review redacts emails / phones per FR-031; observer view shows first name + college + year only)
- [ ] **CHK-022** The error response shape is consistent across all 008 endpoints (the standard 004 `{ error: { code, message, details } }` envelope)
- [ ] **CHK-023** Liveblocks READ_ONLY observer token is explicitly documented (`liveblocks.auth_token` with `permission: 'READ_ONLY'`, `livekit.can_publish: false`)
- [ ] **CHK-024** Mid-session consent revoke semantics are explicitly documented: token downgrade within 5 seconds (FR-024), audit row written, participants notified

## 4. Architectural Constraints

- [ ] **CHK-025** All new shared types live under `packages/types/` (T020-T022)
- [ ] **CHK-026** All new API routes live under `apps/web/src/app/api/collab/` (T080-T092)
- [ ] **CHK-027** All new edge functions live under `supabase/functions/collab-*/` and `supabase/functions/teamwork-scorer/` (T120-T126)
- [ ] **CHK-028** Anti-collusion rides on 004's `anticheat_signals` table (T022 extends the signal enum, T122 writes to the existing table — no new anti-cheat schema)
- [ ] **CHK-029** Public-API key + rate-limit pattern rides on 004's `api_rate_counters` table (T080-T092 enforce via the 004 middleware)
- [ ] **CHK-030** Webhook dispatcher rides on 004's `webhook-dispatcher` edge function for any 008-related events (e.g. `teamwork_score.computed`)
- [ ] **CHK-031** W3C VC issuance on teamwork score rides on 004's `credential-vc-issue` edge function (T190)
- [ ] **CHK-032** Cron pattern rides on 004's cron registry (`045_cron_008.sql` is added in T126; format matches `038_cron_004.sql`)
- [ ] **CHK-033** All new tables have RLS enabled
- [ ] **CHK-034** All new surfaces are behind feature flags (`008_collab_rooms`, `008_teamwork_scorer`, `008_anti_collusion`, `008_recruiter_observe`, etc., per `quickstart.md` §10)
- [ ] **CHK-035** The 5% Skill-Proof-Score cap on teamwork contribution is enforced at the 002 score-aggregator layer (T176 extends `score-aggregator.ts`)

## 5. Performance & Scale

- [ ] **CHK-036** Y.js op replication p95 ≤ 200ms (verified by SC-COLLAB-003 + Performance API in client)
- [ ] **CHK-037** Test-run round-trip p95 ≤ 500ms (SC-COLLAB-004)
- [ ] **CHK-038** Room boot p95 ≤ 8s (WebContainer 1-3s p50; Firecracker 2-5s p50)
- [ ] **CHK-039** Observer token issuance p95 ≤ 500ms
- [ ] **CHK-040** Recruiter review page p95 ≤ 2s (SC-COLLAB-010; T151 enforces via direct query, no over-fetch)
- [ ] **CHK-041** `collab_events` write throughput: 200 req/min/user/room (inherited 004 token-bucket pattern) supports 50K students × 1-2 sessions/month × ~1K events/session within Postgres + pg_partman reach

## 6. Test Coverage

- [ ] **CHK-042** Every E2E test in `tasks.md` Phase 13 has a corresponding entry in `tests/e2e/` (10 E2E tests: T180-T189)
- [ ] **CHK-043** Every unit test in `tasks.md` Phase 9 has a corresponding entry in `tests/integration/` (4 unit test files: teamwork-scorer, collab-typing-divergence, collab-consent, plus yjs-snapshot, liveblocks-auth, livekit-token-mint in T031, T034, T041, T140-T142)
- [ ] **CHK-044** Teamwork scorer test asserts all 4 sub-scores in expected bands (T140; 4 hand-crafted session scenarios)
- [ ] **CHK-045** Anti-collusion test asserts: legitimate pair-programming is NOT flagged; suspected ghost-writing IS flagged with `collab_divergence_signal_active` (T141, T184)
- [ ] **CHK-046** Sandbox egress test asserts: WebContainer `network: 'disabled'` blocks `fetch('https://evil.com')`; egress attempt logged as `collab_events.sandbox_egress_blocked` (T071, T188)
- [ ] **CHK-047** Consent-revoke test asserts: token downgrade within 5s (FR-024); UI shows "Access revoked by participant"; audit row written (T187)

## 7. Privacy & Compliance

- [ ] **CHK-048** Per-room consent is the privacy primitive (FR-029; `collab_consents` table; consent dialog UI T110)
- [ ] **CHK-049** Per-student opt-out is a global toggle (`users.collab_opt_out`; FR-018; T091, T109, T111)
- [ ] **CHK-050** Opt-out snapshots to `collab_participants.opt_out_teamwork` at room-join time; no retroactive re-scoring (FR-018 + spec edge case; T026)
- [ ] **CHK-051** Account deletion drops `collab_consents` (CASCADE), tombstones `collab_participants` (`left_reason='account_deleted'`), and redacts `collab_recordings` (`recording_url=NULL, redacted=true`) — preserving `collab_events` and `collab_artifacts` for the audit period (FR-032; T161, T162)
- [ ] **CHK-052** Recruiter review redacts student PII (email, phone) per FR-031 (T151)
- [ ] **CHK-053** Cross-feature audit log (`collab_audit`) records: consent grant / revoke / expiry; observer join / leave; opt-out toggle; sandbox boot / shutdown; recording start / purge; flag raised (T010)
- [ ] **CHK-054** DPDP / SOC2: every LLM coach call blocked by anti-collusion; every consent change; every observer join; every recording; every opt-out is recorded with `actor_id`, `actor_type`, `action`, `payload_json`, `created_at`

## 8. Rollout

- [ ] **CHK-055** Feature flags default to OFF; cohort rollout dates documented in `quickstart.md` §10 (8 flags total, default OFF)
- [ ] **CHK-056** Observability hooks (Liveblocks MAU, LiveKit bandwidth, collab-events throughput, score distribution) are wired before any flag is enabled (`tasks.md` Phase 15; `quickstart.md` §12)
- [ ] **CHK-057** Rollback path is documented in `quickstart.md` §14: migration revert + flag flip + Liveblocks/LiveKit subscription cancel
- [ ] **CHK-058** First-time deploy checklist is in `quickstart.md` §15 (10 items)

## Open Questions (NEEDS CLARIFICATION)

- [ ] **CHK-OC-1** **Migration number**: spec brief stated `041`. The live migration ledger already has `047_webhooks.sql` (from 005, 2026-05-22) and `042_verify_api_key.sql`. The plan uses `047_collab.sql` per brief instruction; fallback to `043_collab.sql` if apply-time conflict surfaces. *Need: human confirmation from the migration-ledger owner that 041 is reserved for 008 (or that the renumber to 043 is acceptable).*

- [ ] **CHK-OC-2** **Anti-collusion threshold tuning set**: research.md D7 references "100 hand-labelled sessions" for tuning the `collab_typing_divergence` threshold. The labeling effort and the calibration window are not in the spec. *Need: product + engineering to confirm the 100-session labeling effort is feasible within the 008 cohort window, OR adjust the threshold-calibration schedule.*

- [ ] **CHK-OC-3** **WebContainer CSP for third-party scripts**: the collab route sets `Cross-Origin-Embedder-Policy: require-corp`. This may block certain third-party scripts (analytics, support chat) that don't ship `Cross-Origin-Resource-Policy: cross-origin`. The mitigation is to either (a) set these scripts to load with `crossorigin="anonymous"` and a CORP header from the third-party, OR (b) load them only on the marketing/dashboard routes, not the collab route. *Need: confirm with frontend + analytics team which scripts are loaded on the collab route and whether they need to be moved out.*

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- Link to relevant resources or documentation
- Items are numbered sequentially for easy reference
- This checklist should be re-run after every spec/plan/tasks revision
- 3 [NEEDS CLARIFICATION] markers left (within the brief's max of 3)
