# 006 — Rollout Runbook (Operator)

**Scope**: Feature 006 — *Deep Signal Capture* (IDE telemetry, biometric integrations, privacy center + audit log).
**Audience**: SRE / platform on-call + product ops.
**Source spec**: `specs/006-deep-signal-capture/quickstart.md` (env vars, migrations, smoke tests) and `specs/006-deep-signal-capture/research.md` (decisions D1–D12).

---

## 0. Pre-flight checklist (run before touching any flag)

```bash
# 1. Migrations applied, in order
pnpm supabase migration list | grep -E "043|044"
#    expect:  043_deep_signal_capture  044_cron_006  | applied

# 2. All new env vars present in the target environment
for v in \
  IDE_TELEMETRY_ENABLED IDE_TELEMETRY_API_BASE \
  OURA_CLIENT_ID OURA_CLIENT_SECRET OURA_REDIRECT_URI \
  WHOOP_CLIENT_ID WHOOP_CLIENT_SECRET WHOOP_REDIRECT_URI \
  APPLE_HEALTHKIT_BRIDGE_URL MOBILE_BRIDGE_SHARED_SECRET \
  PRIVACY_TTL_IDE_DAYS PRIVACY_TTL_BIOMETRIC_DAYS PRIVACY_TTL_PEAK_WINDOW_DAYS \
  SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT DPDP_ERASURE_WINDOW_DAYS \
  BIOMETRIC_CORRELATOR_CRON_HOUR_UTC SIGNAL_PURGE_CRON_HOUR_UTC; do
  [ -n "${!v}" ] || { echo "MISSING: $v"; exit 1; }
done

# 3. Edge Functions deployed
pnpm supabase functions list | grep -E "biometric-correlator|signal-purge|signal-audit-integrity-check"
#    expect: 3 active deployments

# 4. Prerequisite features confirmed
psql "$DATABASE_URL" -c "select count(*) from public.feature_flags where key like '004_%' and default_enabled = true;"
#    expect: >= 1 (004 flags active)

# 5. cron scheduler is active
psql "$DATABASE_URL" -c "select count(*) from cron.job;"
#    expect: >= 1 (existing cron jobs from prior migrations)
```

If any step fails, **stop**. Do not enable flags. Migrations are additive but env-var absence causes silent default fallbacks that are hard to diagnose post-hoc.

---

## 1. Phase order

| Phase | Day | Flags enabled |
|-------|-----|---------------|
| **P1** | Day 0 (GA) | `006_privacy_center`, `006_audit_integrity_check` |
| **P2** | Day 7 (cohort) | `006_ide_telemetry` |
| **P3** | Day 14 (invited-only) | `006_biometrics_oura`, `006_biometrics_whoop` |
| **P4** | Day 21 (gated on 005) | `006_biometrics_mobile` |

> P1 is GA on Day 0 by design (per quickstart §7). The privacy center must be live before any signal capture begins.

---

## 2. Phase P1 — Day 0 GA: `006_privacy_center`, `006_audit_integrity_check`

### 2.1 `006_audit_integrity_check`

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '006_audit_integrity_check';
```

**Verify (smoke test)**

```bash
# Force the nightly integrity check to run immediately
pnpm supabase functions invoke signal-audit-integrity-check --no-verify-jwt
# Acceptance signal: exit code 0, no audit integrity violations detected.
#   query:  select count(*) from public.signal_audit where created_at > now() - interval '1 hour';
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '006_audit_integrity_check';
```

**Observability**: `signal-audit-integrity-check` function logs — pages on-call on non-zero exit.
**Common failures**
- *Cron job not registered* → confirm `044_cron_006.sql` applied: `select * from cron.job where jobname = 'signal-audit-integrity-check';`
- *Append-only enforcement missing* → check `REVOKE UPDATE, DELETE ON public.signal_audit` applied: `\dp public.signal_audit`

### 2.2 `006_privacy_center`

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '006_privacy_center';
```

**Verify**

```bash
# Smoke-test the privacy center page
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/settings/signals
# expect: 200 (redirects to login if not authenticated, but no 404 or 500)

# Assert a student with no connected sources sees the empty state
pnpm test:e2e -- --grep "privacy-center-load"
# Acceptance signal: page renders within 2s for a user with 6 sources.
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '006_privacy_center';
```

