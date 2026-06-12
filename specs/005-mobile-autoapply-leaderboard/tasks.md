# Tasks: 005 — Mobile + Auto-Apply + Leaderboard

**Feature**: `005-mobile-autoapply-leaderboard`
**Generated**: 2026-06-07
**Source**: `specs/005-mobile-autoapply-leaderboard/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`
**Migrations**: `051_mobile_autoapply.sql` (main, 6 tables + 1 MV), `052_cron_005.sql` (cron consolidation)

Atomic, dependency-ordered tasks. `[P]` = parallelizable with siblings sharing the same phase prefix. **Bold** tasks are critical-path.

---

## Phase 0 — Pre-flight

- [x] T001 [P] Survey existing migrations (001-042 present; 043 reserved for 006 cron per project, but the 005 brief reserves 051/052 for this feature)
- [x] T002 [P] Survey existing edge functions and shared packages; confirm `leaderboard-*`, `mobile-*`, `auto-apply-*` names do not clash
- [x] T003 [P] Add 005 env vars to `.env.local.example`: `EXPO_PUBLIC_API_BASE_URL`, `EAS_PROJECT_ID`, `EAS_TOKEN`, `PLAYWRIGHT_BROWSERS_PATH`, `AUTO_APPLY_DAILY_DRAFT_CAP=5`, `LEADERBOARD_CRON_HOUR_UTC=2`
- [x] T004 [P] Add 005 env vars to `turbo.json` `globalEnv` array
- [x] T005 Add `@antarix/mobile` workspace to `pnpm-workspace.yaml` (`apps/mobile`)
- [x] T006 Install Expo + RN dependencies: `expo`, `expo-router`, `expo-notifications`, `expo-linking`, `expo-device`, `react-native-reanimated`, `@shopify/react-native-skia`, `expo-image`, `expo-secure-store`. Install Playwright: `@playwright/test` + `playwright`. Install share-card renderer: `@vercel/og`.

**Checkpoint**: Workspace ready; `pnpm --filter @antarix/mobile` resolves; envs wired.

---

## Phase 1 — Schema [all parallel]

- [x] **T010 [P] Migration `051_mobile_autoapply.sql`** — 6 tables (`auto_apply_log`, `auto_apply_templates`, `leaderboard_share_cards`, `leaderboard_opt_outs`, `mobile_device_tokens`, `mobile_app_sessions`) + 1 materialized view (`mv_cross_college_leaderboard`) + 4 column additions (`users.cover_letter_drafts_today`, `users.last_mobile_session_at`, `student_applications.cover_letter_text`, `student_applications.auto_apply_session_id`); HNSW-equivalent index on MV; RLS per data-model.md
- [x] **T011 [P] Migration `052_cron_005.sql`** — 5 `pg_cron.schedule(...)` entries: `leaderboard-refresh` at `LEADERBOARD_CRON_HOUR_UTC` UTC, `leaderboard-tier-recompute` at +30min, `mobile-token-cleanup` at 04:00 UTC, `auto-apply-daily-cap-reset` at 00:30 UTC, `leaderboard-opt-out-propagator` at 01:00 UTC
- [x] T012 [P] Materialized-view unique index on `(rank_global, student_id)` for MV; partial unique index on `auto_apply_log(student_id, created_at DESC)`

**Checkpoint**: 6 new tables + 1 MV + 2 extended tables; RLS verified; `pnpm supabase db reset` clean.

---

## Phase 2 — Shared types + utilities [all parallel after Phase 1]

- [x] T020 [P] Create `packages/types/mobile.ts` with TS types: `MobileDeviceToken`, `MobileAppSession`, `PushKind` union (`apns`|`fcm`|`web_push_legacy`)
- [x] T021 [P] Create `packages/types/auto-apply.ts`: `AutoApplyStep` union, `AutoApplyLogRow`, `AutoApplyTemplate`
- [x] T022 [P] Create `packages/types/leaderboard.ts`: `LeaderboardRank`, `LeaderboardTier` union (`bronze`|`silver`|`gold`|`platinum`|`diamond`), `ShareCardVariant`
- [x] T023 [P] Update `packages/types/database.ts` (regen via `supabase gen types`) to add 005 tables
- [x] T024 [P] Add `@antarix/llm-cost-caps` to `packages/config/llm-cost-caps.ts` with shared constants (`COVER_LETTER_DAILY_DRAFT_CAP=5`, `COVER_LETTER_TOKEN_BUDGET=4000`)

**Checkpoint**: Types compile; shared caps importable from 004/005/007.

---

## Phase 3 — Mobile app scaffold (US1) [P1]

### 3a. Expo monorepo integration (parallel)

