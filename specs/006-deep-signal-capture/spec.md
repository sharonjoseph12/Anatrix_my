# Feature Specification: 006 — Deep Signal Capture

**Feature Branch**: `006-deep-signal-capture`
**Created**: 2026-06-06
**Status**: Draft
**Builds on**: 001 (foundation) + 002 (verified skill platform) + 003 (engage & showcase) + 004 (defensible moat) + 005 (Expo mobile)
**Input**: User vision to passively enrich the existing Skill Proof Score with two new, opt-in, privacy-respecting signal channels — IDE telemetry and biometric integrations — and to expose both behind a unified privacy center with a DPDP-compliant audit trail.

## Why this exists

The Skill Proof Score today is built from explicit, user-asserted inputs (GitHub repos, DSA submissions, hackathon participation, mock interviews, faculty grades) and from the peak-window detector introduced in 002. That is defensible but shallow: it cannot see the *context* in which a student actually does their best work, and it cannot distinguish a 4 AM grind session from a 10 AM deep-work block. The result is a score that is correct in the aggregate but blind to the most actionable truth — *when* and *under what biological conditions* a student is sharpest.

At the same time, any additional signal channel raises the cost of the trust narrative if mishandled. India DPDP Act 2023 + student sensitivity to surveillance make a careless rollout career-ending. This feature therefore ships with two signal channels (IDE + biometrics) and a third foundational story — the Privacy Center + Audit log — that must land at the same time, behind the same flags, and that the user must encounter before either channel becomes active.

The bar is: every byte that lands on Antarix servers must be auditable, the user must be able to inspect, disable, and delete it in one click, and the score contribution must be capped (≤ 3% from IDE, ≤ 2% from biometrics) so that even a worst-case privacy incident cannot materially distort the existing 95%-of-the-score infrastructure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — IDE Telemetry enriches the Skill Proof Score (Priority: P1)

A third-year student at an NIT installs the Antarix VS Code extension from the marketplace. The install flow explains — in plain language, in the user's selected UI locale — exactly which aggregates will be captured (keystroke entropy per minute, debug-session duration, AST-diff refactor distance, time-in-file, test-run frequency, error-resolution latency) and that raw keystrokes and source code never leave the device. The student clicks "Enable", works for a week, and at the next score recompute sees a new line in their Skill Proof breakdown: "IDE Telemetry: +2.4% (3% cap)". When they open the privacy center, they see the last 5 daily aggregates and a one-click uninstall button that purges all server-side data and revokes the device token.

**Why this is P1**: The existing 002 peak-window detector is reactive; IDE telemetry is the first *proactive* in-the-flow-of-work signal. It also de-risks the larger 004 anti-cheat story — the same channel that captures legitimate aggregates can later detect session anomalies — and it provides the longitudinal data the next-best-skill recommender (004 US10) and the college-leaderboard (003) need to differentiate students.

**Independent test**: Install the extension in a clean VS Code Code instance. Edit a Python file (3 minutes, 2 saves, 1 test run, 1 deliberate syntax error then fix). Disable the extension. Assert: 1 `ide_sessions` row with `duration_seconds ≈ 180`, `keystroke_entropy_bpm`, `test_run_count=1`, `error_resolution_latency_ms` set; 1 `ide_aggregates` row; 1 `signal_audit` row with `byte_count` > 0 and `aggregate_hash`; 0 rows in any table the extension should not write. After uninstall: all rows for that `device_id` deleted within 60s.

