# 004 — Rollout Runbook (Operator)

**Scope**: Feature 004 — *11/10 Defensible Moat* (anti-cheat, ATS, i18n, SSO, faculty, hackathons, mock interviews, public API, PWA, outcome billing, next-best-skill).
**Audience**: SRE / platform on-call + product ops.
**Source spec**: `specs/004-eleven-of-ten/quickstart.md` (env vars, migrations, smoke tests) and `specs/004-eleven-of-ten/research.md` (decisions D1–D14).

---

## 0. Pre-flight checklist (run before touching any flag)

```bash
# 1. Migrations applied, in order
pnpm supabase migration list | grep -E "034|035|036|037"
#    expect:  034_anticheat  035_ats_sso_faculty  036_hackathon_mockinterview  037_api_outcome_nbs  | applied

# 2. All new env vars present in the target environment
for v in \
  ANTICHEAT_QUARANTINE_THRESHOLD ANTICHEAT_AI_FINGERPRINT_PROVIDER \
  GREENHOUSE_API_BASE LEVER_API_BASE ATS_SYNC_MAX_ATTEMPTS ATS_SYNC_CRON_MINUTES \
  NEXT_PUBLIC_DEFAULT_LOCALE NEXT_PUBLIC_SUPPORTED_LOCALES \
  WORKOS_API_KEY WORKOS_CLIENT_ID WORKOS_REDIRECT_URI WORKOS_COOKIE_PASSWORD \
  MOCK_INTERVIEW_PROVIDER MOCK_INTERVIEW_API_KEY MOCK_INTERVIEW_MODEL \
  MOCK_INTERVIEW_WEEKLY_TOKEN_CAP MOCK_INTERVIEW_MONTHLY_TENANT_TOKEN_CAP MOCK_INTERVIEW_MAX_SCORE_CONTRIBUTION_PCT \
  HACKATHON_CPU_SECONDS HACKATHON_MEMORY_MB HACKATHON_DISALLOW_NETWORK \
  PUBLIC_API_DEFAULT_RATE_LIMIT_RPM PUBLIC_API_BURST_RPS \
  PWA_ENABLED PWA_OFFLINE_PAGE \
  OUTCOME_BILLING_DISPUTE_WINDOW_DAYS \
  NEXT_BEST_SKILL_MIN_SOURCE_COUNT NEXT_BEST_SKILL_RECOMPUTE_CRON_HOURS; do
  [ -n "${!v}" ] || { echo "MISSING: $v"; exit 1; }
done

# 3. Edge Functions deployed
pnpm supabase functions list | grep -E "github-anticheat|dsa-anticheat|ats-sync-greenhouse|ats-sync-lever|mock-interview-llm|hackathon-grader|next-best-skill|webhook-dispatcher"
#    expect: 8 active deployments

# 4. WorkOS connections (only required before enabling 004_sso_workos)
psql "$DATABASE_URL" -c "select count(*) from public.sso_connections where workos_connection_id is not null;"
#    expect: >= 1 for the pilot cohort (more for production cohorts)

# 5. Locale catalogs in place (only required before enabling 004_i18n_extended)
ls apps/web/src/messages/{hi,ta,te,mr}.json
#    expect: 4 files
```

If any step fails, **stop**. Do not enable flags. Migrations are additive but env-var absence causes silent default fallbacks that are hard to diagnose post-hoc.

---

## 1. Phase order

| Phase | Day | Flags enabled |
|-------|-----|---------------|
| **P1** | Day 0 (GA) | `004_anticheat`, `004_ats_sync`, `004_i18n_extended` |
| **P2** | Day 14 (cohort) | `004_sso_workos`, `004_faculty_grading`, `004_next_best_skill` |
| **P3** | Day 21–30 (cohort / invited) | `004_hackathons`, `004_mock_interviews` (Day 21); `004_pwa`, `004_outcome_pricing`, `004_public_api` (Day 30) |

> P1 is GA on Day 0 by design (per quickstart §12). Do not delay P1 waiting on P2 prep work.

---

## 2. Phase P1 — Day 0 GA: `004_anticheat`, `004_ats_sync`, `004_i18n_extended`

