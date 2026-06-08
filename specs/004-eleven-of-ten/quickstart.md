# Quickstart: 11/10 — Defensible Moat

**Date**: 2026-06-06
**Prereqs**: 001 + 002 + 003 quickstarts already executed.

## 1. New environment variables

Add to `.env.local` (and document in `.env.local.example`):

```env
# Anti-cheat
ANTICHEAT_QUARANTINE_THRESHOLD=0.6
ANTICHEAT_AI_FINGERPRINT_PROVIDER=builtin   # or 'openai' for v2

# ATS — Greenhouse + Lever
GREENHOUSE_API_BASE=https://harvest.greenhouse.io/v1
LEVER_API_BASE=https://api.lever.co/v1
ATS_SYNC_MAX_ATTEMPTS=3
ATS_SYNC_CRON_MINUTES=5

# i18n
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_SUPPORTED_LOCALES=en,hi,ta,te,mr

# Enterprise SSO (WorkOS)
WORKOS_API_KEY=<workos-api-key>
WORKOS_CLIENT_ID=<workos-client-id>
WORKOS_REDIRECT_URI=https://<host>/api/sso/workos/callback
WORKOS_COOKIE_PASSWORD=<>=32-char-random-secret

# Mock interview LLM
MOCK_INTERVIEW_PROVIDER=groq                    # or openai, together
MOCK_INTERVIEW_API_KEY=<provider-api-key>
MOCK_INTERVIEW_MODEL=llama-3.1-70b-versatile    # provider-specific
MOCK_INTERVIEW_WEEKLY_TOKEN_CAP=50000
MOCK_INTERVIEW_MONTHLY_TENANT_TOKEN_CAP=5000000
MOCK_INTERVIEW_MAX_SCORE_CONTRIBUTION_PCT=5     # 5% of total score per week

# Hackathon sandbox
HACKATHON_CPU_SECONDS=30
HACKATHON_MEMORY_MB=256
HACKATHON_DISALLOW_NETWORK=true

# Public API
PUBLIC_API_DEFAULT_RATE_LIMIT_RPM=100
PUBLIC_API_BURST_RPS=10

# PWA
PWA_ENABLED=true
PWA_OFFLINE_PAGE=/offline

# Outcome billing
OUTCOME_BILLING_DISPUTE_WINDOW_DAYS=30

# Next-best-skill
NEXT_BEST_SKILL_MIN_SOURCE_COUNT=5
NEXT_BEST_SKILL_RECOMPUTE_CRON_HOURS=24
```

## 2. Migrations (run in order)

```bash
pnpm supabase db push       # applies 034, 035, 036, 037 in sequence
```

Migration order:
1. `034_anticheat.sql` — anti-cheat tables + i18n queue + user.locale + delta columns on github_repos, user_dsa_profiles
2. `035_ats_sso_faculty.sql` — ATS, SSO, faculty
3. `036_hackathon_mockinterview.sql` — hackathons + mock interviews
4. `037_api_outcome_nbs.sql` — public API + outcome billing + next-best-skill

## 3. New Edge Functions to deploy

```bash
pnpm supabase functions deploy github-anticheat
pnpm supabase functions deploy dsa-anticheat
pnpm supabase functions deploy ats-sync-greenhouse
pnpm supabase functions deploy ats-sync-lever
pnpm supabase functions deploy mock-interview-llm
pnpm supabase functions deploy hackathon-grader
pnpm supabase functions deploy next-best-skill
pnpm supabase functions deploy webhook-dispatcher
```

Each function uses the secret bundle declared in step 1.

## 4. WorkOS setup (one-time)

1. Create a WorkOS account at https://workos.com.
2. Create an application; add the redirect URI from `WORKOS_REDIRECT_URI`.
3. For each partner institution, create a SSO connection in the WorkOS dashboard and copy the connection ID into `sso_connections.workos_connection_id` via the admin console (or seed SQL).

## 5. ATS setup (per recruiter, self-serve)

Recruiters visit `/company/ats` → paste their Greenhouse or Lever API key → optional pool ID. The page POSTs to `/api/ats/connect`; the key is encrypted at rest. They then create saved searches at `/company/ats/searches`.

## 6. PWA install verification