**Acceptance scenarios**:
1. **Given** a user who has not enabled IDE telemetry, **when** the extension is installed, **then** it ships disabled by default and the first-run page shows the data-capture contract with an "Enable" button that requires an explicit click.
2. **Given** an enabled extension capturing a 30-minute coding session, **when** the session ends (idle 5 min or explicit stop), **then** exactly one `ide_sessions` row and one `ide_aggregates` row are uploaded; no row contains source-code text or raw keystroke sequences.
3. **Given** an enabled extension, **when** the user disables it from the privacy center, **then** all `ide_sessions` and `ide_aggregates` rows for that `device_id` are queued for deletion within 60 seconds and the `biometric_connections` toggle (if any) remains untouched.
4. **Given** a student with ≥ 7 days of enabled IDE telemetry, **when** the score recompute runs, **then** the IDE contribution is bounded by `min(raw_ide_score, 3)` percentage points and the breakdown card labels the cap.
5. **Given** an extension session, **when** the user is offline, **then** aggregates are buffered locally (IndexedDB), uploaded on next online, and discarded after 7 days if still unsent.

---

### User Story 2 — Biometric integrations sharpen peak-window confidence (Priority: P2)

A final-year student at a Tier-2 college opens the Antarix Expo mobile app (built in 005), goes to `/settings/signals`, and sees "Apple HealthKit — connect". She taps, grants the four read scopes (sleep, HRV, resting heart rate, activity), and within 30 seconds the privacy center shows "Apple HealthKit — connected, last sync 12s ago". The next morning the AI Coach push notification she receives is unchanged in content, but the "Your peak window today" card in the dashboard now cites biometrics: "Based on your sleep (7h 12m) and HRV (62ms, your 30-day average is 58ms), your peak window today is 10:30–12:45 with 0.74 confidence." A separate student using an Oura Ring receives the same card sourced from the Oura API. Each provider toggle is independent.

**Why this is P2**: This is the highest-information signal in the system and the most sensitive. It cannot ship before the Privacy Center (US3) exists; once it does, the value is genuine but the population is split across multiple devices. P2 reflects the realistic rollout — opt-in students, granular per-provider toggles, 90-day raw-aggregate TTL.

**Independent test**: Seed a student with `peak_window_inferences` rows from the 002 detector. Mock the Oura `/v2/usercollection/daily_sleep` endpoint to return `score=85, hrv_avg=62, resting_hr=54`. Trigger `biometric-correlator`. Assert: 1 new `peak_window_inferences` row with `confidence >= 0.7` and `biometric_inputs_hash` set; 1 `biometric_aggregates` row (sleep quality + HRV); 1 `signal_audit` row; existing 002 detector output preserved.

**Acceptance scenarios**:
1. **Given** a student with HealthKit scope granted, **when** HealthKit posts a sleep sample to the Expo bridge, **then** the mobile app posts exactly one `biometric_aggregates` row per day to the server, with the four required fields populated and no raw timestamps beyond the date.
2. **Given** a student with an Oura OAuth connection, **when** the daily `biometric-correlator` edge function runs, **then** it fetches the Oura daily summary, hashes the input, and writes to `biometric_aggregates` and `peak_window_inferences` only.
3. **Given** a student who disables the Google Fit toggle, **when** the next correlation run happens, **then** Google Fit data is excluded from inputs and the other providers (HealthKit, Oura) are unaffected.
4. **Given** a student with no biometric sources connected, **when** the peak-window card renders, **then** it shows the existing 002 detector output unchanged — the biometric contribution is additive, never substitutive.
5. **Given** a 91-day-old raw biometric row, **when** the nightly retention cron runs, **then** the row is rolled up into a `biometric_aggregates` monthly summary row and the raw row is deleted; the summary is retained indefinitely until the user requests deletion.

---

### User Story 3 — Privacy Center + Audit log (Priority: P1, foundational)

A student at any stage of their Antarix journey opens `/settings/signals` from the dashboard. They see, in one screen: every active signal source with a status pill, the last 5 aggregate timestamps, a plain-language "What we learned about you" panel that explains the score contribution in non-technical terms, a per-signal disable toggle, and a single red "Delete all and disconnect" button at the bottom. Behind the scenes, every single upload — IDE aggregate, biometric aggregate, even a privacy-center page load that fetches data — writes a `signal_audit` row with `provider`, `byte_count`, `aggregate_hash`, and never the content. A college admin can request an audit dump for any student and see the full chain of consent and data access events. The whole surface conforms to India DPDP Act 2023 (Sections 6 consent, 8 data principal rights, 10 erasure).