### 2.1 `004_anticheat`

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_anticheat';
```

**Verify (smoke test)**

```bash
pnpm test:e2e -- --grep "anticheat"
# Acceptance signal: 0 quarantines on legitimate student submissions in the first 24h.
#   query:  select count(*) from public.anticheat_audit where action = 'quarantine' and created_at > now() - interval '24 hours';
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_anticheat';
```

**Observability**: `public.anticheat_audit` — daily quarantine + appeal volume (quickstart §14).
**Common failures**
- *Quarantine threshold too aggressive* (FPs spike) → raise `ANTICHEAT_QUARANTINE_THRESHOLD` from `0.6` to `0.75`, redeploy `dsa-anticheat` function.
- *GitHub enrichment 403* → check `GITHUB_CLIENT_ID/SECRET` and Octokit rate limit headers in `github-anticheat` logs.

### 2.2 `004_ats_sync`

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_ats_sync';
```

**Verify**

```bash
pnpm test:e2e -- --grep "ats"
# Acceptance signal: at least 1 sync job completes per active recruiter connection within 1 cron tick.
#   query:  select connection_id, last_status, last_synced_at from public.ats_connections where last_synced_at > now() - interval '5 minutes';
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_ats_sync';
```

**Observability**: `public.ats_sync_log` joined to `public.ats_connections` (quickstart §14).
**Common failures**
- *Greenhouse 401* → recruiter key was rotated; the recruiter must re-enter it at `/company/ats`. (Keys are encrypted at rest; we do not re-read them.)
- *Cron never fires* → confirm `ATS_SYNC_CRON_MINUTES` is set and `pg_cron` job exists: `select * from cron.job where jobname = 'ats_sync_tick';`

### 2.3 `004_i18n_extended`

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_i18n_extended';
```

**Verify**

```bash
pnpm test:e2e -- --grep "i18n"
# Acceptance signal: each of hi/ta/te/mr renders the dashboard with no fallback to 'en' for the smoke-test routes.
#   query:  select locale, count(*) from public.i18n_missing_keys where seen_count > 0 group by locale;
#           (expect zero rows for the 4 new locales, or only translator-pending keys)
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_i18n_extended';
```

**Observability**: `public.i18n_missing_keys` ordered by `seen_count DESC` (quickstart §14).
**Common failures**
- *All keys falling back to `en`* → `NEXT_PUBLIC_SUPPORTED_LOCALES` does not include the requested locale; restart `pnpm dev` after editing `.env.local`.
- *next-intl routing 404* → middleware matcher is missing the new locale prefix; check `apps/web/middleware.ts`.

---

## 3. Phase P2 — Day 14 cohort: `004_sso_workos`, `004_faculty_grading`, `004_next_best_skill`

### 3.1 `004_sso_workos`

**Enable (per-cohort — restrict to pilot college)**

```sql
update public.feature_flags
   set default_enabled = true, cohort_college_ids = array['<pilot-college-uuid>'], updated_at = now()
 where key = '004_sso_workos';
```

**Verify**

```bash
pnpm test:e2e -- --grep "sso"
# Acceptance signal: a faculty member from the pilot college can complete the SAML round-trip and lands on /college/faculty with the 'faculty' role.
#   query:  select count(*) from auth.users where raw_app_meta_data->>'sso_provider' = 'workos' and created_at > now() - interval '1 hour';
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, cohort_college_ids = '{}', updated_at = now() where key = '004_sso_workos';
```

**Observability**: `auth.audit_log_entries` (Supabase) filtered to provider `workos`; `public.sso_connections.last_used_at`.
**Common failures**
- *WorkOS callback 401* → check **role attribute mapping** in the WorkOS dashboard (Directory → Users → Role Mapping). The IdP claim name must match `WORKOS_ROLE_ATTRIBUTE`; default is `role`.
- *Cookie decryption error* → `WORKOS_COOKIE_PASSWORD` must be exactly 32 chars; rotate via `openssl rand -base64 32 | tr -d '=' | head -c 32` and redeploy.
- *Redirect URI mismatch* → the URI in WorkOS dashboard must byte-match `WORKOS_REDIRECT_URI`.

### 3.2 `004_faculty_grading`

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_faculty_grading';
```

**Verify**

```bash
# Acceptance signal: after one score recompute cycle (≤ 6h), a graded student shows a 'faculty' contribution line in /dashboard.
#   query:  select student_id, source, score_delta from public.score_contributions where source = 'faculty' and created_at > now() - interval '6 hours';
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_faculty_grading';
# Optional: zero out faculty contributions already applied (irreversible in spirit):
#   update public.score_contributions set reverted_at = now() where source = 'faculty' and created_at > now() - interval '24 hours';
```

