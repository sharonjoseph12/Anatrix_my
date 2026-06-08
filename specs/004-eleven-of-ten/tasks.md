# Tasks: 11/10 — Defensible Moat & Global Scale

**Feature**: `004-eleven-of-ten`
**Generated**: 2026-06-06
**Source**: `specs/004-eleven-of-ten/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

Atomic, dependency-ordered tasks. `[P]` = parallelizable with siblings sharing the same phase prefix. **Bold** tasks are critical-path.

---

## Phase 0 — Pre-flight

- [x] T001 [P] Verify 002 + 003 task completion (already confirmed: 002 = 93/94, 003 = 58/58)
- [x] T002 [P] Survey existing migrations (017-033 present); confirm next migration number is 034
- [x] T003 [P] Survey existing edge functions; confirm new function names don't clash
- [ ] T004 [P] Add 004 env vars to `.env.local.example` (per quickstart §1)
- [ ] T005 [P] Add 004 env vars to `turbo.json` `globalEnv` array
- [ ] T006 Add new dependencies to `apps/web/package.json`: `@workos-inc/node`, `serwist`, `@serwist/next`, `groq-sdk` (or `openai`), `@octokit/rest`

---

## Phase 1 — Schema (migrations) [all parallel]

- [ ] **T010 [P] Migration `034_anticheat.sql`** — tables: `anticheat_signals`, `anticheat_appeals`, `anticheat_audit`, `i18n_missing_keys`; column additions: `users.locale`, `github_repos.anticheat_score`, `github_repos.quarantined_at`, `user_dsa_profiles.anticheat_score`, `user_dsa_profiles.quarantined_at`; indexes + RLS policies per data-model.md
- [ ] **T011 [P] Migration `035_ats_sso_faculty.sql`** — tables: `ats_connections`, `ats_saved_searches`, `ats_sync_log`, `sso_connections`, `faculty_verifications`, `assignments`, `faculty_grades`; indexes + RLS
- [ ] **T012 [P] Migration `036_hackathon_mockinterview.sql`** — tables: `hackathons`, `hackathon_submissions`, `hackathon_credentials`, `mock_interviews`, `mock_interview_turns`; indexes + RLS + CHECK constraints (window 24-168h)
- [ ] **T013 [P] Migration `037_api_outcome_nbs.sql`** — tables: `api_keys`, `webhook_subscriptions`, `webhook_deliveries`, `outcome_contracts`, `outcome_billing_events`, `next_best_skills`, `api_rate_counters`; indexes + RLS
- [ ] T014 [P] pgcrypto / pgsodium extension check in `034` (for bcrypt hash + encrypted ATS keys)

**Checkpoint**: All 17 new tables created. RLS verified. `pnpm supabase db reset` clean.

---

## Phase 2 — Shared types + utilities [all parallel after Phase 1]

- [ ] T020 [P] Create `packages/types/anticheat.ts` with TS types for signals, appeals, audit
- [ ] T021 [P] Create `packages/types/ats.ts` with provider unions, saved-search schema
- [ ] T022 [P] Create `packages/types/hackathon.ts` with submission status union, prize_structure schema
- [ ] T023 [P] Create `packages/types/mock-interview.ts` with rubric type, turn role union
- [ ] T024 [P] Create `packages/types/public-api.ts` with scope union, webhook event union, error shape
- [ ] T025 [P] Create `packages/types/i18n.ts` with locale union (en/hi/ta/te/mr)
- [ ] T026 [P] Create `packages/utils/locale.ts` (`isSupportedLocale`, `normalizeLocale`)
- [ ] T027 [P] Update `packages/types/database.ts` with new table types (regenerate via `supabase gen types`)

---

## Phase 3 — Anti-cheat (US1, P1) [critical path]

### 3a. Algorithm + signals (parallel)

- [ ] **T030 [P] `apps/web/src/lib/anticheat/github-signals.ts`** — pure functions: `detectForkNoCommits(repo)`, `detectCommitClusterTime(commits)`, `detectAiGeneratedSuspect(files)`, `detectCopiedContentOverlap(files, publicCorpus)`; each returns `{ signal, confidence, evidence }`
- [ ] **T031 [P] `apps/web/src/lib/anticheat/dsa-signals.ts`** — `detectImpossibleVelocity(records)`, `detectRatingDeltaAnomaly(history)`
- [ ] T032 [P] `apps/web/src/lib/anticheat/score-aggregator.ts` — `aggregateSignals(signals[]) → { score, primary_signal }`; integrates with existing score recompute
- [ ] T033 [P] Unit tests `tests/integration/anticheat-scoring.test.ts` — seeded cheat patterns hit all four signals at correct confidence

### 3b. Edge functions (depend on 3a + Phase 1)

- [ ] **T040 `supabase/functions/github-anticheat/index.ts`** — accepts `{ student_id }`, walks repos, calls signal fns, writes `anticheat_signals` rows, quarantines repos with `score ≥ threshold`, writes audit row
- [ ] **T041 `supabase/functions/dsa-anticheat/index.ts`** — analogous for DSA profile

### 3c. API routes + UI (depend on 3a)

- [ ] T042 [P] `apps/web/src/app/api/anticheat/appeal/route.ts` — POST, validates body, inserts `anticheat_appeals`, returns appeal_id
- [ ] T043 [P] `apps/web/src/app/api/anticheat/decide/route.ts` — POST, mentor-auth, updates appeal + writes audit, triggers recompute on approval
- [ ] T044 [P] `apps/web/src/app/(student)/dashboard/skills/anticheat-banner.tsx` — shows quarantined repos + appeal CTA
- [ ] T045 [P] `apps/web/src/app/(college)/faculty/appeals/page.tsx` — mentor review queue

### 3d. Cron + E2E

- [ ] T046 Cron entry in `029_cron_002.sql` extension (`038_cron_004.sql`): run `github-anticheat` per-student weekly
- [ ] T047 E2E `tests/e2e/anticheat-fork-no-commits.spec.ts` — seed 14 forks, run function, assert quarantine + UI

**Checkpoint**: P1 trust feature shippable behind `004_anticheat` flag.

---

## Phase 4 — i18n (US3, P1) [parallel with Phase 3]

- [ ] **T050 [P] `apps/web/src/messages/hi.json`** — Hindi catalog (4 nudge templates + settings + dashboard chrome + notification inbox keys)
- [ ] **T051 [P] `apps/web/src/messages/ta.json`** — Tamil catalog
- [ ] **T052 [P] `apps/web/src/messages/te.json`** — Telugu catalog
- [ ] **T053 [P] `apps/web/src/messages/mr.json`** — Marathi catalog
- [ ] T054 [P] Extend `apps/web/src/messages/en.json` with any new keys
- [ ] T055 [P] `packages/utils/locale.ts` — helpers used by renderer
- [ ] T056 `apps/web/src/i18n/request.ts` — extend `getRequestConfig` to read `users.locale` from Supabase
- [ ] T057 `supabase/functions/nudge-dispatch-extended/index.ts` — extend renderer to pick locale from `users.locale`; on missing key, INSERT into `i18n_missing_keys`
- [ ] T058 `apps/web/src/app/settings/language/page.tsx` — locale selector UI; POST to `/api/settings/language`
- [ ] T059 `apps/web/src/app/api/settings/language/route.ts` — POST { locale } → UPDATE users.locale
- [ ] T060 E2E `tests/e2e/i18n-hindi-nudge.spec.ts` — seed student with `locale=hi`, trigger nudge, assert Hindi text body

**Checkpoint**: P1 reach feature shippable behind `004_i18n_*` flags.

---

## Phase 5 — ATS sync (US2, P1) [parallel with Phase 3, 4]

### 5a. Provider clients (parallel)

- [ ] **T070 [P] `apps/web/src/lib/ats/greenhouse-client.ts`** — `pushCandidate(apiKey, poolId, student, score)`; handles 50req/10s rate limit; throws typed errors
- [ ] **T071 [P] `apps/web/src/lib/ats/lever-client.ts`** — `pushCandidate(apiKey, student, score)`; handles 10req/s rate limit
- [ ] T072 [P] `apps/web/src/lib/ats/saved-search-evaluator.ts` — evaluates a saved search against the candidate index, returns new matches since last evaluation
- [ ] T073 [P] Unit tests `tests/integration/greenhouse-client.test.ts` — mock HTTP, assert request shape, retry behavior

### 5b. Edge functions + API + UI

- [ ] **T080 `supabase/functions/ats-sync-greenhouse/index.ts`** — orchestrates: walk active saved searches → eval matches → push via client → log to `ats_sync_log`
- [ ] **T081 `supabase/functions/ats-sync-lever/index.ts`** — analogous
- [ ] T082 `supabase/functions/ats-sync-evaluator/index.ts` — cron dispatcher (every 5 min) that fans out to providers
- [ ] T083 [P] `apps/web/src/app/api/ats/connect/route.ts` — POST encrypts key via pgsodium → INSERT `ats_connections`; pings provider to validate
- [ ] T084 [P] `apps/web/src/app/api/ats/connect/[id]/route.ts` — DELETE (revoke)
- [ ] T085 [P] `apps/web/src/app/api/ats/saved-search/route.ts` — POST `{ connection_id, query_json, min_score }`
- [ ] T086 [P] `apps/web/src/app/(company)/ats/page.tsx` — connection UI + saved-search builder + sync log table
- [ ] T087 Cron entry in `038_cron_004.sql`: run `ats-sync-evaluator` every 5 minutes
- [ ] T088 E2E `tests/e2e/ats-greenhouse-sync.spec.ts` — mock Greenhouse, configure connection + saved search, seed 6 matching students, assert 6 POSTs + sync log rows

**Checkpoint**: P1 recruiter-adoption feature shippable behind `004_ats_sync` flag.

---

## Phase 6 — SAML SSO + Faculty (US4, P2)

### 6a. WorkOS integration

- [ ] **T100 `apps/web/src/lib/sso/workos.ts`** — `getAuthorizationUrl(institutionSlug)`, `exchangeCode(code)` using `@workos-inc/node`
- [ ] T101 [P] `apps/web/src/app/api/sso/workos/login/route.ts` — GET, looks up `sso_connections`, 302 to WorkOS URL
- [ ] T102 [P] `apps/web/src/app/api/sso/workos/callback/route.ts` — GET, exchanges code, upserts user, creates Supabase session, 302 to dashboard
- [ ] T103 [P] `apps/web/src/app/(college)/admin/sso/page.tsx` — admin UI to view + configure connection
- [ ] T104 E2E `tests/e2e/sso-workos-callback.spec.ts` — mock WorkOS test mode

### 6b. Faculty layer

- [ ] **T110 [P] `apps/web/src/app/api/faculty/verify/route.ts`** — POST, admin-auth, INSERT `faculty_verifications`
- [ ] **T111 [P] `apps/web/src/app/api/faculty/grade/route.ts`** — POST, verified-faculty-auth, INSERT `faculty_grades`, kick off score recompute
- [ ] T112 [P] `apps/web/src/app/(college)/faculty/grade/page.tsx` — grading UI: student picker + assignment picker + grade input + comment
- [ ] T113 [P] `apps/web/src/app/(college)/faculty/outliers/page.tsx` — admin view of per-faculty grade distribution
- [ ] T114 Extend score recompute (in `apps/web/src/lib/algorithms/`) to include `faculty_grades` weight (capped at 10%)
- [ ] T115 Nightly job `supabase/functions/faculty-outlier-detect/index.ts` — flag outlier faculty
- [ ] T116 E2E `tests/e2e/faculty-grade-flow.spec.ts` — admin verifies → faculty grades → student score reflects within recompute

**Checkpoint**: P2 enterprise features shippable behind `004_sso_workos` and `004_faculty_grading` flags.

---

## Phase 7 — Hackathon platform (US5, P2)

- [ ] **T130 `supabase/functions/hackathon-grader/index.ts`** — sandboxed runner: fetches code, runs against test cases, persists `test_results` + `score`; enforces 30s CPU, 256MB memory, no network
- [ ] T131 [P] `apps/web/src/lib/algorithms/hackathon-scorer.ts` — pure ranking + percentile fn used by leaderboard + credential issuance
- [ ] T132 [P] `apps/web/src/app/api/hackathons/route.ts` — POST create (recruiter)
- [ ] T133 [P] `apps/web/src/app/api/hackathons/[id]/publish/route.ts` — POST publish
- [ ] T134 [P] `apps/web/src/app/api/hackathons/[id]/submissions/route.ts` — POST submit (student)
- [ ] T135 [P] `apps/web/src/app/api/hackathons/[id]/leaderboard/route.ts` — GET ranked list (anonymized for opted-out)
- [ ] T136 [P] `apps/web/src/app/(company)/hackathons/page.tsx` — recruiter dashboard
- [ ] T137 [P] `apps/web/src/app/(company)/hackathons/[id]/page.tsx` — recruiter detail + fast-track UI
- [ ] T138 [P] `apps/web/src/app/(student)/hackathons/page.tsx` — student-facing list
- [ ] T139 [P] `apps/web/src/app/(student)/hackathons/[id]/page.tsx` — student detail + submission
- [ ] T140 On grade completion in T130: issue `hackathon_credentials` row + W3C VC via existing `credential-vc-issue` function
- [ ] T141 E2E `tests/e2e/hackathon-submit-and-grade.spec.ts`

**Checkpoint**: P2 hackathon shippable behind `004_hackathons` flag.

---

## Phase 8 — Mock interviews (US7, P2)

- [ ] **T150 `supabase/functions/mock-interview-llm/index.ts`** — streams LLM turns; enforces per-student weekly token cap + per-tenant monthly cap before each call; logs every turn to `mock_interview_turns`
- [ ] T151 [P] `apps/web/src/app/api/mock-interview/start/route.ts` — POST, checks weekly cap, returns `interview_id` + first question
- [ ] T152 [P] `apps/web/src/app/api/mock-interview/turn/route.ts` — POST, SSE stream from `mock-interview-llm`
- [ ] T153 [P] `apps/web/src/app/api/mock-interview/complete/route.ts` — POST, computes final rubric + capped score contribution
- [ ] T154 [P] `apps/web/src/app/practice/mock-interview/page.tsx` — chat UI + topic picker
- [ ] T155 [P] `apps/web/src/app/practice/history/page.tsx` — past sessions + rubric details
- [ ] T156 E2E `tests/e2e/mock-interview-rubric.spec.ts`

**Checkpoint**: P2 active validation shippable behind `004_mock_interviews` flag.

---

## Phase 9 — Public API (US6, P3)

### 9a. Auth + rate limit middleware

- [ ] **T170 `apps/web/src/lib/api/apikey.ts`** — `verifyApiKey(authHeader) → { key_id, subject_id, scopes }` (bcrypt-verifies hash; SELECT FOR UPDATE updates `last_used_at`)
- [ ] **T171 `apps/web/src/lib/api/rate-limit.ts`** — `enforceLimit(key_id, limit_rpm) → { ok: boolean, remaining, reset }` using `api_rate_counters` table
- [ ] T172 `apps/web/src/lib/api/webhook-sign.ts` — `signPayload(secret, body) → { timestamp, signature }`
- [ ] T173 `apps/web/src/app/api/v1/_middleware.ts` (or Next.js middleware matcher) — applies auth + rate-limit to all `/v1/public/*` routes

### 9b. Public endpoints

- [ ] T180 [P] `apps/web/src/app/api/v1/public/profiles/[slug]/route.ts` — GET (scope `read:public_profile`)
- [ ] T181 [P] `apps/web/src/app/api/v1/public/credentials/[id]/route.ts` — GET (scope `read:verifiable_credential`)
- [ ] T182 [P] `apps/web/src/app/api/v1/public/webhooks/subscriptions/route.ts` — POST/DELETE (scope `webhook:subscribe`)

### 9c. Developer console + webhook dispatcher

- [ ] T190 [P] `apps/web/src/app/api/api-keys/route.ts` — POST create (returns plaintext once), GET list (no hash exposure)
- [ ] T191 [P] `apps/web/src/app/api/api-keys/[id]/rotate/route.ts` — POST
- [ ] T192 [P] `apps/web/src/app/api/api-keys/[id]/route.ts` — DELETE (revoke)
- [ ] T193 [P] `apps/web/src/app/(company)/developers/api-keys/page.tsx` — UI
- [ ] T194 **`supabase/functions/webhook-dispatcher/index.ts`** — consumes a `webhook_deliveries` outbox: signs payload, POSTs to subscriber, retries with backoff, marks delivery
- [ ] T195 Trigger function: on `placement_confirmed`, `credential.issued`, `score.updated` events from existing 002 flows, INSERT into `webhook_deliveries` for every matching subscription
- [ ] T196 Unit tests `tests/integration/webhook-signing.test.ts`
- [ ] T197 E2E `tests/e2e/public-api-rate-limit.spec.ts`

**Checkpoint**: P3 ecosystem shippable behind `004_public_api` flag (invited-only).

---

## Phase 10 — PWA + Offline (US8, P3)

- [ ] T210 [P] Install `serwist` + `@serwist/next`; configure in `next.config.mjs`
- [ ] T211 [P] `apps/web/src/app/manifest.ts` — PWA manifest (Next.js 15 metadata API)
- [ ] T212 [P] Create PWA icons in `apps/web/public/icons/` (192, 512, maskable)
- [ ] T213 [P] `apps/web/src/sw/service-worker.ts` — service worker with `network-first` for `/api/*`, `stale-while-revalidate` for dashboard, `cache-first` for static
- [ ] T214 [P] `apps/web/src/app/offline/page.tsx` — offline fallback page
- [ ] T215 [P] Background sync handler for mark-nudge-read mutations
- [ ] T216 E2E `tests/e2e/pwa-offline.spec.ts` — install PWA, disconnect, verify offline behavior

**Checkpoint**: P3 PWA shippable behind `004_pwa` flag.

---

## Phase 11 — Outcome-based pricing (US9, P3)

- [ ] T230 [P] `apps/web/src/app/api/outcome-billing/events/route.ts` — POST (service-role only) to create billing event
- [ ] T231 [P] `apps/web/src/app/api/outcome-billing/events/[id]/dispute/route.ts` — POST dispute (admin auth)
- [ ] T232 [P] `apps/web/src/app/(college)/admin/billing/page.tsx` — billing dashboard + dispute UI
- [ ] T233 Update existing placement-confirmation pipeline (in 002) to invoke `/api/outcome-billing/events` when `outcome_contracts.status='active'` for the institution
- [ ] T234 Cron in `038_cron_004.sql`: nightly job that finalizes billing events past 30-day dispute window
- [ ] T235 E2E `tests/e2e/outcome-billing.spec.ts`

**Checkpoint**: P3 outcome pricing shippable behind `004_outcome_pricing` flag.

---

## Phase 12 — Next-best-skill (US10, P3)

- [ ] T250 [P] `apps/web/src/lib/algorithms/next-best-skill.ts` — pure SQL-backed function: `computeRecommendations(student_id) → Recommendation[]`
- [ ] T251 [P] `supabase/functions/next-best-skill/index.ts` — orchestrator: walks active students, populates `next_best_skills` rows
- [ ] T252 [P] `apps/web/src/app/(student)/dashboard/skills/next-best-skill.tsx` — recommendation card on student dashboard
- [ ] T253 Cron in `038_cron_004.sql`: daily recompute
- [ ] T254 Unit tests `tests/integration/next-best-skill.test.ts`

**Checkpoint**: P3 retention loop shippable behind `004_next_best_skill` flag.

---

## Phase 13 — Cross-cutting

- [ ] T270 [P] Add all new feature flags to `feature_flags` seed (in `supabase/seed.sql`)
- [ ] T271 [P] Update `AGENTS.md` to reference 004 plan
- [ ] T272 [P] Update `README.md` with the new feature surfaces (1 paragraph per phase)
- [ ] T273 [P] `docs/004-rollout-runbook.md` — operator runbook for staged rollout
- [ ] T274 [P] DPDP / SOC2 audit log addendum: ensure all new tables have admin-readable audit trails
- [ ] T275 Migration `038_cron_004.sql` — consolidates all 004 cron jobs

---

## Parallel Opportunities

- Phase 1 (T010-T014) all parallel.
- Phase 2 (T020-T027) all parallel after Phase 1.
- Phase 3a, 4, 5a can run in parallel after Phase 2.
- Phase 3b depends on 3a + Phase 1.
- Phase 5b depends on 5a + Phase 1.
- Phase 6, 7, 8 can run in parallel after Phase 2.
- Phase 9 can run in parallel after Phase 2 + the existing `users.locale`.
- Phase 10, 11, 12 fully independent — anytime after Phase 2.
- Phase 13 last (consolidation).

## Task Count Summary

| Phase | Tasks | Critical Path |
|---|---|---|
| 0 — Pre-flight | 6 | T006 |
| 1 — Migrations | 5 | T010-T013 |
| 2 — Types | 8 | T027 |
| 3 — Anti-cheat | 18 | T030, T031, T040 |
| 4 — i18n | 11 | T050-T053, T057 |
| 5 — ATS | 19 | T070, T071, T080, T081 |
| 6 — SSO + Faculty | 17 | T100, T110, T111 |
| 7 — Hackathon | 12 | T130 |
| 8 — Mock interview | 7 | T150 |
| 9 — Public API | 14 | T170, T171, T194 |
| 10 — PWA | 7 | T210, T213 |
| 11 — Outcome pricing | 6 | T230 |
| 12 — Next-best-skill | 5 | T250 |
| 13 — Cross-cutting | 6 | T270 |
| **Total** | **141** | |

## Rollout Recommendation

1. Land Phases 0–5 in the first sprint (P1 features behind flags).
2. Land Phases 6–8 in sprint 2 (P2 enterprise + active validation).
3. Land Phases 9–12 in sprint 3 (P3 ecosystem + retention).
4. Phase 13 in parallel with sprint 3 finish.
5. Cohort rollout per `quickstart.md` §12.
