# Quickstart: 006 — Deep Signal Capture

**Date**: 2026-06-06
**Prereqs**: 001 + 002 + 003 + 004 + 005 quickstarts already executed. The 005 Expo mobile app MUST be in production before flipping the `006_biometrics_mobile` flag on.

## 1. New environment variables

Add to `.env.local` (and document in `.env.local.example`):

```env
# === IDE telemetry ===
IDE_TELEMETRY_MAX_SESSION_SECONDS=1800
IDE_TELEMETRY_AST_MAX_FILE_BYTES=2097152          # 2 MB
IDE_TELEMETRY_BUFFER_TTL_DAYS=7
IDE_TELEMETRY_DEVICE_JWT_SECRET=<>=32-char-random
IDE_TELEMETRY_DEVICE_JWT_TTL_HOURS=2160           # 90 days, refreshed on each upload
IDE_TELEMETRY_UPLOAD_BATCH_SIZE=20

# IDE score cap
IDE_TELEMETRY_MAX_SCORE_CONTRIBUTION_PCT=3

# === Biometric providers ===
# Oura
OURA_CLIENT_ID=<oura-developer-app-client-id>
OURA_CLIENT_SECRET=<oura-developer-app-client-secret>
OURA_REDIRECT_URI=https://<host>/api/biometrics/connect/oura/callback
OURA_API_BASE=https://api.ouraring.com/v2
OURA_REFRESH_FAILURE_THRESHOLD=3

# Whoop
WHOOP_CLIENT_ID=<whoop-developer-app-client-id>
WHOOP_CLIENT_SECRET=<whoop-developer-app-client-secret>
WHOOP_REDIRECT_URI=https://<host>/api/biometrics/connect/whoop/callback
WHOOP_API_BASE=https://api.prod.whoop.com/v1
WHOOP_REFRESH_FAILURE_THRESHOLD=3

# HealthKit / Google Fit (mobile-handled; server has no secret)
BIOMETRIC_MOBILE_SYNC_MAX_DAILY_ROWS=1             # enforce 1 row/day/device/provider
BIOMETRIC_MOBILE_HMAC_SECRET=<>=32-char-random    # HMAC of the mobile client payload
# 005 Expo bridge target (used by the biometric mobile-sync client; 005 must be in production)
APPLE_HEALTHKIT_BRIDGE_URL=https://<host>/api/biometrics/mobile-sync
# Google Fit OAuth (server-side webhook verifier + scope config; HealthKit uses the bridge above)
GOOGLE_FIT_CLIENT_ID=<google-fit-oauth-client-id>
GOOGLE_FIT_REDIRECT_URI=https://<host>/api/biometrics/connect/google_fit/callback

# Biometric score cap
BIOMETRICS_MAX_SCORE_CONTRIBUTION_PCT=2

# === Privacy / DPDP ===
SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT=<>=16-char-random
SIGNAL_AUDIT_RETENTION_YEARS=7
PRIVACY_TTL_IDE_DAYS=30
PRIVACY_TTL_BIOMETRIC_DAYS=90
PRIVACY_TTL_PEAK_WINDOW_DAYS=30
DPDP_ERASURE_HARD_DELETE_GRACE_DAYS=30            # statutory window

# === Cron ===
SIGNAL_PURGE_CRON_HOUR_UTC=3                      # 03:00 UTC nightly
BIOMETRIC_CORRELATOR_CRON_HOUR_UTC=4              # 04:00 UTC nightly
```

## 2. Migrations (run in order)

```bash
pnpm supabase db push       # applies 039 (and 044_cron_006.sql in the same release)
```

Migration order:
1. `043_deep_signal_capture.sql` — 6 new tables, RLS, append-only enforcement on `signal_audit`
2. `044_cron_006.sql` — `biometric-correlator` nightly, `signal-purge` nightly, `signal-audit-integrity-check` nightly

## 3. New Edge Functions to deploy

```bash
pnpm supabase functions deploy biometric-correlator
pnpm supabase functions deploy signal-purge
pnpm supabase functions deploy signal-audit-integrity-check   # optional helper; runs as part of 029_cron_002 baseline
```

Each function uses the secret bundle declared in step 1.

## 4. Provider app registration (one-time)

### Oura
1. Visit https://cloud.ouraring.com/personal-access-tokens or apply for Oura Cloud Developer access.
2. Register a new OAuth 2.0 application; set the redirect URI to `OURA_REDIRECT_URI` from step 1.
3. Copy the client ID and client secret into `.env.local`.
4. Request scopes: `daily`, `heartrate`, `workout`, `sleep`, `personal`. The correlator will use only `daily` + `sleep` + `personal`.

### Whoop
1. Apply at https://developer.whoop.com for a developer account.
2. Create an OAuth 2.0 application; set the redirect URI to `WHOOP_REDIRECT_URI`.
3. Copy the client ID and client secret into `.env.local`.
4. Request scopes: `read:profile`, `read:recovery`, `read:sleep`, `read:cycles`. The correlator will use `read:recovery` + `read:sleep` + `read:profile`.

### HealthKit / Google Fit
No server-side app registration needed. The 005 Expo mobile app requests the scopes from the user. The server receives the daily aggregate via `POST /api/biometrics/mobile-sync` authenticated by a device-scoped HMAC.

## 5. IDE extension development workflow