**Why this is P1, foundational**: US1 and US2 cannot ship without it. A signal-capture product without a one-stop privacy page is, in 2026, a regulatory and PR liability. The audit log is the only durable evidence of the trust claim; without it, claims like "we never see your raw code" are unfalsifiable. This story is the gate.

**Independent test**: Authenticate as a student with 2 connected providers (VS Code + Oura) and 1 disconnected (HealthKit, scope-denied). GET `/api/settings/signals`. Assert: response lists 2 active sources with `last_5_aggregates` arrays of length ≤ 5, 1 disconnected source with `status: disconnected` and zero `last_5_aggregates`, and the "what_we_learned" panel contains a non-empty string per active source. POST DELETE on the VS Code source; assert: source row soft-deleted, all child `ide_aggregates` rows for that `device_id` are queued for purge, `signal_audit` row written with `action: signal_deleted`.

**Acceptance scenarios**:
1. **Given** a student with any number of connected signal sources, **when** they navigate to `/settings/signals`, **then** the page renders within 2 seconds with all source states, the last 5 aggregates per source, and the plain-language explanation.
2. **Given** a student who clicks "Delete all and disconnect", **when** the action is confirmed, **then** every `ide_sessions`, `ide_aggregates`, `biometric_aggregates`, `peak_window_inferences` (that cite biometrics), and `biometric_connections` row for that user is queued for purge, the user receives a confirmation email, and the action is recorded in `signal_audit` with `actor_id` = self.
3. **Given** a college admin with audit access, **when** they request the audit dump for a student, **then** the response is a paginated list of `signal_audit` rows for that student_id, ordered by `created_at DESC`, with no payload content exposed (only the hash and metadata).
4. **Given** a student on the privacy page, **when** they disable a single signal source, **then** the source's toggle flips to "off", no new aggregates are written, the source's existing data is preserved for the configured TTL, and a `signal_audit` row is written.
5. **Given** a DPDP data-principal-rights request for erasure, **when** the request is processed, **then** all signal-source rows for the user are hard-deleted within 30 days and an erasure-complete `signal_audit` row is written as the terminal event.

---

### Edge Cases

- **IDE extension network failure mid-upload** → local buffer (IndexedDB, 7-day TTL) replays on next online; if buffer exceeds 7 days, user is notified in the privacy center; if user disables, the buffer is purged.
- **VS Code user revokes only the keystroke-entropy scope via OS-level dialog** → extension degrades to "partial capture" mode, surfaces a banner in the privacy center, and the score contribution is recalculated against the partial aggregate set with a `partial_capture: true` flag.
- **Biometric provider OAuth refresh failure** → service retries with exponential backoff for 24h, then marks the connection `expired`; the privacy center surfaces a reconnect CTA; the user is never silently dropped to "connected but stale".
- **Oura / Whoop API rate-limit** → `biometric-correlator` schedules the next run in 1h and emits a `rate_limited` metric; user-facing UI is unaffected.
- **AST-diff returns invalid (e.g. file too large > 2 MB, parse error)** → the file is excluded from that session's `refactor_distance` aggregate, the rest of the aggregates are uploaded, and the error is logged to the extension's telemetry channel (NOT to `signal_audit`).
- **Two devices, same user, IDE telemetry enabled on both** → device_id disambiguates; the score contribution is per-device then averaged with a `device_count` adjustment so a user with 2 devices is not double-rewarded.
- **HealthKit user revokes after sync, then re-grants** → the previous `biometric_aggregates` rows are preserved (within 90-day TTL); the new grant is treated as a fresh connection with a new `connection_id`.
- **DPDP data-principal-rights request mid-cron** → purge cron and erasure job use the same advisory lock on `user_id`; one waits for the other.
- **Audit log table itself becomes a target of a data-subject-access request** → metadata-only rows (hash + provider + byte count) are retained for the legal-record-keeping period; the `actor_id` is pseudonymised after 90 days.
- **IDE extension runs in a Cursor IDE fork** → Cursor fork is built from the same source with a different `publisher` field; the schema, API, and behaviour are identical, and the privacy center shows them as one logical source "IDE Telemetry (VS Code / Cursor)" with separate `device_id` rows.

