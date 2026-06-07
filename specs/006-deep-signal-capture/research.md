# Phase 0 Research: 006 — Deep Signal Capture

**Date**: 2026-06-06
**Status**: Decisions ratified; ready for Phase 1

Six architectural decisions for feature 006. Each captures the choice, the rejected alternatives, and the rationale.

---

## D1. VS Code extension API (not LSP) for IDE telemetry

**Decision**: Build a VS Code extension using the standard `vscode` extension API. Cursor is built as a downstream fork of the same source tree (Cursor is VS Code-compatible and accepts the same extension manifest with a different `publisher`).

**Alternatives considered**:
- **Language Server Protocol (LSP) capture** (rejected — LSP operates on syntax trees inside the editor, exposing us to complaints that we capture code structure; the extension API exposes only high-level events like `onDidChangeTextDocument` and `onDidStartDebugSession` which we use for aggregate counters, not content)
- **Chrome DevTools Protocol (CDP) tappin**g (rejected — only relevant for the existing Chrome extension `apps/extension`; CDP is a browser protocol, not a VS Code one)
- **In-process TypeScript Compiler API** (rejected for telemetry; reserved for a v2 plagiarism cross-check that is explicitly out of scope per spec.md "Out of Scope")

**Rationale**: The VS Code extension API gives us exactly the events we need — `onDidChangeTextDocument` for keystroke-entropy (we sample the *rate* of edits, not the content), `onDidStartDebugSession` + `onDidTerminateDebugSession` for debug duration, `onDidChangeDiagnostics` for error-resolution latency, terminal-task lifecycle for test runs — without ever requiring a language server or a content-aware parser. The Cursor fork is a one-line `manifest.json` change with the same `.ts` source.

**API events consumed**:
- `vscode.window.onDidChangeTextEditorSelection` + `onDidChangeTextDocument` → keystroke entropy (Shannon over key codes, no payload)
- `vscode.debug.onDidStartDebugSession` / `onDidTerminateDebugSession` / `onDidReceiveDebugSessionCustomEvent` → debug duration + step ratio
- `vscode.languages.onDidChangeDiagnostics` → error-resolution latency
- `vscode.tasks.onDidStartTask` / `onDidEndTask` with `task.name` matching `/test|jest|pytest|mocha|vitest/` → test-run count
- `vscode.window.onDidChangeActiveTextEditor` + a 30s tick → time-in-file
- Web Worker `web-tree-sitter` for AST-diff (lazy-loaded, only on supported language files)

---

## D2. AST-diff library: `web-tree-sitter` (WASM) in a Web Worker

**Decision**: Use `web-tree-sitter` (the WASM build of tree-sitter) loaded into a dedicated Web Worker. Only the diff between the previous AST and the current AST, summarized as `(nodes_added, nodes_removed, max_depth_delta)`, is returned to the main thread. No AST is ever sent to the server.

**Alternatives considered**:
- **`@babel/parser` + custom diff** (rejected — language-specific; tree-sitter covers Python, TS, JS, Go, Rust with one WASM build)
- **`jsdiff` on raw text** (rejected — would require sending text through the worker; defeats the privacy contract)
- **Server-side AST parsing** (rejected — violates the "server never sees source" property; would also create a per-keystroke request path)
- **`acorn` (JS-only)** (rejected — multi-language support is required for the Indian engineering curriculum; tree-sitter covers it in 1.2 MB WASM)

**Rationale**: `web-tree-sitter` is the de facto standard for syntax-tree tooling in the browser, runs in a Worker (no main-thread jank), and the WASM build is small enough to lazy-load only when the user opens a file with a supported language. The diff summary (`refactor_distance` = `nodes_added + nodes_removed` weighted by depth) is a single integer that we ship in the aggregate.

**Supported languages (v1)**: Python, TypeScript, JavaScript, Go, Rust. Others get a `refactor_distance = 0` contribution to that session.

**File-size guard**: Files > 2 MB are skipped from AST-diff but the rest of the session aggregate (keystrokes, debug, etc.) is still uploaded.