After `pnpm dev`:
1. Open `http://localhost:3000` in Chrome.
2. Look for the install icon in the URL bar.
3. Install. Disconnect network.
4. Open dashboard → expect cached state with offline banner.

## 7. Locale catalogs

Add the 4 new locale catalogs:

```
apps/web/src/messages/hi.json   # Hindi
apps/web/src/messages/ta.json   # Tamil
apps/web/src/messages/te.json   # Telugu
apps/web/src/messages/mr.json   # Marathi
```

Translator workflow: nightly job exports `i18n_missing_keys` per locale to CSV. Translators populate. CSV → JSON merge script → PR.

## 8. Public API: creating a first key

```bash
curl -X POST http://localhost:3000/api/api-keys \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Test Key","scopes":["read:public_profile"]}'
```

Response includes `key: "ant_pub_..."` — store it; it is never shown again.

Then:
```bash
curl http://localhost:3000/v1/public/profiles/<slug> \
  -H "Authorization: Bearer ant_pub_..."
```

## 9. Mock interview: provider keys

Pick one provider and set env. For Groq:
1. Sign up at https://console.groq.com, create an API key.
2. Set `MOCK_INTERVIEW_API_KEY` to the Groq key.
3. Confirm `MOCK_INTERVIEW_MODEL=llama-3.1-70b-versatile` (or the latest Groq model).
4. Restart `pnpm dev`.

## 10. Hackathon: first hackathon E2E

1. Recruiter logs in → `/company/hackathons` → create.
2. Upload test cases (JSON file with `[{ input, expected_output }]`) to Supabase storage → paste signed URL.
3. Publish.
4. Student visits `/dashboard/hackathons` → opt in → upload solution.
5. Wait ≤ 60s; refresh leaderboard.

## 11. Faculty grading: first grade

1. College admin verifies a faculty at `/college/faculty/verify`.
2. Faculty visits `/college/faculty/grade` → picks student + assignment → grade.
3. Within next score recompute cycle (≤ 6h), the student dashboard shows the new faculty contribution line.

## 12. Feature flags (recommended rollout)

Behind feature flags from day 1 (use the existing `feature_flags` table from 003):
- `004_anticheat` — Day 0 GA (P1)
- `004_ats_sync` — Day 0 GA (P1)
- `004_i18n_hi/ta/te/mr` — Day 0 GA (P1)
- `004_sso_workos` — Day 14 cohort rollout
- `004_faculty_grading` — Day 14 cohort rollout
- `004_hackathons` — Day 21 cohort rollout
- `004_mock_interviews` — Day 21 cohort rollout
- `004_public_api` — Day 30 invited-only
- `004_pwa` — Day 30 cohort rollout
- `004_outcome_pricing` — Day 30 single-college pilot
- `004_next_best_skill` — Day 14 cohort rollout

## 13. Smoke tests

```bash
pnpm test                                    # unit
pnpm test:e2e -- --grep "anticheat"          # E2E for anti-cheat
pnpm test:e2e -- --grep "ats"                # E2E for ATS sync
pnpm test:e2e -- --grep "i18n"               # E2E for locale dispatch
pnpm test:e2e -- --grep "sso"                # E2E for SAML flow
pnpm test:e2e -- --grep "hackathon"          # E2E for hackathon flow
pnpm test:e2e -- --grep "mock-interview"     # E2E for mock interview
pnpm test:e2e -- --grep "public-api"         # E2E for public API
pnpm test:e2e -- --grep "pwa"                # E2E for offline mode
```

## 14. Observability

- Anti-cheat: query `anticheat_audit` for daily quarantine + appeal volume.
- ATS: `ats_sync_log` joined to `ats_connections` → per-recruiter sync health dashboard.
- i18n: `i18n_missing_keys` ordered by `seen_count DESC` → translator priority queue.
- Mock interview: per-student weekly token usage → cap-breach alerting.
- Public API: per-key request count + 429 rate per 5-min window.

## 15. Rollback

Each migration is a pure additive `CREATE TABLE` + `ALTER TABLE ADD COLUMN`. To roll back:
```bash
pnpm supabase migration repair --status reverted 037 036 035 034
# then re-apply the corresponding DROP statements (held in supabase/migrations/_rollback/004/)
```

Feature flags allow logical rollback without DB migration reversal.