## Requirements *(mandatory)*

### Functional Requirements

#### IDE Telemetry (P1)
- **FR-IDE-001**: System MUST provide a VS Code Marketplace extension and a Cursor Marketplace fork that capture ONLY pre-defined aggregates (no raw keystrokes, no source code, no file paths beyond the project-relative form).
- **FR-IDE-002**: Captured aggregates per session MUST be limited to: `keystroke_entropy_bpm`, `debug_session_duration_seconds`, `debug_step_ratio`, `ast_refactor_distance`, `time_in_file_seconds`, `test_run_count`, `error_resolution_latency_ms`.
- **FR-IDE-003**: Each extension MUST buffer aggregates locally (IndexedDB), upload at most one row per session (≤ 30 minutes), and discard the buffer after 7 days if still unsent.
- **FR-IDE-004**: IDE contribution to the Skill Proof Score MUST be capped at 3 percentage points; the cap MUST be enforced server-side in the score aggregator (the client is never trusted).
- **FR-IDE-005**: Raw aggregate rows MUST be retained for 30 days, then rolled into a monthly summary that contains no individual-session data; the summary is retained until the user requests deletion.
- **FR-IDE-006**: Extension uninstall MUST purge all server-side rows for that `device_id` within 60 seconds and revoke the device token.

#### Biometric Integrations (P2)
- **FR-BIO-001**: System MUST support OAuth integrations with Apple HealthKit (via 005 Expo mobile bridge), Google Fit (via Expo), Oura Ring API, and Whoop API.
- **FR-BIO-002**: Each integration MUST capture at most: `sleep_duration_minutes`, `sleep_quality_score`, `hrv_ms`, `resting_hr_bpm`, `daily_readiness_score` (when the provider exposes one).
- **FR-BIO-003**: Each integration MUST be opt-in with a granular per-provider toggle in the privacy center; toggling one provider off MUST NOT affect the others.
- **FR-BIO-004**: Biometric contribution to the Skill Proof Score MUST be capped at 2 percentage points; cap enforced server-side.
- **FR-BIO-005**: A nightly correlation job MUST combine the latest biometric aggregates with the 002 peak-window detector output and the latest IDE aggregates (US1) to produce a `peak_window_inferences` row with a confidence ∈ [0, 1].
- **FR-BIO-006**: Raw biometric points MUST be retained for 90 days, then rolled into monthly summaries that are retained indefinitely until the user requests deletion.
- **FR-BIO-007**: HealthKit and Google Fit ingestion MUST go through the Expo mobile app (005); Oura and Whoop MUST go through server-side OAuth with refresh tokens stored in `biometric_connections` (encrypted at rest).

#### Privacy Center + Audit (P1, foundational)
- **FR-PRI-001**: System MUST provide a `/settings/signals` page listing every active and disconnected signal source, the last 5 aggregate timestamps per source, and a plain-language "what we learned about you" panel.
- **FR-PRI-002**: System MUST provide a per-source disable toggle that, when flipped, prevents new uploads from that source within 60 seconds.
- **FR-PRI-003**: System MUST provide a "Delete all and disconnect" action that queues all signal-source rows for purge and writes a terminal `signal_audit` row.
- **FR-PRI-004**: Every signal upload MUST write a `signal_audit` row with `provider`, `byte_count`, `aggregate_hash`, and never the content; the row is append-only.
- **FR-PRI-005**: College admins with `audit:read` scope MUST be able to fetch a paginated audit dump for any student via the admin API.
- **FR-PRI-006**: The privacy surface MUST conform to India DPDP Act 2023 — explicit consent at install, granular per-source control, data-principal-rights endpoint for erasure and access, audit trail.
- **FR-PRI-007**: When a signal source is disabled, the existing aggregate rows MUST remain queryable for the score recompute (within their TTL) but MUST be excluded from any newly-rendered dashboard card or AI Coach output that references the disabled source.
- **FR-PRI-008**: The `signal_audit` table MUST be enforced as append-only via a `REVOKE UPDATE, DELETE` statement covering all roles including `service_role`; only `INSERT` is permitted. The nightly integrity check (FR-AUD-001) verifies this invariant.