**Observability**: `signal_audit` rows with `provider='privacy_center'` and `action='read'` — privacy center page view events.
**Common failures**
- *Page returns 500* → check that `GET /api/settings/signals` is deployed and the database has the 6 new tables.
- *Missing locale keys* → confirm `settings.signals.*` key family exists in all 5 catalogs (`apps/web/src/messages/{en,hi,ta,te,mr}.json`); falls back to `en` with a logged warning to `i18n_missing_keys`.

---

## 3. Phase P2 — Day 7 cohort: `006_ide_telemetry`

**Enable (cohort — start at 10%)**

```sql
update public.feature_flags
   set default_enabled = true, cohort_pct = 10, updated_at = now()
 where key = '006_ide_telemetry';
```

**Verify**

```bash
pnpm test:e2e -- --grep "ide-extension"
# Acceptance signal: at least 1 ide_sessions row exists for a student in the cohort.
#   query:  select count(*) from public.ide_sessions where uploaded_at > now() - interval '24 hours';

# Validate score cap enforcement
pnpm test:e2e -- --grep "score-cap"
#   query:  select max(score_contribution) from public.ide_aggregates where computed_at > now() - interval '24 hours';
#           (expect max <= 3.00)
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, cohort_pct = 0, updated_at = now() where key = '006_ide_telemetry';
# Existing data remains in ide_sessions and ide_aggregates until TTL purge.
```

**Observability**: `public.ide_sessions` upload rate per device-hour; `public.ide_aggregates.score_contribution` distribution.
**Common failures**
- *Extension fails to register device* → check `IDE_TELEMETRY_DEVICE_JWT_SECRET` is set and the `/api/ide-telemetry/session` endpoint is reachable from the extension.
- *Zero uploads after 24h* → confirm `IDE_TELEMETRY_API_BASE` in the extension build points to the correct host; check the extension's IndexedDB buffer for stuck entries.
- *Score contribution > 3%* → verify `ide_aggregates.score_contribution` CHECK constraint at the DB level: `\d public.ide_aggregates`.
- *Buffer never drains* → `IDE_TELEMETRY_BUFFER_TTL_DAYS` (default 7) is the discard window, not a retry window; check the uploader's network error handling logs.

---

## 4. Phase P3 — Day 14 invited-only: `006_biometrics_oura`, `006_biometrics_whoop`

### 4.1 `006_biometrics_oura`

**Enable (invited-only — restrict to pilot users)**

```sql
update public.feature_flags
   set default_enabled = true, cohort_pct = 100, updated_at = now()
 where key = '006_biometrics_oura';
```

**Verify**

```bash
# Manual OAuth round-trip smoke test
# 1. Open /settings/signals → click "Connect Oura"
# 2. Complete OAuth flow (mock or real Oura sandbox)
# 3. Assert: biometric_connections row exists with provider='oura', status='connected'
psql "$DATABASE_URL" -c "select count(*) from public.biometric_connections where provider='oura' and status='connected' and created_at > now() - interval '1 hour';"
# expect: >= 1

# Trigger biometric correlator
pnpm supabase functions invoke biometric-correlator --no-verify-jwt
# Assert: peak_window_inferences row written
psql "$DATABASE_URL" -c "select count(*) from public.peak_window_inferences where created_at > now() - interval '5 minutes' and biometric_inputs_hash is not null;"
# expect: >= 1
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, cohort_pct = 0, updated_at = now() where key = '006_biometrics_oura';
# Existing Oura connections remain but are not refreshed.
```

**Observability**: `biometric_connections` where `provider='oura'` and `status='expired'` — alert if refresh failure threshold exceeded.
**Common failures**
- *OAuth callback 401* → `OURA_CLIENT_ID` / `OURA_CLIENT_SECRET` mismatch; verify in Oura Cloud dashboard.
- *Rate-limited by Oura API* → `biometric-correlator` backs off 1h and emits `biometric_correlator_rate_limited`; no user-facing impact.
- *Refresh token expired* → `OURA_REFRESH_FAILURE_THRESHOLD` (default 3) exhausted; user sees "Reconnect" CTA in privacy center.

### 4.2 `006_biometrics_whoop`

**Enable (invited-only)**

```sql
update public.feature_flags
   set default_enabled = true, cohort_pct = 100, updated_at = now()
 where key = '006_biometrics_whoop';
```

**Verify**

