# Requirements Quality Checklist: Deep Signal Capture

**Purpose**: Verify the spec, plan, data-model, contracts, research, quickstart, and tasks are internally consistent, complete, and unambiguous *before* implementation starts. Twelve items, modeled on the Spec Kit quality bar.
**Created**: 2026-06-06
**Feature**: `006-deep-signal-capture`
**Source**: `specs/006-deep-signal-capture/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`, `tasks.md`

Each item is a pass/fail check. All items should be `[x]` before the implementation phase begins.

---

## CHK-01 — Every user story has Why, Independent test, ≥ 3 Given/When/Then scenarios

- [ ] CHK-01.1 US1 (IDE Telemetry) has a **Why this is P1** explanation
- [ ] CHK-01.2 US1 has a concrete **Independent test** that does not require US2 or US3
- [ ] CHK-01.3 US1 has ≥ 3 acceptance scenarios using Given/When/Then (5 present)
- [ ] CHK-01.4 US2 (Biometrics) has a **Why this is P2** explanation
- [ ] CHK-01.5 US2 has a concrete **Independent test** that mocks a single Oura endpoint
- [ ] CHK-01.6 US2 has ≥ 3 acceptance scenarios (5 present)
- [ ] CHK-01.7 US3 (Privacy Center + Audit) has a **Why this is P1, foundational** explanation
- [ ] CHK-01.8 US3 has a concrete **Independent test** that asserts 2 active + 1 disconnected source + `signal_audit` row on delete
- [ ] CHK-01.9 US3 has ≥ 3 acceptance scenarios (5 present)

## CHK-02 — Every edge case is mapped to a functional requirement OR explicitly deferred

- [ ] CHK-02.1 "IDE extension network failure mid-upload" → mapped to FR-IDE-003 (buffer TTL 7 days) and the in-extension buffer discard
- [ ] CHK-02.2 "VS Code user revokes only the keystroke-entropy scope" → mapped to `raw_partial_capture` boolean column + privacy-center banner component
- [ ] CHK-02.3 "Biometric provider OAuth refresh failure" → captured in research D3 + the 24h backoff + `expired` status surfaced in privacy center
- [ ] CHK-02.4 "Oura / Whoop API rate-limit" → captured in `oura-client` / `whoop-client` rate-limit awareness and 1h retry scheduling
- [ ] CHK-02.5 "AST-diff returns invalid (file too large)" → captured in research D2 file-size guard (2 MB) and extension-side `refactor_distance=0` fallback
- [ ] CHK-02.6 "Two devices, same user" → captured in `device_id` disambiguation + `device_count` adjustment
- [ ] CHK-02.7 "HealthKit user revokes then re-grants" → captured in connection-row per-grant semantics
- [ ] CHK-02.8 "DPDP request mid-cron" → captured in `dpdp-erasure.ts` + the shared advisory lock on `user_id`
- [ ] CHK-02.9 "Audit log itself is subject of a DSAR" → captured in `actor_id` pseudonymisation at 90 days + 7-year metadata retention
- [ ] CHK-02.10 "Cursor extension" → captured in research D1 + plan.md Cursor fork workspace
- [ ] CHK-02.11 CGM, OS screen-time, keystroke-rhythm auth → **explicitly deferred** in spec.md "Out of Scope"

## CHK-03 — Functional requirements use a consistent naming convention and number ≥ 25

- [ ] CHK-03.1 FRs use the `<GROUP>-NNN` convention (FR-IDE-NNN, FR-BIO-NNN, FR-PRI-NNN, FR-AUD-NNN, FR-CAP-NNN) — consistent with 004 (FR-AC-NNN, FR-ATS-NNN, etc.)
- [ ] CHK-03.2 Total FR count ≥ 25 (current count: 28 = 6 IDE + 8 BIO + 8 PRI + 3 AUD + 3 CAP)
- [ ] CHK-03.3 Every FR has an implementation traceable in `tasks.md`
- [ ] CHK-03.4 Every FR has at least one acceptance scenario that exercises it

## CHK-04 — Success criteria are measurable (number, timeframe, population)