- [x] **T030 `apps/mobile/package.json`** — Expo SDK 51, scripts: `start`, `android`, `ios`, `eject`, `eas:build:dev`, `eas:build:prod`
- [x] T031 [P] `apps/mobile/app.json` — Expo config: name `@antarix/mobile`, slug `antarix`, scheme `antarix`, ios bundleId `app.antarix.mobile`, android package `app.antarix.mobile`
- [x] T032 [P] `apps/mobile/eas.json` — 3 build profiles: `development` (simulator + dev client), `preview` (internal TestFlight + Play Internal), `production` (store-ready)
- [x] T033 [P] `apps/mobile/app/_layout.tsx` — root layout with Expo Router; providers: `SupabaseProvider`, `AuthProvider`, `LocaleProvider` (reuses 004 i18n), `ThemeProvider`
- [x] T034 [P] `apps/mobile/app/(auth)/login.tsx` — Supabase auth screen with biometric prompt (FaceID/TouchID/Android Biometric)
- [x] T035 [P] `apps/mobile/app/(onboarding)/index.tsx` — multi-step onboarding flow that resumes from `?resume=<token>` deep link
- [x] T036 [P] `apps/mobile/src/lib/supabase.ts` — Supabase client (reuses web config; reads `EXPO_PUBLIC_*` env)
- [x] T037 [P] `apps/mobile/src/lib/push.ts` — push registration: APNs on iOS, FCM on Android, fallback to 003 web-push; persists `mobile_device_tokens` row
- [x] T038 [P] `apps/mobile/src/lib/deep-link.ts` — universal link + Expo `Linking` handler for `https://antarix.app/launch?resume=<token>`

### 3b. Mobile screens (parallel after 3a)

- [x] **T040 [P] `apps/mobile/app/(tabs)/_layout.tsx`** — bottom tab navigator: Dashboard, Skills, Mentors, Curriculum, Collab, Leaderboard, Signals
- [x] T041 [P] `apps/mobile/app/(tabs)/index.tsx` — dashboard with 7-tile grid (Skill Proof score, next-best-skill, mentor count, curriculum today, collab invites, leaderboard rank, signals status); streak-fire animation on cold start if streak ≥ 7
- [x] T042 [P] `apps/mobile/app/(tabs)/skills.tsx` — skill proof breakdown, calls `/api/skill-proof/score` (existing 002 endpoint)
- [x] T043 [P] `apps/mobile/app/(tabs)/mentors.tsx`** — mentor list, calls 007 `/api/mentors`; tap to open request flow
- [x] T044 [P] `apps/mobile/app/(tabs)/curriculum.tsx`** — "today's 3 lessons" cards, calls 007 `/api/curriculum/today`; tap to mark complete or "too easy/hard/irrelevant"
- [x] T045 [P] `apps/mobile/app/(tabs)/collab.tsx`** — active collab room invites + join button, calls 008 `/api/collab/rooms` and 008 video provider
- [x] T046 [P] `apps/mobile/app/(tabs)/leaderboard.tsx`** — global cross-college leaderboard (calls 005 `/api/v1/public/leaderboard/global`); tier badge; "share my rank" CTA → native share sheet
- [x] T047 [P] `apps/mobile/app/(tabs)/signals.tsx`** — privacy center (delegates to 006 `/settings/signals` web view via WKWebView/Chrome Custom Tab)
- [x] T048 [P] `apps/mobile/app/(company)/ats.tsx`** — recruiter ATS dashboard (consumes 004 ATS endpoints)

**Checkpoint**: Mobile app boots; all 7 tabs render; deep link works; push registers.

### 3c. EAS build + submission

- [x] T050 [P] EAS `development` profile builds iOS Sim + Android emulator without errors
- [x] T051 [P] EAS `preview` builds internal TestFlight + Play Internal tracks
- [x] T052 [P] EAS `production` config — bundle id, version, build number, submit profiles
- [x] T053 Submit to TestFlight + Play Internal; capture first install metrics (within 48h)

**Checkpoint**: Mobile app GA-ready behind `005_mobile_app` flag.

---

## Phase 4 — Cover letter LLM (US2 part a) [P1]

- [x] **T060 [P] `apps/web/src/lib/auto-apply/cover-letter-prompt.ts`** — structured prompt template: student Skill Proof summary + job description → 280-400 word tailored cover letter; pulls LLM provider from 004 shared client
- [x] T061 [P] `apps/web/src/app/api/auto-apply/cover-letter/route.ts` — POST `{ job_id, job_description, student_id }` → returns `{ draft_id, body, tokens_used }`; enforces `COVER_LETTER_DAILY_DRAFT_CAP=5` per student per day; updates `users.cover_letter_drafts_today`
- [x] T062 [P] `apps/web/src/app/api/auto-apply/cover-letter/[id]/route.ts` — PUT (save edited draft), DELETE (discard)
- [x] T063 [P] UI in mobile `app/(tabs)/jobs/[id]/apply.tsx` — review/edit cover letter modal, "Save & apply" button writes to `student_applications.cover_letter_text`
- [x] T064 E2E `tests/e2e/auto-apply-cover-letter.spec.ts` — seed verified student, post job, assert draft returned, save, assert `student_applications.cover_letter_text` populated

