# Tasks: 006 — Deep Signal Capture

**Feature**: `006-deep-signal-capture`
**Generated**: 2026-06-06
**Source**: `specs/006-deep-signal-capture/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

Atomic, dependency-ordered tasks. `[P]` = parallelizable with siblings sharing the same phase prefix. **Bold** tasks are critical-path. `[US1]` / `[US2]` / `[US3]` maps each task to its user story for traceability. 103 tasks total.

---

## Phase 0 — Pre-flight

- [ ] T001 [P] Verify 001-005 task completion (confirmed: 001/002/003/004 shipped, 005 in production)
- [ ] T002 [P] Survey existing migrations (001-038, 040-042 present); confirm next free migration number is 039
- [ ] T003 [P] Survey existing edge functions and apps workspaces; confirm no name clashes for `apps/extension-ide` or `biometric-correlator` / `signal-purge`
- [ ] T004 [P] Add 006 env vars to `.env.local.example` per `quickstart.md` §1 (OURA_*, WHOOP_*, GOOGLE_FIT_*, APPLE_HEALTHKIT_BRIDGE_URL, IDE_TELEMETRY_*, BIOMETRIC_*, SIGNAL_AUDIT_*, PRIVACY_TTL_*, DPDP_ERASURE_*, SIGNAL_PURGE_CRON_HOUR_UTC, BIOMETRIC_CORRELATOR_CRON_HOUR_UTC)
- [ ] T005 [P] Add 006 env vars to `turbo.json` `globalEnv` array
- [ ] T006 [P] Add new dependencies to `apps/web/package.json` (placeholder; tree-sitter lives in extension), to `apps/extension-ide/package.json` (new workspace): `vscode` (devDep), `@vscode/vsce`, `web-tree-sitter`, `tree-sitter-python`, `tree-sitter-typescript`, `tree-sitter-javascript`, `tree-sitter-go`, and to `apps/mobile/package.json`: `expo-healthkit`, `expo-health-connect`
- [ ] T007 Create new Turborepo workspace `apps/extension-ide/` by registering it in `pnpm-workspace.yaml` and `turbo.json` `pipeline` with `build` / `watch` / `package` / `lint` / `test` tasks
- [ ] T008 [P] Insert the 6 new `feature_flags` rows in `supabase/seed.sql` per `quickstart.md` §7 (`006_ide_telemetry`, `006_biometrics_oura`, `006_biometrics_whoop`, `006_biometrics_mobile`, `006_privacy_center`, `006_audit_integrity_check`); all default to `enabled=false`, `cohort_pct=0`

---

## Phase 1 — Migration 039

- [ ] **T010** [US1+US2+US3] Create `supabase/migrations/043_deep_signal_capture.sql` with `CREATE EXTENSION IF NOT EXISTS pgsodium;` (idempotent guard) and DDL for the 6 new tables in a single atomic migration file per the project convention
- [ ] T011 [P] Add `ide_sessions` (16 columns, 3 indexes, `duration_seconds` CHECK 60..1800, RLS student-sees-own + INSERT requires device-JWT) and `ide_aggregates` (11 columns, `score_contribution` CHECK ≤ 3, 4 indexes, partial unique on `(device_id, period_type, period_start) WHERE period_type='daily'`) DDL blocks to T010's migration
- [ ] T012 [P] Add `biometric_connections` (9 columns, `oauth_refresh_token_encrypted` pgsodium-encrypted, UNIQUE on `(student_id, provider)`) and `biometric_aggregates` (13 columns, `source_hash` for dedup, partial unique on `(connection_id, period_type, period_start) WHERE period_type='daily'`) DDL blocks to T010's migration
- [ ] T013 [P] Add `peak_window_inferences` (10 columns with 3 nullable input-hash columns, 30-day retention via `created_at` index) and `signal_audit` (10 columns, bigserial PK) DDL blocks to T010's migration
- [ ] T014 [P] Add the append-only enforcement on `signal_audit`: `REVOKE UPDATE, DELETE ON public.signal_audit FROM authenticated, anon, service_role;` (FR-PRI-008) and the RLS policies: students see own (excluding `audit_read` rows), admins read-only, service-role INSERT-only
- [ ] T015 [P] Create `supabase/migrations/044_cron_006.sql` with 3 `cron.schedule(...)` entries: `biometric-correlator` at `BIOMETRIC_CORRELATOR_CRON_HOUR_UTC`, `signal-purge` at `SIGNAL_PURGE_CRON_HOUR_UTC`, `signal-audit-pseudonymise` at 01:00 UTC, and `signal-audit-integrity-check` at 02:00 UTC

**Checkpoint**: All 6 new tables created. Append-only enforcement on `signal_audit` is in place. `pnpm supabase db reset` is clean. RLS verified.

---

## Phase 2 — Shared types (all parallel after Phase 1)

- [ ] T020 [P] Create `packages/types/ide-telemetry.ts` — `IDEEditor` union (`'vscode'|'cursor'`), `IDESession` and `IDEAggregate` interfaces mirroring the table columns
- [ ] T021 [P] Create `packages/types/biometrics.ts` — `BiometricProvider` union, `BiometricConnectionStatus` union, `BiometricScopes` union (`'sleep'|'hrv'|'resting_hr'|'readiness'`), `BiometricConnection` and `BiometricAggregate` interfaces
- [ ] T022 [P] Create `packages/types/signals.ts` — `SignalProvider` union (9 values), `SignalAction` union (8 values), `SignalSource` and `SignalSourceKind` (`'ide'|'biometric'`) interfaces used by the privacy center
- [ ] T023 [P] Create `packages/types/audit.ts` — `AuditActorType` union, `SignalAuditRow` and `AuditDumpResponse` interfaces
- [ ] T024 [P] Create `packages/utils/hash.ts` — `sha256Hex(input: string | Uint8Array): string` using Node `crypto.subtle`; shared between extension + server
- [ ] T025 [P] Create `packages/utils/score-cap.ts` — `clampIDEScore(raw)` and `clampBiometricScore(raw)` matching the 3/2 cap enforcement (FR-CAP-001/002)
- [ ] T026 [P] Regenerate `packages/types/database.ts` via `pnpm supabase gen types typescript --local > packages/types/database.ts` to include the 6 new tables
- [ ] T027 [P] Add Zod schemas in `packages/types/zod/signals.ts` mirroring the request bodies for `POST /api/ide-telemetry/session`, `POST /api/biometrics/mobile-sync`, and `POST /api/settings/signals/delete-all`

---

## Phase 3 — VS Code extension (US1) [critical path]

### 3a. Workspace skeleton (parallel)

- [ ] T030 [P] [US1] Create `apps/extension-ide/package.json` with `engines.vscode: ^1.85.0`, `main: ./dist/extension.js`, `activationEvents: ["*"]`, `contributes.commands: [{ command: 'antarix.enable', title: 'Antarix: Enable Telemetry' }, ...]`, `publisher: 'antarix'`, `displayName: 'Antarix Skill Proof — IDE Telemetry'`
- [ ] T031 [P] [US1] Create `apps/extension-ide/manifest.json` (the VS Code extension manifest; consumed by `vsce package` for marketplace metadata), `tsconfig.json` (extending the monorepo base with `lib: ["ES2022"]`, `outDir: "./dist"`, `types: ["vscode", "node"]`), `.vscodeignore`, `.vscode/launch.json` with `Run Extension` and `Extension Tests` configs, and `README.md` documenting the install, the data-capture contract, the disable / revoke command, and a link to `/settings/signals`

### 3b. Aggregator primitives (parallel)

- [ ] **T035 [P]** [US1] Create `apps/extension-ide/src/ide/keystroke-entropy.ts` — `computeEntropy(windowMs, keyEvents)`; Shannon entropy over key-code categories, no content
- [ ] **T036 [P]** [US1] Create `apps/extension-ide/src/ide/debug-tracker.ts` — `DebugTracker` subscribing to `vscode.debug.onDid{Start,Terminate}DebugSession` + custom-event stream; exposes `durationSeconds()` and `stepRatio()`
- [ ] T037 [P] [US1] Create `apps/extension-ide/src/ide/time-in-file.ts` — `TimeInFile` using `vscode.window.onDidChangeActiveTextEditor` + 30s tick
- [ ] T038 [P] [US1] Create `apps/extension-ide/src/ide/test-run-detector.ts` — `vscode.tasks.onDid{Start,End}Task` with `/test|jest|pytest|mocha|vitest/` pattern
- [ ] T039 [P] [US1] Create `apps/extension-ide/src/ide/error-resolution.ts` — `vscode.languages.onDidChangeDiagnostics`; diagnostic message is never read, only its URI+range hash
- [ ] T040 [P] [US1] Create `apps/extension-ide/src/ide/ast-diff.ts` — `web-tree-sitter` in a Web Worker; returns 0 for files > 2 MB or unsupported languages (Python, TS, JS, Go, Rust)

### 3c. Session aggregator + uploader + extension entrypoint

- [ ] **T045 [P]** [US1] Create `apps/extension-ide/src/ide/aggregator.ts` — `SessionAggregator` class orchestrating all primitives; `start()` / `end()` boundaries (30-min cap, 5-min idle); produces one `IDESession` row per session
- [ ] **T046 [P]** [US1] Create `apps/extension-ide/src/ide/uploader.ts` + `uploader-buffer.ts` — `Uploader` POSTs to `/api/ide-telemetry/session` with device-JWT; on failure writes to IndexedDB buffer (TTL 7 days)
- [ ] T047 [P] [US1] Create `apps/extension-ide/src/ide/device-jwt.ts` — handles the first-time handshake and the refresh-on-upload flow
- [ ] T048 [P] [US1] Create `apps/extension-ide/src/ide/privacy-banner.ts` + `extension.ts` — first-run notice, 4 commands (`antarix.enable`, `antarix.disable`, `antarix.flushBuffer`, `antarix.revokeDevice`), and the `activate(context)` / `deactivate()` wiring

### 3d. Extension tests (depend on 3c)

- [ ] T050 [P] [US1] Unit test `apps/extension-ide/src/ide/__tests__/keystroke-entropy.test.ts` — 100 random key sequences; assert entropy ∈ [0, 20] bits/min
- [ ] T051 [P] [US1] Unit test `apps/extension-ide/src/ide/__tests__/ast-diff.test.ts` — seeded Python/TS/Go edits; assert refactor_distance integer >= 0
- [ ] T052 [P] [US1] Unit test `apps/extension-ide/src/ide/__tests__/aggregator.test.ts` — fake-vscode harness; assert one IDESession row per session boundary; assert no content fields
- [ ] T053 [P] [US1] Integration test `apps/extension-ide/src/ide/__tests__/uploader-offline.test.ts` — simulate server-down; assert buffer persists and flushes on reconnect

**Checkpoint**: VS Code extension is functionally complete behind `006_ide_telemetry` flag (default off). Manual smoke-test via F5 launch config passes.

---

## Phase 4 — Cursor fork (US1) [parallel with Phase 3 after 3a]

- [ ] T055 [P] [US1] Create `apps/extension-ide/src/cursor/manifest.json` overriding `publisher: 'antarix-cursor'` and `displayName: 'Antarix Skill Proof — IDE Telemetry (Cursor)'`; the rest of the source tree is shared via build-time copy
- [ ] T056 [P] [US1] Add `apps/extension-ide/scripts/build-cursor.sh` that copies `src/ide/**` to `dist-cursor/`, drops the cursor `manifest.json` over the default, and runs `vsce package --target cursor`
- [ ] T057 [P] [US1] Update `apps/extension-ide/package.json` `scripts.package` and `scripts.package:cursor` to invoke `vsce package` with the right flags
- [ ] T058 [P] [US1] Add CI matrix entry in `.github/workflows/extensions.yml` to build both `.vsix` files on PR
- [ ] T059 [P] [US1] Unit test `apps/extension-ide/src/__tests__/cursor-fork-install.spec.ts` — assert the produced `.vsix` has the cursor publisher field and the same `engines.vscode` constraint

**Checkpoint**: Both `.vsix` files build clean. The Cursor build is identical source + 2 manifest fields.

---

## Phase 5 — Biometric integrations (US2)

### 5a. Oura + Whoop server-side (parallel)

- [ ] **T060 [P]** [US2] Create `apps/web/src/lib/biometrics/oura-client.ts` — `OuraClient` with `exchangeCode`, `fetchDailySummary`, `refresh`; rate-limit aware (1 req/s)
- [ ] **T061 [P]** [US2] Create `apps/web/src/lib/biometrics/whoop-client.ts` — analogous using `https://api.prod.whoop.com/v1`; `read:recovery` + `read:sleep` + `read:profile` scopes
- [ ] T062 [P] [US2] Create `apps/web/src/lib/biometrics/aggregator.ts` — `aggregateOuraDaily` / `aggregateWhoopDaily` mapping proprietary fields to the 5 normalised columns in `biometric_aggregates`
- [ ] T063 [P] [US2] Create `apps/web/src/lib/biometrics/correlator.ts` — `correlate(studentId, biometrics, detectorOutput, ideAggregates)`; weighted merge per `source_mix`; returns a `peak_window_inferences` insert row

### 5b. Mobile-side bridges (depend on 005; parallel with 5a)

- [ ] **T065 [P]** [US2] Create `apps/mobile/src/lib/biometrics/healthkit/index.ts` — `requestScopes`, `readDailySummary`, `postToServer`; the four scopes are hard-coded; raw timestamps beyond the date are dropped on-device
- [ ] T066 [P] [US2] Create `apps/mobile/src/lib/biometrics/healthkit/permissions.ts` (4-scope enum), `apps/mobile/src/lib/biometrics/healthkit/types.ts` (`HealthKitDaily` interface)
- [ ] **T067 [P]** [US2] Create `apps/mobile/src/lib/biometrics/google-fit/index.ts` — analogous using `expo-health-connect`
- [ ] T068 [P] [US2] Create `apps/mobile/src/lib/biometrics/google-fit/permissions.ts` and `apps/mobile/src/lib/biometrics/google-fit/types.ts`
- [ ] T069 [P] [US2] Create `apps/mobile/src/lib/biometrics/shared/post-to-server.ts` (HMAC-signed `X-Antarix-Device-Signature` over `timestamp + body`), `apps/mobile/src/lib/biometrics/shared/device-info.ts` (stable per-install UUID), and `apps/mobile/src/lib/biometrics/README.md` documenting the 005 dependency and the `006_biometrics_mobile` flag

### 5c. Edge functions + API routes (depend on 5a + 5b + Phase 1)

- [ ] **T070** [US2] Create `supabase/functions/biometric-correlator/index.ts` — nightly; for each active student with ≥ 1 connected biometric provider, fetch the latest daily aggregate, merge with 002 detector output + latest IDE aggregate, write a `peak_window_inferences` row; emits a `signal_audit` row
- [ ] **T071** [US2] Create `supabase/functions/signal-purge/index.ts` — nightly; (a) roll up `ide_sessions` older than `PRIVACY_TTL_IDE_DAYS` into monthly `ide_aggregates` rows and hard-delete raws; (b) roll up `biometric_aggregates` dailies older than `PRIVACY_TTL_BIOMETRIC_DAYS` into monthlies and hard-delete dailies; (c) hard-delete `peak_window_inferences` older than `PRIVACY_TTL_PEAK_WINDOW_DAYS`; (d) for any `signal_audit` row with `action='delete_all'`, queue the corresponding table rows for purge
- [ ] T072 [P] [US2] Create `apps/web/src/app/api/biometrics/connections/route.ts` — `GET` (list), `POST` (create mobile-handled connection for HealthKit/Google Fit), `DELETE` (disconnect all) per `contracts/api.md`
- [ ] **T073 [P]** [US2] Create `apps/web/src/app/api/biometrics/connect/[provider]/route.ts` — POST start OAuth; generates PKCE state + code_verifier; stores state in HTTP-only cookie; redirects to provider
- [ ] T074 [P] [US2] Create `apps/web/src/app/api/biometrics/connect/[provider]/callback/route.ts` — GET OAuth callback; verifies state; exchanges code; encrypts refresh token with pgsodium; writes `biometric_connections`; writes `signal_audit`; redirects to `/settings/signals?provider=<provider>&status=connected`
- [ ] T075 [P] [US2] Create `apps/web/src/app/api/biometrics/disconnect/[provider]/route.ts` — POST; updates `biometric_connections.status='disconnected'`; writes `signal_audit`
- [ ] T076 [P] [US2] Create `apps/web/src/app/api/biometrics/mobile-sync/route.ts` — POST; validates HMAC; UPSERTs `biometric_aggregates` daily row; writes `signal_audit`; returns score contribution percentage
- [ ] T077 [P] [US2] Create `apps/web/src/app/api/biometrics/mobile-sync/health/route.ts` — GET health check for the 005 Expo app to call on launch

### 5d. Biometric tests (depend on 5c)

- [ ] T080 [P] [US2] Unit test `tests/integration/oura-client.test.ts` — mock HTTP; assert PKCE state, refresh-token storage, retry-on-401
- [ ] T081 [P] [US2] Unit test `tests/integration/whoop-client.test.ts` — analogous
- [ ] T082 [P] [US2] Unit test `tests/integration/biometric-correlator.test.ts` — seed biometrics + 002 output + IDE; assert merged `peak_window_inferences` row with expected `source_mix`
- [ ] T083 [P] [US2] Unit test `tests/integration/score-cap.test.ts` — assert IDE clamp at 3, biometric clamp at 2, combined at 5
- [ ] T084 [P] [US2] E2E `tests/e2e/biometric-oura-connect.spec.ts` — full OAuth flow with mock Oura
- [ ] T085 [P] [US2] E2E `tests/e2e/biometric-whoop-connect.spec.ts` — analogous
- [ ] T086 [P] [US2] E2E `tests/e2e/biometric-healthkit-mobile.spec.ts` — mock 005 mobile bridge; assert one row/day/device/provider, no raw timestamps

**Checkpoint**: Biometric integrations (Oura, Whoop, HealthKit, Google Fit) are functionally complete behind their respective flags. Nightly correlator produces `peak_window_inferences` rows with `source_mix` citing the 002 detector hash.

---

## Phase 6 — Privacy Center UI + IDE API routes (US3) [parallel with Phase 5 after Phase 1]

### 6a. Page + components (parallel)

- [ ] **T090 [P]** [US3] Create `apps/web/src/app/(student)/settings/signals/page.tsx` — server component; calls `GET /api/settings/signals`; renders `SourceCard` per source
- [ ] T091 [P] [US3] Create `apps/web/src/app/(student)/settings/signals/source-card.tsx` (status pill, last 5 aggregates, "what we learned", toggle) + `what-we-learned.tsx` (plain-language template) + `delete-all-button.tsx` (confirmation modal; calls `POST /api/settings/signals/delete-all`) + `partial-capture-banner.tsx` (shows when `raw_partial_capture: true`) + `dpdp-erasure-section.tsx` (lists in-flight DPDP requests)

### 6b. API routes (parallel with 6a)

- [ ] **T092 [P]** [US3] Create `apps/web/src/app/api/settings/signals/route.ts` — GET snapshot per `contracts/api.md` (sources, last 5 aggregates, "what we learned", total_score_cap_pct=5)
- [ ] **T093 [P]** [US3] Create `apps/web/src/app/api/settings/signals/[source]/route.ts` — DELETE; flips the source to disconnected; writes `signal_audit`
- [ ] T094 [P] [US3] Create `apps/web/src/app/api/settings/signals/delete-all/route.ts` (POST) + `dpdp-erasure/route.ts` (GET + POST; reuses `privacy-request-deletion` from 001) + `admin/audit/[student_id]/route.ts` (GET paginated `signal_audit` dump for admins with `audit:read` scope; bigserial cursor)
- [ ] T095 [P] [US3] Create the IDE API surface: `apps/web/src/app/api/ide-telemetry/session/route.ts` (POST; device-JWT auth; Zod validation; writes `ide_sessions` + UPSERTs `ide_aggregates` daily + writes `signal_audit`; returns score contribution), `apps/web/src/app/api/ide-telemetry/device/[device_id]/route.ts` (DELETE; revokes device JWT; queues purge), and `apps/web/src/app/api/ide-telemetry/sessions/route.ts` (GET last N sessions for the privacy center)

### 6c. Shared libraries + i18n

- [ ] T097 [P] [US3] Create the four `apps/web/src/lib/signals/` modules: `hash.ts` (re-export of `sha256Hex`), `plain-language.ts` (`renderWhatWeLearned(source, aggregates)`), `score-cap.ts` (re-export), `types.ts` (re-export from `packages/types/signals`)
- [ ] T098 [P] [US3] Extend all 5 locale catalogs (`apps/web/src/messages/{en,hi,ta,te,mr}.json`) with the `settings.signals.*` key family (page title, source-card labels, what-we-learned templates for each provider, delete-all modal, partial-capture banner, DPDP section). Missing keys fall back to English and log to `i18n_missing_keys` from 004.

### 6d. Privacy center tests (depend on 6a + 6b)

- [ ] T099 [P] [US3] E2E `tests/e2e/privacy-center-disable-source.spec.ts` — assert toggle flips to off, no new uploads, `signal_audit` row
- [ ] T100 [P] [US3] E2E `tests/e2e/privacy-center-delete-all.spec.ts` — assert all sources disconnected, all rows queued, single `delete_all` audit row

**Checkpoint**: Privacy Center is fully functional behind `006_privacy_center` flag. Every signal event has a matching `signal_audit` row.

---

## Phase 7 — Audit log + integrity (US3) [parallel with Phase 6]

- [ ] **T105 [P]** [US3] Create `apps/web/src/lib/audit/log.ts` — `writeSignalAudit(actorId, actorType, studentId, provider, action, byteCount, aggregateHash): Promise<void>`; the only writer; called from every signal-touching route
- [ ] **T106 [P]** [US3] Create `apps/web/src/lib/audit/dpdp-erasure.ts` — extends 001's `privacy-request-deletion` edge function to also process `signal_audit` rows with `action='delete_all'`; calls `signal-purge` to drain
- [ ] **T107 [P]** [US3] Create `supabase/functions/signal-audit-integrity-check/index.ts` — nightly; asserts (a) every signal event has a matching audit row, (b) no UPDATE/DELETE happened (FR-AUD-001), (c) actor_id is still unmasked for rows < 90 days old; pages on-call on failure
- [ ] T108 [P] [US3] Create `supabase/functions/signal-audit-pseudonymise/index.ts` — nightly; replaces `actor_id` with `sha256(actor_id + SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT)` for rows > 90 days old (FR-AUD-002); reversible only by an admin with `audit:read` AND `audit:unmask` dual scope
- [ ] T109 [P] [US3] Create `apps/web/src/lib/audit/admin-guard.ts` — `assertCanReadAudit(actorId, studentId): void`; checks admin or college_admin with `audit:read` scope; college admins are limited to their institution's students
- [ ] T110 [P] [US3] Unit test `tests/integration/signal-audit-writer.test.ts` — every signal-touching route writes exactly one audit row with the expected provider/action/hash

**Checkpoint**: Audit log is append-only, integrity-checked nightly, and pseudonymised on schedule. DPDP erasure path is complete.

---

## Phase 8 — Cross-cutting tests (US1+US2+US3)

- [ ] T115 [P] [US1] E2E `tests/e2e/ide-extension-aggregate.spec.ts` — install extension via `@vscode/test-electron`; edit + save + run-test cycle; assert one `ide_sessions` row, one `ide_aggregates` daily row, one `signal_audit` row; assert payload contains no source code
- [ ] T116 [P] [US1] E2E `tests/e2e/cursor-fork-install.spec.ts` — same flow with the cursor `.vsix`; assert identical schema writes
- [ ] T117 [P] [US3] E2E `tests/e2e/audit-log-integrity.spec.ts` — assert nightly integrity check passes against a seeded cohort
- [ ] T118 [P] [US3] E2E `tests/e2e/dpdp-erasure-request.spec.ts` — file a DPDP erasure via `POST /api/settings/signals/dpdp-erasure`; assert 30-day window enforcement; assert terminal `erasure_complete` audit row
- [ ] T119 [P] [US1+US2] E2E `tests/e2e/score-cap-enforcement.spec.ts` — seed extreme IDE + biometric scores; assert both clamped to their caps and the combined at 5
- [ ] T120 [P] [US1+US2] E2E `tests/e2e/buffer-offline-replay.spec.ts` — extension offline 7 days; buffer should auto-discard older; reconnect; assert only the in-window aggregates are uploaded
- [ ] T121 [P] [US1+US2] E2E `tests/e2e/two-devices-aggregates.spec.ts` — same user with two devices enabled; assert score contribution is averaged and not double-counted
- [ ] T122 [P] [US1+US2+US3] Unit test `tests/integration/ide-aggregator.test.ts` — pure-function tests for the SessionAggregator arithmetic
- [ ] T123 [P] [US1] Unit test `tests/integration/ast-diff.test.ts` — confirm `web-tree-sitter` integration with seeded Python/TS diffs
- [ ] T124 [P] [US3] Unit test `tests/integration/append-only-enforcement.test.ts` — assert that `UPDATE` and `DELETE` on `signal_audit` raise permission errors at the DB level
- [ ] T125 [P] [US1+US2+US3] Unit test `tests/integration/feature-flag-coverage.test.ts` — every code path that touches a signal source checks the relevant feature flag; assert a flag-off user gets a 404 / 403
- [ ] T126 [P] [US3] Unit test `tests/integration/audit-pseudonymisation.test.ts` — assert that 90-day-old audit rows have their `actor_id` replaced and the operation is reversible by the admin
- [ ] T127 [P] [US1+US2+US3] E2E `tests/e2e/privacy-center-load.spec.ts` — `/settings/signals` page renders within 1.5s for a user with 6 sources (k6-style load check)

---

## Phase 9 — Cross-cutting polish

- [ ] T130 [P] Update `AGENTS.md` to reference the active 006 plan
- [ ] T131 [P] Update the top-level `README.md` with one paragraph per phase (IDE telemetry, biometrics, privacy center, audit) and the URL of the privacy center
- [ ] T132 [P] Add `docs/006-rollout-runbook.md` — operator runbook for staged rollout per `quickstart.md` §7 (Day 0/7/14/21 cohort dates)
- [ ] T133 [P] Add a DPDP audit-log addendum note in `docs/001-privacy-dpdpa.md` referencing `signal_audit` retention and the 7-year metadata window
- [ ] T134 [P] Add observability dashboards to `apps/web/src/app/admin/observability/signals/page.tsx`: audit integrity pass/fail, biometric correlator health, IDE upload success rate, DPDP queue depth, Oura/Whoop refresh failure rate
- [ ] T135 [P] Add `pnpm test:006` aggregator script to root `package.json` that runs all 006-tagged E2E and integration tests; verify the rollback path per `quickstart.md` §10 (`pnpm supabase migration repair --status reverted 039` + feature-flag flip)
- [ ] T136 [P] Run a final `pnpm lint && pnpm typecheck` from the monorepo root and resolve any new violations

---

## Parallel Opportunities

- Phase 0 (T001-T008) all parallel.
- Phase 1 (T010-T015) — T010 is the critical-path file; T011-T014 add DDL blocks to T010 in parallel.
- Phase 2 (T020-T027) all parallel after Phase 1.
- Phase 3a (T030-T031) all parallel; 3b (T035-T040) all parallel after 3a; 3c (T045-T048) all parallel after 3b; 3d (T050-T053) all parallel after 3c.
- Phase 4 (T055-T059) all parallel with the Phase 3b primitives.
- Phase 5a (T060-T063) all parallel; 5b (T065-T069) all parallel with 5a; 5c (T070-T077) all parallel after 5a+5b+Phase 1; 5d (T080-T086) all parallel after 5c.
- Phase 6a (T090-T091), 6b (T092-T095), 6c (T097-T098) all parallel after Phase 1; 6d (T099-T100) all parallel after 6a+6b.
- Phase 7 (T105-T110) all parallel with Phase 6 after Phase 1.
- Phase 8 (T115-T127) all parallel after their respective dependencies.
- Phase 9 (T130-T136) last (consolidation).

## Task Count Summary

| Phase | Tasks | Critical Path |
|---|---|---|
| 0 — Pre-flight | 8 | T007 |
| 1 — Migration 039 | 6 | T010 |
| 2 — Shared types | 8 | T026 |
| 3 — VS Code extension | 16 | T035-T040, T045, T046, T048 |
| 4 — Cursor fork | 5 | T055, T056 |
| 5 — Biometrics | 24 | T060, T061, T065, T070, T071 |
| 6 — Privacy Center UI | 10 | T090, T092, T093, T095 |
| 7 — Audit + integrity | 6 | T105, T107, T108 |
| 8 — Tests | 13 | T115, T117, T118 |
| 9 — Polish | 7 | T135 |
| **Total** | **103** | |

## Rollout Recommendation

1. Land Phases 0–1 + Phase 2 in sprint 1 (foundation; no user-visible surface yet).
2. Land Phase 3 + Phase 4 in sprint 2 (VS Code + Cursor extension behind `006_ide_telemetry` Day 7 cohort).
3. Land Phase 6 + Phase 7 in sprint 2 (privacy center Day 0 GA per `quickstart.md` §7; audit log is live for the IDE data).
4. Land Phase 5 in sprint 3 (Oura/Whoop Day 14 invited-only; HealthKit/Google Fit Day 21 gated on 005 production).
5. Land Phase 8 + Phase 9 in parallel with sprint 3 finish (cross-cutting tests + runbook).
6. Cohort rollout dates per `quickstart.md` §7.