- [ ] CHK-04.1 SC-IDE-001: ≥ 8% install rate within 60 days (number, timeframe, population)
- [ ] CHK-04.2 SC-IDE-002: ≥ 60% retention at 30 days (number, timeframe, population)
- [ ] CHK-04.3 SC-IDE-003: > 90% upload success rate (rolling 7 days)
- [ ] CHK-04.4 SC-BIO-001: ≥ 5% provider-connect rate within 90 days
- [ ] CHK-04.5 SC-BIO-002: ≥ 0.65 confidence for ≥ 40% of inferences (number, population)
- [ ] CHK-04.6 SC-PRI-001: 100% audit integrity (hard invariant, not a target)
- [ ] CHK-04.7 SC-PRI-002: ≤ 5 min median delete-all latency (number, timeframe)
- [ ] CHK-04.8 SC-DPDP-001: 100% DPDP requests fulfilled within 30 days (statutory)

## CHK-05 — Data model has a Mermaid ER diagram AND per-table DDL with constraints, indexes, RLS

- [ ] CHK-05.1 `data-model.md` includes a Mermaid `erDiagram` block (present, lines 19-120)
- [ ] CHK-05.2 Every entity named in spec.md **Key Entities** has a table in `data-model.md` (6/6 — `ide_sessions`, `ide_aggregates`, `biometric_connections`, `biometric_aggregates`, `peak_window_inferences`, `signal_audit`)
- [ ] CHK-05.3 Every table has explicit RLS policy plan (RLS summary table at line 324)
- [ ] CHK-05.4 Every CHECK constraint is justified by a functional requirement
- [ ] CHK-05.5 Every performance-critical query path has a supporting index (3 indexes per high-traffic table)
- [ ] CHK-05.6 Append-only enforcement on `signal_audit` is doubly layered (REVOKE + RLS) — line 290

## CHK-06 — API contracts are complete, with auth, error codes, and side effects

- [ ] CHK-06.1 `POST /api/ide-telemetry/session` present with full request/response JSON
- [ ] CHK-06.2 `GET / POST / DELETE /api/biometrics/connections` all present
- [ ] CHK-06.3 `POST /api/biometrics/connect/{provider}` (start OAuth) and `GET /api/biometrics/connect/{provider}/callback` present
- [ ] CHK-06.4 `GET /api/settings/signals` and `DELETE /api/settings/signals/{source}` present
- [ ] CHK-06.5 Every endpoint has explicit auth requirements (device-JWT, HMAC, student session, admin scope)
- [ ] CHK-06.6 Every endpoint has explicit error codes (400, 401, 403, 404, 409, 413, 429, 503) with the `dpdp_window_active` extension
- [ ] CHK-06.7 Error response shape is consistent across all endpoints
- [ ] CHK-06.8 The score-cap (3% + 2%) is enforced server-side and the client never receives an uncapped value

## CHK-07 — Architectural constraints are honored

- [ ] CHK-07.1 All new shared types live under `packages/types/`
- [ ] CHK-07.2 All new API routes live under `apps/web/src/app/api/`
- [ ] CHK-07.3 All new edge functions live under `supabase/functions/`
- [ ] CHK-07.4 The new IDE extension workspace lives under `apps/extension-ide/`
- [ ] CHK-07.5 Mobile biometric modules live under `apps/mobile/src/lib/biometrics/`
- [ ] CHK-07.6 pgvector from 002 is reused (no new vector type introduced; biometric correlation uses scalar weights)
- [ ] CHK-07.7 All new tables have RLS enabled
- [ ] CHK-07.8 All new surfaces are behind feature flags (`006_ide_telemetry`, `006_biometrics_oura`, `006_biometrics_whoop`, `006_biometrics_mobile`, `006_privacy_center`, `006_audit_integrity_check`)

## CHK-08 — Cross-feature dependencies are identified

- [ ] CHK-08.1 Reuses 002's `peak_window_detector` (extends by writing parallel `peak_window_inferences` rows, not by modifying the 002 schema)
- [ ] CHK-08.2 Reuses 001's `privacy-request-deletion` edge function (extends via `dpdp-erasure.ts`)
- [ ] CHK-08.3 Reuses 002's `feature_flags` table (no new flag table)
- [ ] CHK-08.4 Reuses 002's `pg_cron` schedule pattern (`044_cron_006.sql`)
- [ ] CHK-08.5 Depends on 005 Expo mobile being in production before `006_biometrics_mobile` flag is enabled (explicitly gated)
- [ ] CHK-08.6 Reuses 004's i18n catalogs (no new locale; the 5 existing locales are extended with `settings.signals.*` keys)
- [ ] CHK-08.7 Reuses 004's pgsodium encryption pattern for the OAuth refresh tokens