**Observability**: `public.score_contributions` (filter `source='faculty'`), `public.faculty_verifications` count by `verified_at`.
**Common failures**
- *Faculty not seeing /college/faculty/grade* → admin did not verify them at `/college/faculty/verify`; check `public.faculty_verifications`.
- *Score recompute never runs* → confirm `SCORE_RECOMPUTE_CRON` env (from 001) and that the student has ≥ 1 graded assignment in the window.

### 3.3 `004_next_best_skill`

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_next_best_skill';
```

**Verify**

```bash
pnpm test:unit -- --grep "next_best_skill"
# Acceptance signal: the cron job runs every 24h and emits recommendations.
#   query:  select count(*), max(created_at) from public.skill_recommendations;
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_next_best_skill';
```

**Observability**: `public.skill_recommendations` row count + freshness; `cron.job_run_details` for `next_best_skill_recompute`.
**Common failures**
- *Recompute produces < N recommendations* → lower `NEXT_BEST_SKILL_MIN_SOURCE_COUNT` (default `5`) or backfill the contributing sources.
- *Function timeout* → the LLM enrichment step is O(students × skills); split the job into batches or extend the function timeout.

---

## 4. Phase P3 — Day 21–30 cohort: hackathons, mock interviews, PWA, outcome, public API

### 4.1 `004_hackathons` (Day 21)

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_hackathons';
```

**Verify**

```bash
pnpm test:e2e -- --grep "hackathon"
# Acceptance signal: a recruiter-published hackathon appears in /dashboard/hackathons and a submitted solution scores within 60s.
#   query:  select hackathon_id, count(*) from public.hackathon_submissions where created_at > now() - interval '1 hour' group by 1;
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_hackathons';
```

**Observability**: `public.hackathon_submissions`, `public.hackathon_grader_runs` (per-sandbox resource usage vs. `HACKATHON_CPU_SECONDS` / `HACKATHON_MEMORY_MB`).
**Common failures**
- *Sandbox OOMs* → raise `HACKATHON_MEMORY_MB` (default `256`) in 64 MB steps.
- *Sandbox egress* → `HACKATHON_DISALLOW_NETWORK=true` is intentional; if a test case requires network, the recruiter must add the hostname to an allowlist (out of scope for 004).

### 4.2 `004_mock_interviews` (Day 21)

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_mock_interviews';
```

**Verify**

```bash
pnpm test:e2e -- --grep "mock-interview"
# Acceptance signal: a student can start a session, answer 3 questions, and receive a graded score within 90s.
#   query:  select student_id, tokens_used, score from public.mock_interview_sessions where created_at > now() - interval '1 hour';
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_mock_interviews';
```

**Observability**: per-student weekly token usage vs. `MOCK_INTERVIEW_WEEKLY_TOKEN_CAP`; per-tenant monthly cap vs. `MOCK_INTERVIEW_MONTHLY_TENANT_TOKEN_CAP` (quickstart §14).
**Common failures**
- *Provider 429* → tenant hit the monthly cap; raise `MOCK_INTERVIEW_MONTHLY_TENANT_TOKEN_CAP` or rotate provider (`MOCK_INTERVIEW_PROVIDER=openai`).
- *Score contribution > 5%* → the cap is enforced in `mock-interview-llm`; if it slips, check `MOCK_INTERVIEW_MAX_SCORE_CONTRIBUTION_PCT` and the latest function deployment.
- *Groq model deprecated* → bump `MOCK_INTERVIEW_MODEL` to the current `llama-3.x-versatile` release; no redeploy of code required (env read at request time).

### 4.3 `004_pwa` (Day 30)

**Enable**

```sql
update public.feature_flags set default_enabled = true, updated_at = now() where key = '004_pwa';
```

**Verify (manual, per quickstart §6)**

```bash
pnpm dev
# 1. open http://localhost:3000 in Chrome → install icon appears in URL bar
# 2. install, disconnect network, open dashboard → expect cached state + offline banner
pnpm test:e2e -- --grep "pwa"
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key = '004_pwa';
# Optional: set PWA_ENABLED=false in env and redeploy to fully strip the service worker.
```

**Observability**: service-worker `install` / `fetch` event counters in `public.pwa_telemetry` (if present); browser DevTools → Application → Service Workers.
**Common failures**
- *Install icon never appears* → manifest is missing the `display: 'standalone'` and at least one 192px + 512px icon; check `apps/web/public/manifest.webmanifest`.
- *Offline page 404* → `PWA_OFFLINE_PAGE` (default `/offline`) must exist; create `apps/web/src/app/offline/page.tsx`.

### 4.4 `004_outcome_pricing` (Day 30, **single-college pilot**)

**Enable (pilot-only)**

```sql
update public.feature_flags
   set default_enabled = true, cohort_college_ids = array['<pilot-college-uuid>'], updated_at = now()
 where key = '004_outcome_pricing';