**Checkpoint**: Cover letter generation works end-to-end with cost cap enforced.

---

## Phase 5 — Auto-apply headless (US2 part b) [P1]

### 5a. Playwright service

- [x] **T070 [P] `apps/auto-apply/package.json`** — standalone Node 20 service; deps: `playwright`, `@supabase/supabase-js`, `express`
- [x] T071 [P] `apps/auto-apply/src/index.ts` — HTTP server: `POST /sessions`, `GET /sessions/:id/status`, `POST /sessions/:id/submit`, `POST /sessions/:id/abandon`
- [x] T072 [P] `apps/auto-apply/src/playwright-runner.ts` — boots headless Chromium; per session: 1 vCPU + 512MB cap; 5-min idle timeout
- [x] T073 [P] `apps/auto-apply/src/form-filler.ts` — field mapping library: maps W3C VC claim names + confirmed profile fields to ATS form selectors (configurable via `auto_apply_templates`)
- [x] T074 [P] `apps/auto-apply/src/log-emitter.ts` — writes `auto_apply_log` rows in real time via Supabase service-role; never logs raw form values
- [x] T075 [P] `apps/auto-apply/src/kill-switch.ts` — checks `auto_apply_templates.disabled_for_domain` before every session start; throws `KillSwitchHit` if blocked

### 5b. Web routes + embed view

- [x] **T080 [P] `apps/web/src/app/api/auto-apply/session/route.ts`** — POST `{ job_id }` → starts Playwright session; returns `{ session_id, embed_url }`
- [x] T081 [P] `apps/web/src/app/api/auto-apply/session/[id]/status/route.ts` — GET → returns latest log row + step
- [x] T082 [P] `apps/web/src/app/api/auto-apply/session/[id]/submit/route.ts` — POST (gated on user click) → triggers Playwright submit
- [x] T083 [P] `apps/web/src/app/api/auto-apply/session/[id]/abandon/route.ts` — POST → kills session
- [x] T084 [P] `apps/web/src/app/(student)/auto-apply/[id]/page.tsx` — `<iframe>` embed view with "Submit" + "Cancel" buttons
- [x] T085 [P] `apps/web/src/app/api/auto-apply/templates/route.ts` — GET (admin) + POST (admin): manage `auto_apply_templates` (per-domain field maps + kill-switch)
- [x] T086 E2E `tests/e2e/auto-apply-headless.spec.ts` — mock ATS form, seed verified student, start session, assert fields prefilled, assert agent does NOT auto-submit, click submit in embed, assert form posted

**Checkpoint**: Auto-apply works end-to-end; student final-click only.

---

## Phase 6 — Leaderboard (US3) [P1]

### 6a. Materialized view + refresh

- [x] **T090 `supabase/functions/leaderboard-refresh/index.ts`** — runs `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cross_college_leaderboard`; reads from 003 streaks, 004 mock-interview rubric, 006 biometric aggregates, 007 mentor-session counts, 008 teamwork scores
- [x] T091 [P] `supabase/functions/leaderboard-tier-recompute/index.ts` — recomputes tier bands from current MV contents; writes back to MV tier column
- [x] T092 [P] `apps/web/src/lib/leaderboard/tier-bands.ts` — pure fn: percentile → tier (Bronze <60, Silver 60-75, Gold 75-85, Platinum 85-95, Diamond ≥95)
- [x] T093 [P] `supabase/functions/leaderboard-opt-out-propagator/index.ts` — when a `leaderboard_opt_outs` row is inserted, removes the student from MV within 60s

### 6b. Public API + UI

- [x] **T100 [P] `apps/web/src/app/api/v1/public/leaderboard/global/route.ts`** — GET → returns paginated top 100 per category (score/streak/mock-int/mentor/collab); RLS: never returns opted-out students; `Cache-Control: public, max-age=300`
- [x] T101 [P] `apps/web/src/app/api/leaderboards/global/opt-out/route.ts` — POST + DELETE; sets `leaderboard_opt_outs`
- [x] T102 [P] `apps/web/src/app/api/leaderboards/share-card/[rank_id].png/route.ts` — uses `@vercel/og` to render 1200x630 OG image with student tier + rank + college logo
- [x] T103 [P] `apps/web/src/app/(public)/leaderboards/global/page.tsx` — public page (SSG + ISR revalidate 5min); tabs: All-time / This month / This week; filter by college/year/specialization
- [x] T104 [P] `apps/web/src/app/(company)/leaderboards/page.tsx` — recruiter view: drill-down by college, top-100 per cohort, export CSV
- [x] T105 E2E `tests/e2e/leaderboard-optout-propagation.spec.ts` — seed 3 students, opt one out, wait 60s, assert MV refreshed and opted-out student absent