---

## D3. Oura & Whoop OAuth flow: server-side authorization code with PKCE

**Decision**: Server-side OAuth 2.0 authorization-code-with-PKCE for both Oura and Whoop. The mobile/web app hits `POST /api/biometrics/connect/oura` which returns the Oura authorization URL. The user completes consent on Oura's site, Oura redirects to `/api/biometrics/connect/oura/callback`, the server exchanges the code for tokens, encrypts the refresh token with pgsodium, and stores it in `biometric_connections`. The access token is used for daily fetches by the `biometric-correlator` edge function; the refresh token is used to renew.

**Alternatives considered**:
- **Client-side (Expo) OAuth with implicit flow** (rejected — refresh tokens should never live on a phone that may be lost; PKCE + server-side storage is the standard)
- **Long-lived access tokens (no refresh)** (rejected — Oura tokens expire in 24h, Whoop in 1h; refresh is mandatory)
- **Service-account / org-wide OAuth** (rejected — each user owns their own Oura/Whoop account; the OAuth dance is per-user)

**Rationale**: Server-side PKCE gives us refresh tokens that survive device loss (the user reconnects from a new device and the server still has the old tokens — they can disconnect from `/settings/signals`). It also means the Expo app never holds a refresh token, only an opaque session cookie. pgsodium encryption is the same approach 004 uses for `ats_connections.api_key_encrypted`.

**Failure modes**:
- Refresh fails 3× in a row → `biometric_connections.status = 'expired'`, privacy center shows a reconnect CTA
- OAuth provider returns a `4xx` on initial connect → row never written, error returned to UI
- User revokes the Oura app from the Oura dashboard → next refresh fails with `invalid_grant`; we mark the connection `expired` within 24h

---

## D4. HealthKit / Google Fit bridge: Expo mobile only, four scopes, never raw

**Decision**: HealthKit (iOS) and Google Fit (Android) are ingested exclusively through the 005 Expo mobile app. The mobile app requests the four read-only scopes (sleep analysis, HRV, resting heart rate, daily readiness), reads a daily summary, and posts ONE row per day to `POST /api/biometrics/mobile-sync`. Raw timestamps beyond the date are dropped on-device before transmission. The server never sees the HealthKit/Fit OAuth token.

**Alternatives considered**:
- **Native iOS/Android app in addition to Expo** (rejected — Expo covers 100% of the HealthKit/Fit API surface via `expo-healthkit` and `expo-health-connect`; native adds maintenance burden with no incremental capability)
- **Webhook from Health/Fit to the server directly** (rejected — these platforms do not support server-side webhooks for end-user data; the mobile app is the only legitimate ingestion path)
- **Continuous background sync** (rejected — Apple and Google both throttle background reads; daily summary is the supported cadence)

**Rationale**: This is the path of least friction. The 005 Expo app already requests `NSHealthShareUsageDescription` and `ACTIVITY_RECOGNITION` for the mock-interview feature; adding the four biometric scopes is a one-PR delta. The `mobile-sync` endpoint validates the user session, writes to `biometric_aggregates`, and emits a `signal_audit` row.

**Dependency on 005**: This story is explicitly blocked until 005 ships the Expo app. The feature flag `006_biometrics_mobile` defaults to off until 005 is in production; the same flag controls the mobile-side scope request.

---

## D5. Aggregation algorithms: 30-day TTL with monthly rollup for both channels

**Decision**: Both IDE and biometric raw aggregates have a per-source TTL (IDE: 30 days, biometric: 90 days) and roll up into monthly summaries that retain only `mean`, `p50`, `p90`, `count`, and `language_breakdown_json` (IDE) or `provider_breakdown_json` (biometric). The rollup runs in a nightly Supabase cron and writes a fresh `*_aggregates` row of `period_type='monthly'`. The raw rows are then hard-deleted. The monthly summaries are retained indefinitely until the user requests erasure.