#### Audit Log Integrity (P1, foundational)
- **FR-AUD-001**: System MUST run a nightly job (`signal-audit-integrity-check`) that asserts (a) every `signal_audit` row has non-null `provider`, `byte_count`, and `aggregate_hash` (where applicable), and (b) the row-count delta matches the expected per-event count. Failures MUST page the on-call engineer.
- **FR-AUD-002**: System MUST pseudonymise `signal_audit.actor_id` 90 days after `created_at` by replacing it with a salted SHA-256 of the original id; the salt is rotated yearly. The pseudonymisation MUST be reversible only by an admin with `audit:read` AND `audit:unmask` dual scope.
- **FR-AUD-003**: `signal_audit` metadata (provider, byte_count, aggregate_hash, created_at) MUST be retained for 7 years to satisfy DPDP Section 8(4) "record of processing". The nightly `signal-purge` job enforces the retention window; nothing else deletes from this table.

#### Score Cap Enforcement (P1, foundational)
- **FR-CAP-001**: The IDE contribution to the Skill Proof Score MUST be capped at 3 percentage points; the cap MUST be enforced server-side via the `ide_aggregates.score_contribution` CHECK constraint and a defense-in-depth clamp in the score aggregator. The client is never trusted.
- **FR-CAP-002**: The biometric contribution to the Skill Proof Score MUST be capped at 2 percentage points; the cap MUST be enforced server-side via the score aggregator. The cap is the max per source, not a sum.
- **FR-CAP-003**: A student with both IDE and biometrics enabled MAY contribute up to 5 percentage points combined; the score aggregator MUST clamp the sum and label both contributions separately in the breakdown card.

### Key Entities

- **ide_sessions** — one row per ≤ 30-min coding session captured by the extension. Columns: `id`, `device_id`, `student_id`, `started_at`, `ended_at`, `duration_seconds`, `editor` (vscode/cursor), `project_hash`, `language`, `keystroke_entropy_bpm`, `debug_session_duration_seconds`, `debug_step_ratio`, `ast_refactor_distance`, `time_in_file_seconds`, `test_run_count`, `error_resolution_latency_ms`, `raw_partial_capture`, `uploaded_at`.
- **ide_aggregates** — daily rollup across sessions. Columns: `id`, `device_id`, `student_id`, `day` (date), `session_count`, `total_active_seconds`, `language_breakdown_json`, `productivity_score_raw`, `score_contribution` (capped at 3), `computed_at`.
- **biometric_connections** — one row per (user, provider) OAuth connection. Columns: `id`, `student_id`, `provider` (healthkit/google_fit/oura/whoop), `status` (connected/expired/disconnected), `oauth_refresh_token_encrypted`, `last_sync_at`, `last_error`, `connected_at`, `scopes_json`.
- **biometric_aggregates** — daily or monthly summary per provider. Columns: `id`, `connection_id`, `student_id`, `provider`, `period_type` (daily/monthly), `period_start`, `sleep_duration_minutes`, `sleep_quality_score`, `hrv_ms`, `resting_hr_bpm`, `daily_readiness_score`, `source_hash`, `created_at`.
- **peak_window_inferences** — one row per inference cycle. Columns: `id`, `student_id`, `window_start`, `window_end`, `confidence`, `biometric_inputs_hash`, `ide_inputs_hash`, `detector_inputs_hash` (from 002), `source_mix` (jsonb: which inputs contributed), `created_at`.
- **signal_audit** — append-only audit log. Columns: `id`, `actor_id` (nullable for system), `actor_type` (system/student/admin/colleague_admin), `student_id`, `provider` (ide_*/biometric_*/privacy_center), `action` (upload/disable/enable/delete_all/audit_read/erasure_complete), `byte_count`, `aggregate_hash`, `payload_redacted` (always true), `created_at`.