**Checkpoint**: Leaderboard ships behind `005_global_leaderboard` flag; opt-out ≤ 60s propagation.

---

## Phase 7 — E-sports UI (US4) [P2]

- [x] **T110 [P] `apps/web/src/components/leaderboard/tier-badge.tsx`** — reusable tier badge (Bronze/Silver/Gold/Platinum/Diamond) with shine animation
- [x] T111 [P] `apps/mobile/src/components/streak-fire.tsx`** — Reanimated 3 fire animation, plays once per cold-start when streak ≥ 7
- [x] T112 [P] `apps/web/src/components/leaderboard/share-card.tsx`** — inline share button → calls 005 share-card endpoint → opens native share sheet (web `navigator.share` if available, fallback to "Copy link")
- [x] T113 [P] `apps/mobile/src/components/leaderboard/share-card.tsx`** — same as T112, but uses `UIActivityViewController`/`Intent.ACTION_SEND`
- [x] T114 [P] Confetti on first leaderboard entry — `react-native-confetti-cannon` + web `canvas-confetti`
- [x] T115 E2E `tests/e2e/leaderboard-share-card.spec.ts` — generate card, assert image content (text "Tier: Gold", rank number)

**Checkpoint**: Shareable leaderboard UX ships behind `005_esports_ui` flag.

---

## Phase 8 — Cross-cutting

- [x] T120 [P] Add 12 new feature flags to `supabase/seed.sql` `feature_flags` table (one per phase above: `005_mobile_app`, `005_auto_apply_cover_letter`, `005_auto_apply_headless`, `005_global_leaderboard`, `005_esports_ui`, `005_push_apns_fcm`, `005_deep_link_resume`, `005_share_card_native`, `005_leaderboard_opt_out`, `005_auto_apply_kill_switch`, `005_cover_letter_cost_cap`, `005_apps_workspace_registered`)
- [x] T121 [P] Update `AGENTS.md` to reference 005 plan
- [x] T122 [P] Update `README.md` with mobile install instructions, auto-apply flow, leaderboard surface
- [x] T123 [P] `docs/005-rollout-runbook.md` — staged rollout: Tier-3 colleges first (where app install conversion is highest), then Tier-2, then Tier-1
- [x] T124 DPDP / SOC2 audit: ensure `mobile_device_tokens`, `auto_apply_log`, `mobile_app_sessions` all have admin-readable audit trails; opt-out propagation logged to `dpdp_audit`
- [x] T125 E2E `tests/e2e/mobile-full-journey.spec.ts` — install → onboard → view dashboard → open mentor list → start collab room → view leaderboard → opt out (assert removed within 60s) → uninstall (assert token deleted)

---

## Parallel Opportunities

- Phase 0 (T001-T006) all parallel.
- Phase 1 (T010-T012) all parallel.
- Phase 2 (T020-T024) all parallel after Phase 1.
- Phase 3a (T030-T038) all parallel; Phase 3b (T040-T048) all parallel after 3a; 3c after 3b.
- Phases 4, 5, 6a can all start in parallel after Phase 2.
- Phase 6b depends on 6a.
- Phase 7 depends on Phase 6.
- Phase 8 last (consolidation).

## Task Count Summary

| Phase | Tasks | Critical Path |
|---|---|---|
| 0 — Pre-flight | 6 | T005, T006 |
| 1 — Migrations | 3 | T010, T011 |
| 2 — Types | 5 | T023 |
| 3 — Mobile app | 24 | T030, T040 |
| 4 — Cover letter | 5 | T060, T061 |
| 5 — Auto-apply headless | 17 | T070, T080 |
| 6 — Leaderboard | 16 | T090, T100 |
| 7 — E-sports UI | 6 | T110 |
| 8 — Cross-cutting | 6 | T120 |
| **Total** | **88** | |

## Rollout Recommendation

1. Land Phases 0-2 + 6 (leaderboard ships first because it's the most viral — share cards drive app installs) in sprint 1.
2. Land Phases 3 (mobile) + 4 (cover letter) in sprint 2.
3. Land Phases 5 (headless) + 7 (e-sports UI) in sprint 3.
4. Phase 8 throughout.
5. Cohort rollout: Tier-3 colleges first (highest mobile-install growth signal), then Tier-2, then Tier-1.
6. Each phase ships behind its own `005_*` flag, default OFF.