```bash
# 1. Open apps/extension-ide in VS Code
code apps/extension-ide

# 2. Install dependencies
pnpm --filter @antarix/extension-ide install

# 3. Compile TypeScript in watch mode
pnpm --filter @antarix/extension-ide watch

# 4. Launch the extension in an Extension Development Host window
#    (use the "Run Extension" launch config from .vscode/launch.json)
#    Press F5 in VS Code → a new VS Code window opens with the extension loaded

# 5. Test inside the host window: edit a Python file, run a test, hit F5 to launch
#    debug, etc. The extension writes a session aggregate to the local IndexedDB
#    buffer. Open the Command Palette → "Antarix: Flush Telemetry Buffer" to
#    force-upload to the staging server.

# 6. To package the .vsix for Marketplace submission:
pnpm --filter @antarix/extension-ide package       # produces antarix-ide-0.1.0.vsix

# 7. To produce the Cursor fork:
TARGET=cursor pnpm --filter @antarix/extension-ide package
#     → antarix-cursor-ide-0.1.0.vsix
```

The two `.vsix` files are uploaded to:
- VS Code Marketplace: `https://marketplace.visualstudio.com/manage` (publisher `antarix`)
- Cursor Marketplace: `https://cursor.com/marketplace` (publisher `antarix-cursor`)

## 6. Local testing setup

### 6.1. Start the local Supabase stack

```bash
pnpm supabase start
```

### 6.2. Run the migration

```bash
pnpm supabase db reset       # drops + re-applies all migrations including 039
```

### 6.3. Seed a test user

```bash
pnpm supabase db seed --file supabase/seed/006_signals_test.sql
```

This creates a user `signals-test@antarix.test` with one connected Oura connection and one historical IDE aggregate.

### 6.4. Trigger the nightly jobs manually (dev only)

```bash
# Force the biometric correlator to run
pnpm supabase functions invoke biometric-correlator --no-verify-jwt

# Force the signal purge to run
pnpm supabase functions invoke signal-purge --no-verify-jwt
```

### 6.5. Smoke-test the privacy center

1. Sign in as `signals-test@antarix.test` in the local web app.
2. Navigate to `/settings/signals`.
3. Assert: page shows 1 connected source (Oura), 0 disconnected sources, the last 5 aggregates, and a "what we learned" panel.
4. Click "Disconnect Oura" → assert: source moves to "disconnected" with a `signal_audit` row.
5. Click "Delete all and disconnect" → confirm → assert: all `biometric_aggregates` rows for the user are queued for purge and a `signal_audit` row is written.

### 6.6. Smoke-test the IDE extension

1. Run the extension host (step 5.4 above).
2. Edit a `.py` file for ~3 minutes. Save 2×. Run a `pytest` command. Trigger a syntax error and fix it.
3. Run "Antarix: Flush Telemetry Buffer" from the Command Palette.
4. Assert: 1 row in `ide_sessions`, 1 row in `ide_aggregates` (daily), 1 row in `signal_audit` with `provider = 'ide_vscode'`, `byte_count` > 0, `aggregate_hash` set.
5. Run the "Antarix: Revoke Device" command. Assert: all `ide_sessions` and `ide_aggregates` rows for that `device_id` are queued for purge.

## 7. Feature flags

Add to `supabase/seed.sql` and to the admin console:

```sql
insert into feature_flags (key, enabled, cohort_pct, description) values
  ('006_ide_telemetry',     false, 0,   'VS Code + Cursor IDE telemetry capture (US1)'),
  ('006_biometrics_oura',    false, 0,   'Oura Ring OAuth connection (US2)'),
  ('006_biometrics_whoop',   false, 0,   'Whoop OAuth connection (US2)'),
  ('006_biometrics_mobile',  false, 0,   'HealthKit + Google Fit via 005 Expo app (US2)'),
  ('006_privacy_center',     false, 0,   'Privacy Center + audit log surface (US3)');
```

Recommended cohort rollout:
- `006_privacy_center` — Day 0 GA (P1, foundational)
- `006_ide_telemetry` — Day 7 cohort (10% → 50% → 100% over 14 days)
- `006_biometrics_oura` — Day 14 invited-only
- `006_biometrics_whoop` — Day 14 invited-only
- `006_biometrics_mobile` — Day 21 (gated on 005 production readiness)

## 8. Observability

- **Audit integrity**: nightly check that every signal event has a matching `signal_audit` row.
- **Biometric correlation health**: daily count of `peak_window_inferences` rows by `source_mix` keys (expect 100% to include `002_detector`; expect ≥ 30% to include `biometric` after Day 30).
- **IDE upload success rate**: `count(ide_sessions where uploaded_at is not null) / count(intended uploads)` — expect > 90% over rolling 7 days.
- **DPDP queue depth**: `count(*) from signal_audit where action = 'delete_all' and created_at > now() - interval '30 days'` — alert if > 0 unanswered.
- **Oura / Whoop refresh failure rate**: `count(biometric_connections where last_error is not null and last_sync_at > now() - interval '24 hours')` — alert if > 5.

## 9. DPDP data-principal-rights runbook

When a user files an erasure request via `/settings/signals` or via support:

1. The UI calls `POST /api/settings/signals/{source}` (single source) OR the `privacy-request-deletion` edge function (delete-all).
2. Both paths write a `signal_audit` row with `action = 'delete_one'` or `action = 'delete_all'`.
3. The nightly `signal-purge` job scans for new `signal_audit` rows of those actions and hard-deletes the corresponding rows from `ide_sessions`, `ide_aggregates`, `biometric_connections`, `biometric_aggregates`, `peak_window_inferences` (when `biometric_inputs_hash` matches the user).
4. After 30 days (DPDP statutory window), the `signal_audit` row's `actor_id` is pseudonymised; the aggregate hash is retained.
5. A terminal `signal_audit` row with `action = 'erasure_complete'` is written by the same job.

## 10. Rollback

```bash
pnpm supabase migration repair --status reverted 039
# then drop statements in supabase/migrations/_rollback/006/039.sql
```

Feature flags allow logical rollback without DB migration reversal.