**Alternatives considered**:
- **Indefinite raw retention** (rejected — the trust narrative requires bounded retention; "we keep everything forever" is the exact pattern that breaks DPDP compliance)
- **Append-only monthly summaries, never delete raw** (rejected — `ide_sessions` is the only table that gets close to 1.5M rows/day; the storage cost is non-trivial and unbounded raw retention signals a casual privacy posture)
- **Aggregations done in the extension / on-device** (rejected — the extension already produces a per-session aggregate; the daily rollup is a small SQL operation; on-device rollup would create a divergence between the per-session aggregate and the rollup that is hard to audit)

**Rationale**: 30 / 90 days is long enough to surface trends (a student's IDE productivity over a sprint, a biometric baseline over a quarter) and short enough to bound the blast radius of any privacy incident. Monthly summaries give the score aggregator a stable longitudinal signal. Hard-delete on TTL is the simplest correct implementation — there is no soft-delete that could be queried by mistake.

**Cron job**: `biometric-correlator` is the existing nightly 002 cron entry, extended to call `signal-purge` at the end. `signal-purge` walks all source tables and either rolls up or hard-deletes as appropriate.

---

## D6. DPDP compliance approach: consent at install, granular toggles, data-principal-rights endpoint, audit trail

**Decision**: DPDP Act 2023 compliance is achieved by four explicit mechanisms, each testable in isolation:

1. **Consent at install** — the VS Code / Cursor marketplace listing and the mobile-app first-run page show the data-capture contract (DPDP Section 6 "Notice"). The user must click "Enable" to begin capture. The click is logged as a `signal_audit` row with `action='enable'`.
2. **Granular per-source control** — `/settings/signals` provides a per-source toggle (DPDP Section 6 + 8). Each toggle is independent. Disabling a source does NOT delete existing data (TTL still applies); deletion requires an explicit "Delete all" action.
3. **Data-principal-rights endpoint** — the existing `privacy-request-deletion` edge function from 001 is extended to handle signal-source rows. The user invokes it from `/settings/signals` or via support. The 30-day statutory window is enforced (DPDP Section 12).
4. **Audit trail** — `signal_audit` is append-only. The `actor_id` is pseudonymised after 90 days; the `provider`, `byte_count`, and `aggregate_hash` are retained for 7 years (DPDP "record of processing" requirement, Section 8(4)).

**Alternatives considered**:
- **Third-party consent management platform (OneTrust, TrustArc)** (rejected — adds vendor dependency for a single, narrow consent surface; the existing 001 privacy surface already covers the rest of the app)
- **Soft-delete with "tombstone" rows** (rejected — DPDP is explicit about erasure; tombstones are a litigation risk)
- **On-device-only processing, no server capture** (rejected — the score is server-computed; the entire feature would not exist)

**Rationale**: The four-mechanism approach is the minimum that satisfies DPDP. Each mechanism has a single implementation file, a single test, and a single audit row. The combination is reviewable by an external privacy counsel in < 1 day.

**Cross-cutting decision**:
- All `*_aggregates` tables have RLS enabled and only the score aggregator (service role) can read them across users; individual users can read their own.
- The `signal_audit` table is `REVOKE UPDATE, DELETE` from all roles including `service_role`; the only way to add a row is `INSERT`. The nightly integrity check (`SC-PRI-001`) verifies the row count matches the expected per-event count.

---

## Cross-cutting decisions (inherited from 004)

- **Migrations land additive (039).** No destructive changes. The migration is independently reversible.
- **All new edge functions emit structured logs to `supabase.functions.invoke_log`** for the existing observability stack.
- **All new external dispatches (Oura, Whoop, biometric-correlator) log to a feature-scoped audit table** with `actor`, `subject`, `action`, `payload_hash`, `created_at`.
- **Feature flags via existing `feature_flags` table** (added in 002, extended in 003, 004): every 006 capability ships behind a flag for cohort rollout.
- **All P2 features are explicitly behind a flag from day 1** (biometrics) so they can be rolled out to small cohorts first; P1 (IDE telemetry, privacy center) ship behind flags from day 1 too — the trust narrative demands a controlled launch.