```

**Verify**

```bash
# Acceptance signal: a placement reported for a pilot-college student creates an invoice in 'pending' state within the dispute window (default 30 days, OUTCOME_BILLING_DISPUTE_WINDOW_DAYS).
#   query:  select id, college_id, status, dispute_window_ends_at from public.outcome_invoices where created_at > now() - interval '24 hours';
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, cohort_college_ids = '{}', updated_at = now() where key = '004_outcome_pricing';
# Hold all in-flight invoices in their current state — do NOT mass-revert. Finance must reconcile manually.
```

**Observability**: `public.outcome_invoices` by `status`; `public.outcome_disputes` count + age.
**Common failures**
- *Invoice stuck in 'pending'* past `OUTCOME_BILLING_DISPUTE_WINDOW_DAYS` → check that the daily billing cron is running; the window is a guard, not a hard cutoff.
- *Dispute filed but not surfaced* → the disputes view in `/college/billing/disputes` requires the college admin role; verify the admin's role assignment.

### 4.5 `004_public_api` (Day 30, **invited-only**)

**Enable**

```sql
update public.feature_flags
   set default_enabled = true, invited_tenant_ids = array['<tenant-uuid>', ...], updated_at = now()
 where key = '004_public_api';
```

**Verify (per quickstart §8)**

```bash
# 1. Create a key
curl -X POST http://localhost:3000/api/api-keys \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke","scopes":["read:public_profile"]}'
# expect: { "key": "ant_pub_..." }

# 2. Call the endpoint
curl http://localhost:3000/v1/public/profiles/<slug> \
  -H "Authorization: Bearer ant_pub_..."
# expect: 200 with public profile JSON

pnpm test:e2e -- --grep "public-api"
```

**Rollback**

```sql
update public.feature_flags set default_enabled = false, invited_tenant_ids = '{}', updated_at = now() where key = '004_public_api';
# Issued keys remain valid until manually revoked — coordinate with the API key owner list before flipping the flag.
```

**Observability**: per-key request count + 429 rate per 5-min window (quickstart §14); `public.api_key_usage` row counts.
**Common failures**
- *429 burst* → confirm client is not exceeding `PUBLIC_API_BURST_RPS=10`; for legitimate high-volume clients, raise per-key limit via admin console.
- *401 on a previously-valid key* → key was revoked or rotated; never reuse the raw key string after rotation. (The server stores only the hash.)
- *Scope 403* → the requested scope was not granted at key creation; issue a new key with the needed scope.

---

## 5. Cross-phase observability dashboard pointers

| Phase | Tables (per quickstart §14) | Daily check |
|-------|----------------------------|-------------|
| P1 | `anticheat_audit`, `ats_sync_log`+`ats_connections`, `i18n_missing_keys` | quarantine FP rate; sync lag; missing-key backlog |
| P2 | `sso_connections`, `score_contributions` (source=faculty), `skill_recommendations` | SAML success rate; recompute freshness; NBS coverage |
| P3 | `hackathon_submissions`+`hackathon_grader_runs`, `mock_interview_sessions`, `pwa_telemetry`, `outcome_invoices`+`outcome_disputes`, `api_key_usage` | sandbox OOM rate; token-cap utilization; PWA install rate; dispute age; 429 ratio |

---

## 6. Emergency: rollback everything

```sql
update public.feature_flags set default_enabled = false, updated_at = now() where key like '004_%';
```

This is **logical** rollback only. Migrations remain in place. To reverse schema, follow `specs/004-eleven-of-ten/quickstart.md` §15 and run the held DROP statements from `supabase/migrations/_rollback/004/`.

---

## 7. Escalation

- **P1 outage**: #incident-antarix + page on-call SRE.
- **P2/P3 outage**: same channel; flag `severity=P3` unless billing/SSO are user-visible.
- **Billing disputes** (P3): loop in Finance on the incident bridge before flipping `004_outcome_pricing`.