```bash
# Same flow as Oura; substitute Whoop OAuth
psql "$DATABASE_URL" -c "select count(*) from public.biometric_connections where provider='whoop' and status='connected' and created_at > now() - interval '1 hour';"
# expect: >= 1

# Peak-window confidence check
psql "$DATABASE_URL" -c "select avg(confidence) from public.peak_window_inferences where biometric_inputs_hash is not null and created_at > now() - interval '24 hours';"
# expect: >= 0.65 (per SC-BIO-002)
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, cohort_pct = 0, updated_at = now() where key = '006_biometrics_whoop';
```

**Observability**: Whoop refresh failure rate — alert if > 5 failures in 24h.
**Common failures**
- *Whoop API scopes mismatch* → verify `read:recovery`, `read:sleep`, `read:profile` are requested; the correlator skips rows where `daily_readiness_score` is null.
- *Biometric correlator produces confidence < 0.65* → the 002 detector output may be sparse; verify the student has > 7 days of 002 peak-window data.

---

## 5. Phase P4 — Day 21 gated on 005: `006_biometrics_mobile`

**Enable (only after 005 production is confirmed)**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '006_biometrics_mobile';
```

**Verify**

```bash
# Mobile bridge health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/biometrics/mobile-sync/health
# expect: 200

# Assert HealthKit data reaches server
psql "$DATABASE_URL" -c "select count(*) from public.biometric_aggregates where provider='healthkit' and period_type='daily' and created_at > now() - interval '24 hours';"
# expect: >= 1
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '006_biometrics_mobile';
# Mobile bridge stops accepting new syncs immediately.
```

**Observability**: `biometric_aggregates` row count per provider per day; `biometric_connections` with `provider='healthkit'` or `'google_fit'`.
**Common failures**
- *HMAC validation fails* → `MOBILE_BRIDGE_SHARED_SECRET` does not match between server and mobile app; rotate both and re-deploy.
- *005 Expo app not yet in production* → the mobile sync endpoint returns 503; `006_biometrics_mobile` must not be enabled before 005 ships.
- *Google Fit OAuth scope denied* → user must grant at least `sleep`, `hrv`, or `resting_hr`; a 0-scope grant is rejected server-side.

---

## 6. Cross-phase observability dashboard pointers

| Phase | Tables (per quickstart §8) | Daily check |
|-------|----------------------------|-------------|
| P1 | `signal_audit` | integrity pass/fail; audit row count delta vs expected event count |
| P2 | `ide_sessions`, `ide_aggregates` | upload success rate > 90%; score_contribution max ≤ 3; buffer flush rate |
| P3 | `biometric_connections`, `biometric_aggregates`, `peak_window_inferences` | Oura/Whoop refresh failure rate; confidence ≥ 0.65; source_mix distribution |
| P4 | `biometric_aggregates` (healthkit, google_fit) | daily row count per provider; mobile sync health endpoint success rate |

---

## 7. Emergency: rollback everything

```sql
update public.feature_flags set default_enabled = false, cohort_pct = 0, updated_at = now() where key like '006_%';
```

This is **logical** rollback only. Migrations remain in place. To reverse schema:

```bash
# Migration 043 (reversal in dependency order)
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS public.signal_audit CASCADE;"
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS public.peak_window_inferences CASCADE;"
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS public.biometric_aggregates CASCADE;"
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS public.biometric_connections CASCADE;"
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS public.ide_aggregates CASCADE;"
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS public.ide_sessions CASCADE;"

# Migration 044 (unschedule all 4 cron jobs)
psql "$DATABASE_URL" -c "SELECT cron.unschedule('biometric-correlator');"
psql "$DATABASE_URL" -c "SELECT cron.unschedule('signal-purge');"
psql "$DATABASE_URL" -c "SELECT cron.unschedule('signal-audit-pseudonymise');"
psql "$DATABASE_URL" -c "SELECT cron.unschedule('signal-audit-integrity-check');"

pnpm supabase migration repair --status reverted 043
pnpm supabase migration repair --status reverted 044
```

---

## 8. Escalation

- **P1 outage** (audit integrity failure, privacy center down): #incident-antarix + page on-call SRE.
- **P2/P3 outage** (IDE uploads failing, biometric OAuth broken): same channel; flag `severity=P3` unless data loss is confirmed.
- **DPDP erasure stuck** (erasure request > 30 days unanswered): loop in Legal on the incident bridge.