## Out of Scope (Deferred to v2)

These were considered and explicitly deferred:
1. **Windows Activity / macOS Screen Time ingestion** — Defer until consumer-laptop OS APIs stabilise; the DPDP + employer-laptop intersection is unsolved.
2. **Continuous glucose monitor (CGM) integrations** — Defer; medical-device-adjacent data raises regulatory bar (DPDP "health data" classification).
3. **IDE-level project content hashing for plagiarism cross-check** — Defer to v2; out of scope for signal capture and risks an off-label use of the channel.
4. **Whoop recovery score as a standalone signal** — Defer; we capture `daily_readiness_score` (which Whoop exposes) but do not separately call out the proprietary Whoop recovery metric.
5. **Per-keystroke rhythm capture for biometric authentication** — Permanently out of scope; would create a surveillance channel incompatible with the trust narrative.

## Success Criteria *(mandatory, measurable)*

### Measurable Outcomes

- **SC-IDE-001**: ≥ 8% of active students install the IDE extension within 60 days of launch.
- **SC-IDE-002**: ≥ 60% of installers keep the extension enabled for ≥ 30 days (retention proxy).
- **SC-IDE-003**: The mean daily IDE aggregate upload rate stays above 90% of enabled-device-days (i.e. < 10% silent failures).
- **SC-BIO-001**: ≥ 5% of active students connect at least one biometric provider within 90 days.
- **SC-BIO-002**: Peak-window confidence (post-biometric) is ≥ 0.65 for ≥ 40% of inferences where any biometric source is connected (vs. the 002 baseline).
- **SC-PRI-001**: 100% of `signal_audit` rows have non-null `provider`, `byte_count`, `aggregate_hash` (audit integrity check; runs nightly).
- **SC-PRI-002**: The median time from a user clicking "Delete all" to all rows being purgeable (excluding the 30-day DPDP legal hold for anonymised audit) is ≤ 5 minutes.
- **SC-DPDP-001**: 100% of DPDP data-principal-rights requests for signal data are fulfilled within the 30-day statutory window.

## Assumptions

- **VS Code Marketplace publishing is available to Antarix** — publisher account exists; Cursor Marketplace follows the same process (Cursor is a VS Code-compatible fork).
- **005 Expo mobile app is shipped before biometric capture (HealthKit/Google Fit) is enabled** — biometric ingestion is wired to the Expo bridge with a feature flag `006_biometrics_mobile` that defaults to off until 005 ships.
- **Oura and Whoop OAuth apps are pre-registered** with Antarix as the redirect target.
- **The 002 peak-window detector continues to be the source of truth for non-biometric peak windows** — biometric contribution is additive confidence, never a substitute.
- **The existing `feature_flags` table from 002/004 holds three new flags**: `006_ide_telemetry`, `006_biometrics_oura`, `006_biometrics_whoop`, `006_biometrics_mobile`, `006_privacy_center`.
- **AST-diff runs in the extension's Web Worker, not on the server** — server never receives parsed ASTs.
- **A student can be enrolled in IDE telemetry and biometrics simultaneously**; the two caps (3% + 2%) stack at ≤ 5 percentage points combined.
- **Cursor extension is a downstream fork, not a separate codebase** — Cursor uses VS Code's extension API, so the extension is published twice with different `publisher` and `displayName` but identical source.