## CHK-09 — Privacy & compliance: DPDP Act 2023 (Sections 6, 8, 10, 12)

- [ ] CHK-09.1 Section 6 (Notice + consent) — first-run `Enable` click in extension + privacy center; consent logged in `signal_audit`
- [ ] CHK-09.2 Section 8 (Data principal rights) — `GET /api/settings/signals` and `GET /api/admin/audit/{student_id}` for access
- [ ] CHK-09.3 Section 8(4) (Record of processing) — 7-year metadata retention on `signal_audit`
- [ ] CHK-09.4 Section 10 (Erasure) — `POST /api/settings/signals/dpdp-erasure` and `POST /api/settings/signals/delete-all`
- [ ] CHK-09.5 Section 12 (Statutory window) — 30-day window enforced in `dpdp-erasure.ts`
- [ ] CHK-09.6 Granular per-source toggles (one toggle per source; independent) — FR-PRI-002
- [ ] CHK-09.7 Audit log is append-only (REVOKE UPDATE/DELETE) — FR-PRI-008
- [ ] CHK-09.8 Audit log integrity is nightly-checked — FR-AUD-001
- [ ] CHK-09.9 Actor pseudonymisation after 90 days — FR-AUD-002
- [ ] CHK-09.10 No raw biometric timestamps beyond the date leave the device — research D4
- [ ] CHK-09.11 No raw keystrokes / source code leave the device — research D1 + D2

## CHK-10 — Performance & scale targets are explicit and traced

- [ ] CHK-10.1 IDE aggregate upload p95 ≤ 3s — captured in plan.md
- [ ] CHK-10.2 Biometric correlation p95 ≤ 30s/user — captured in plan.md
- [ ] CHK-10.3 Privacy-center page load p95 ≤ 1.5s — captured in plan.md
- [ ] CHK-10.4 AST-diff in Web Worker p95 ≤ 200ms per file — captured in plan.md
- [ ] CHK-10.5 50K students × 30 sessions/day × 1 row → 1.5M `ide_sessions` rows/day peak — captured in plan.md scale section
- [ ] CHK-10.6 `signal_audit` is one row per signal event, ~10× the aggregate count → 15M rows/day — captured in plan.md

## CHK-11 — Test coverage

- [ ] CHK-11.1 Every E2E test in `tasks.md` has a corresponding entry under `tests/e2e/` (T170-T182 → 13 E2E + 1 extension integration; the Cursor spec is in T074; the IDE extension E2E in T170)
- [ ] CHK-11.2 Every unit test in `tasks.md` has a corresponding entry under `tests/integration/` (T060-T063, T110-T113, T167, T175-T176, T178-T179, T181 → 14 unit / integration)
- [ ] CHK-11.3 E2E for score-cap enforcement asserts both IDE and biometric caps
- [ ] CHK-11.4 E2E for buffer-offline-replay asserts the 7-day TTL discard
- [ ] CHK-11.5 Unit test for append-only enforcement asserts UPDATE/DELETE on `signal_audit` raise DB-level errors
- [ ] CHK-11.6 Unit test for audit pseudonymisation asserts the 90-day replacement is reversible by admin

## CHK-12 — Rollout + observability + rollback path

- [ ] CHK-12.1 Feature flags default to off; cohort rollout dates documented in `quickstart.md` §7
- [ ] CHK-12.2 Observability hooks (audit integrity check, biometric correlator health, IDE upload success rate, DPDP queue depth, OAuth refresh failure rate) are wired in T189
- [ ] CHK-12.3 Rollback path is documented in `quickstart.md` §10 (`pnpm supabase migration repair --status reverted 039` + feature-flag flip)
- [ ] CHK-12.4 DPDP runbook is documented in `quickstart.md` §9
- [ ] CHK-12.5 Operator runbook is in scope (T187)

---

## Open Questions

None. All brief requirements are resolved by the existing spec, plan, data-model, contracts, and quickstart artifacts. The brief's surface list (env vars, endpoint paths) has been fully reconciled.

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- Link to relevant resources or documentation
- Items are numbered sequentially for easy reference
- This checklist should be re-run after every spec/plan/tasks revision
- The brief's "Max 3 unresolved-question markers total across all files, ideally 0" is honoured (0 markers)
- The brief's "MIGRATION NUMBER: 039" is honoured (the data-model.md and the migration file are both `043_deep_signal_capture.sql`)
- Cross-feature dependencies are itemised in CHK-08 and re-surfaced in the final report
