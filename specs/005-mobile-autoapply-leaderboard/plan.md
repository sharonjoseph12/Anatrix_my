# Implementation Plan: 005 — Mobile, Auto-Apply, Leaderboard

**Branch**: `005-mobile-autoapply-leaderboard` | **Date**: 2026-06-07 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/005-mobile-autoapply-leaderboard/spec.md)
**Input**: Feature specification from `specs/005-mobile-autoapply-leaderboard/spec.md`
**Builds on**: 001 (foundation) + 002 (verified skill platform, `users`, `verifiable_credentials`, `student_applications`, W3C VC) + 003 (engage & showcase, web-push, streaks) + 004 (PWA + service worker, public API, configurable LLM provider, weekly/monthly cost-cap pattern, anti-cheat, `next_best_skill`) + 006 (privacy center, signals/privacy surface) + 007 (mentor list API, curriculum today API) + 008 (collab room API, `VideoRoomProvider`).
**Migrations**: `051_mobile_autoapply.sql` (main, 6 new tables + 1 materialized view) + `052_cron_005.sql` (cron consolidation).

## Summary

Four product moves on top of the 001-008 stack: (US1, P1) a React Native + Expo mobile app under a new `apps/mobile/` workspace, (US2, P1) an auto-apply agent (LLM cover-letter drafter + Playwright headless form filler), (US3, P1) a global cross-college leaderboard via a Postgres materialized view, and (US4, P2) an e-sports style gamified UI with tier badges, share cards, and streak animations. All four reuse the existing web API surface; no parallel backend.

**Technical approach**: Add one additive SQL migration (`051_mobile_autoapply.sql`) creating 6 new tables + 1 Postgres materialized view; one cron migration (`052_cron_005.sql`) consolidating the nightly leaderboard refresh + tier-band recompute + opt-out propagation. Add a new Turborepo workspace `apps/mobile/` (registered in `pnpm-workspace.yaml` as `@antarix/mobile`) with Expo SDK 51+, Expo Router, EAS Build/Submit, and React Native New Architecture. Add 1 hardened Node service `apps/auto-apply/` (Playwright headless browser) registered as `@antarix/auto-apply`. Add ~14 new Next.js API routes under `apps/web/src/app/api/auto-apply/`, `apps/web/src/app/api/leaderboards/`, and `apps/web/src/app/api/v1/public/leaderboard/`. Add 2 new Supabase Edge Functions (`leaderboard-refresh`, `leaderboard-tier-recompute`). Add 1 new PWA-shared page (`/leaderboards/global`). Add 1 new mobile-first page tree under `apps/mobile/src/app/`.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+ *(inherited)*; Expo SDK 51+; React Native 0.74+ with New Architecture; Playwright 1.45+
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, next-intl, handlebars, web-push, discord-verify, pgcrypto, pgsodium
**Primary Dependencies (new)**: `expo`, `expo-router`, `expo-notifications`, `expo-apple-authentication`, `expo-application`, `expo-device`, `expo-linking`, `expo-constants`, `react-native`, `react-native-reanimated` (3.x), `react-native-skia`, `react-native-view-shot`, `@gorhom/bottom-sheet`, `@supabase/supabase-js`, `zod` (for cover-letter JSON), `playwright`, `playwright-extra` (with stealth plugin for ATS forms), `puppeteer-core` (NOT used — Playwright only; rationale in research.md D4), `@vercel/og` (server-rendered share card)
**Storage**: PostgreSQL (via Supabase) — 1 new additive migration (051) creating 6 new tables + 1 materialized view; 1 cron migration (052). No destructive changes; 2 columns added to existing tables (`users.cover_letter_drafts_today` denormalized, `users.last_mobile_session_at`).
**Testing**: Vitest (unit) + Playwright (e2e web) + Detox (e2e mobile) + Supabase CLI integration *(inherited + Detox added)*
**Target Platform**: Web (Next.js 15 App Router multi-portal), iOS (EAS Build → TestFlight), Android (EAS Build → Play Internal), hardened Node service for Playwright *(inherited + 2 new surfaces)*
**Project Type**: Web service (multi-portal SaaS) + Edge Functions + Expo mobile app + standalone Node service *(inherited + 2 new surfaces)*
**Performance Goals (inherited)**: Dashboard < 2s, search < 5s, public profile p95 ≤ 2s
**Performance Goals (new)**:
- Mobile dashboard p95 render ≤ 3s on 3G
- Cover-letter LLM call p95 ≤ 8s
- Auto-apply Playwright session create p95 ≤ 5s
- Auto-apply embed render p95 ≤ 1s (after headless page is ready)
- Leaderboard query p95 ≤ 500ms
- Materialized view refresh p95 ≤ 5 min
- Tier-band recompute p95 ≤ 30s
- Share-card PNG render p95 ≤ 3s
- Push delivery: APNs p95 ≤ 5s, FCM p95 ≤ 5s, web-push fallback p95 ≤ 5s
**Constraints (inherited)**: India market, opt-in privacy, RLS-enforced, no destructive migrations
**Constraints (new)**:
- Auto-apply: NEVER auto-submit; the final "Submit" click is the student's, in the embedded browser view
- Auto-apply: 5 drafts/student/day cap; reset at `users.timezone` local midnight
- Auto-apply: per-tenant Playwright concurrency cap of 5 (configurable); 5-min idle timeout per session
- Auto-apply: per-domain kill-switch configurable in `auto_apply_templates.disabled_for_domain`
- Leaderboard: opted-out students NEVER appear (enforced at MV + RLS + API layer)
- Leaderboard: materialized view is `REFRESH MATERIALIZED VIEW CONCURRENTLY` (allows reads during refresh)
- Mobile: New Architecture on iOS 14+ / Android API 28+; legacy bridge fallback
- Cost caps: `COVER_LETTER_WEEKLY_TOKEN_CAP=20000` per student/week; `COVER_LETTER_MONTHLY_TENANT_TOKEN_CAP=2000000` per tenant/month (shared with 004 general LLM cap)
- Privacy: `auto_apply_log.screenshot_url` is signed; expires 7 days after session end
- Privacy: opt-out propagates to MV within 60s (denormalized `opted_out` column on MV, rechecked at read time)
**Scale/Scope (inherited)**: 50K students Y2
**Scale/Scope (new)**: 50K student ceiling; mobile app install rate ~20% over 60 days = ~10K MAU; auto-apply cap = 5 drafts × 10K = 50K drafts/day peak (LLM cost-controlled); leaderboard MV ~5K rows/period/kind; Playwright sessions peak 200/day; share-card generation peak 1K/day.

## Constitution Check

The project constitution (`.specify/memory/constitution.md`) remains the unmodified template — no custom principles ratified. This plan respects the *implicit* principles followed by 001-004 and 006-008:

- **Additive-only schema** (1 new migration creating 6 tables + 1 MV; 1 cron migration; 2 additive column changes; no DROP/ALTER on existing critical columns)
- **Privacy-first** (opted-out students excluded at MV + RLS + API; auto-apply never auto-submits; kill-switch per domain; sign-in required for all surfaces; cost caps prevent runaway LLM spend)
- **Cost-aware** (5 drafts/student/day; per-student weekly + per-tenant monthly LLM caps inherited from 004; per-tenant Playwright concurrency cap; materialized view nightly refresh — no real-time warehouse)
- **Observability** (every auto-apply step logged; every share-card render logged; every push delivery logged; every leaderboard query logged at DEBUG; every cron run logged)
- **Backward compatibility** (existing 001-004 + 006-008 functionality unchanged; mobile app is additive; PWA still works; auto-apply is opt-in via flags; leaderboard is opt-out by default)
- **Reuse over rebuild** (no new LLM provider — uses 004 Groq+OpenAI; no new push provider — uses 003 web-push + APNs/FCM; no new auth — uses Supabase; no new calendar — uses 002 calendar; no new cost-cap pattern — copies 004 weekly/monthly)
- **ClickHouse permanently deferred** (per user brief; replaced by Postgres materialized view)

**No violation blocks Phase 0 / Phase 1 of this plan.** Recommended: run `/speckit-constitution` before code, but not blocking.

## Project Structure

### Documentation (this feature)

```text
specs/005-mobile-autoapply-leaderboard/
├── plan.md              # This file
├── research.md          # Phase 0 output — 9 new decisions
├── data-model.md        # Phase 1 output — 6 new tables + 1 MV
├── quickstart.md        # Phase 1 output — env vars, migrations 051-052, EAS profiles
├── contracts/
│   └── api.md           # Phase 1 output — internal + public + mobile API surfaces
├── checklists/
│   └── requirements.md  # From spec phase (12-item quality checklist)
└── tasks.md             # Phase 2 output — atomic, dependency-ordered
```

### Source Code (repository root)

Inherits 001-008 layout unchanged. New files:

```text
pnpm-workspace.yaml                              # UPDATE — add 'apps/mobile', 'apps/auto-apply'
turbo.json                                       # UPDATE — register new pipeline entries

supabase/
├── migrations/
│   ├── 051_mobile_autoapply.sql                 # NEW — 6 tables + 1 materialized view
│   └── 052_cron_005.sql                         # NEW — leaderboard refresh + tier recompute + opt-out propagation
└── functions/
    ├── leaderboard-refresh/                    # NEW — nightly MV refresh + staleness header
    └── leaderboard-tier-recompute/             # NEW — weekly tier-band recompute

apps/mobile/                                      # NEW WORKSPACE
├── app.json                                     # NEW — Expo config (iOS bundle, Android package, name, slug)
├── package.json                                # NEW — @antarix/mobile; Expo SDK 51; main: 'expo-router/entry'
├── eas.json                                    # NEW — development, preview, production build profiles
├── tsconfig.json                               # NEW
├── babel.config.js                             # NEW — babel-preset-expo
├── metro.config.js                             # NEW
├── index.ts                                    # NEW — registerRootComponent
├── app/                                        # NEW — Expo Router file-based routes
│   ├── _layout.tsx                             # NEW — root layout
│   ├── (onboarding)/                           # NEW — onboarding flow
│   │   ├── _layout.tsx
│   │   ├── index.tsx                           # NEW — landing → detect Expo Go / store CTA
│   │   ├── resume.tsx                          # NEW — deep link resume
│   │   └── biometric-login.tsx                 # NEW
│   ├── (tabs)/                                 # NEW — main tab navigator
│   │   ├── _layout.tsx
│   │   ├── dashboard.tsx                       # NEW
│   │   ├── skills.tsx                          # NEW — Skill Proof Breakdown (calls existing /api/skill-proof)
│   │   ├── mentor.tsx                          # NEW — calls 007 /api/mentors
│   │   ├── curriculum.tsx                      # NEW — calls 007 /api/curriculum/today
│   │   ├── collab.tsx                          # NEW — calls 008 deep link
│   │   ├── signals.tsx                         # NEW — calls 006 /api/settings/signals
│   │   └── leaderboard.tsx                     # NEW — calls /api/v1/public/leaderboard/global
│   ├── jobs/                                   # NEW — auto-apply surface
│   │   ├── _layout.tsx
│   │   ├── index.tsx                           # NEW — list (calls existing /api/job-matches)
│   │   ├── [id]/
│   │   │   ├── cover-letter.tsx                # NEW — calls /api/auto-apply/cover-letter
│   │   │   └── auto-apply.tsx                  # NEW — calls /api/auto-apply/session, renders embed
│   │   └── share-card.tsx                      # NEW — calls /api/leaderboards/share-card/[rank_id]
│   └── settings/                               # NEW
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── leaderboard.tsx                     # NEW — opt-out toggle
│       └── push.tsx                            # NEW — push permissions
├── src/
│   ├── lib/                                    # NEW
│   │   ├── api-client.ts                       # NEW — Supabase + fetch wrapper; consumes EXPO_PUBLIC_API_BASE_URL
│   │   ├── auth.ts                             # NEW — Supabase auth bridge
│   │   ├── push.ts                             # NEW — APNs/FCM registration, web-push fallback
│   │   ├── deep-link.ts                        # NEW — universal-link handling
│   │   ├── animations/
│   │   │   ├── streak-fire.ts                  # NEW — Reanimated 3
│   │   │   ├── confetti.ts                     # NEW — react-native-skia
│   │   │   └── tier-badge.ts                   # NEW
│   │   └── share.ts                            # NEW — react-native-view-shot + share-sheet
│   ├── components/                             # NEW
│   │   ├── tile-grid.tsx                       # NEW — 7-tile dashboard grid
│   │   ├── leaderboard-row.tsx                 # NEW
│   │   ├── tier-badge.tsx                      # NEW
│   │   ├── share-card.tsx                      # NEW
│   │   ├── score-sparkline.tsx                 # NEW
│   │   └── embed-browser.tsx                   # NEW — WKWebView / Chrome Custom Tab for auto-apply
│   └── hooks/                                  # NEW
│       ├── use-daily-draft-cap.ts
│       ├── use-leaderboard.ts
│       └── use-push-token.ts
├── assets/                                     # NEW
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
└── e2e/                                        # NEW
    ├── onboarding.spec.ts                      # NEW
    ├── dashboard.spec.ts                       # NEW
    ├── auto-apply.spec.ts                      # NEW
    └── leaderboard.spec.ts                     # NEW

apps/auto-apply/                                # NEW WORKSPACE (hardened Node service)
├── package.json                                # NEW — @antarix/auto-apply
├── tsconfig.json                               # NEW
├── Dockerfile                                  # NEW — Playwright base image
├── src/
│   ├── index.ts                                # NEW — HTTP server (Fastify)
│   ├── browser.ts                              # NEW — Playwright lifecycle
│   ├── form-filler.ts                          # NEW — W3C VC → form-field mapping
│   ├── field-mapper.ts                         # NEW — domain → field template
│   ├── captcha-detector.ts                     # NEW
│   ├── sso-detector.ts                         # NEW
│   ├── kill-switch.ts                          # NEW — checks auto_apply_templates.disabled_for_domain
│   ├── embed-server.ts                         # NEW — serves the headless view to the mobile embed
│   ├── log-writer.ts                           # NEW — POST to /api/auto-apply/session/{id}/step
│   ├── concurrency.ts                          # NEW — per-tenant cap
│   └── types.ts                                # NEW

apps/web/src/
├── app/
│   ├── api/
│   │   ├── auto-apply/                         # NEW
│   │   │   ├── cover-letter/route.ts           # NEW — POST LLM draft
│   │   │   ├── session/route.ts                # NEW — POST start headless
│   │   │   ├── session/[id]/route.ts           # NEW — GET status
│   │   │   ├── session/[id]/step/route.ts      # NEW — POST step log (from auto-apply service)
│   │   │   ├── session/[id]/submit/route.ts    # NEW — POST final submit (student click)
│   │   │   └── daily-cap/route.ts              # NEW — GET current cap status
│   │   ├── leaderboards/                       # NEW
│   │   │   ├── global/route.ts                 # NEW — GET (recruiter view, RLS-filtered)
│   │   │   ├── opt-out/route.ts                # NEW — POST/DELETE
│   │   │   ├── share-card/[rank_id].png/route.ts  # NEW — GET PNG via @vercel/og
│   │   │   └── share-card/[rank_id]/route.ts   # NEW — GET OG metadata
│   │   ├── v1/public/leaderboard/global/route.ts  # NEW — GET (no API key, IP rate-limited)
│   │   ├── mobile/                             # NEW
│   │   │   ├── register-device/route.ts        # NEW — POST APNs/FCM/web-push token
│   │   │   ├── session/route.ts                # NEW — POST cold-start, PATCH heartbeat
│   │   │   └── deep-link/route.ts              # NEW — POST resume token
│   │   └── push/
│   │       └── send/route.ts                   # NEW — POST dispatcher (uses 003 web-push as fallback)
│   ├── (student)/
│   │   ├── leaderboards/
│   │   │   └── global/page.tsx                 # NEW — public read-only page
│   │   └── settings/
│   │       └── leaderboard/page.tsx            # NEW — opt-out toggle
│   ├── (company)/
│   │   └── leaderboards/
│   │       └── global/page.tsx                 # NEW — recruiter view (college/year/specialization filters)
│   ├── jobs/                                   # NEW — auto-apply entry from web
│   │   ├── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx                        # NEW — review + Save & apply
│   │       └── auto-apply/page.tsx             # NEW — embed view (loads auto-apply service embed)
│   └── share/
│       └── leaderboard/[rank_id]/page.tsx      # NEW — landing for share-card OG metadata
├── lib/
│   ├── auto-apply/                             # NEW
│   │   ├── cover-letter-prompt.ts              # NEW — pure fn: VC + job → prompt
│   │   ├── cover-letter-parser.ts              # NEW — pure fn: LLM output → 400-word cap
│   │   ├── daily-draft-cap.ts                  # NEW — 5/student/day, users.timezone-based reset
│   │   ├── job-description-extractor.ts        # NEW — fetch + extract text from job URL
│   │   └── kill-switch.ts                      # NEW — re-export from auto-apply service
│   ├── leaderboard/                            # NEW
│   │   ├── tier-band.ts                        # NEW — percentile → Bronze/Silver/Gold/Platinum/Diamond
│   │   ├── opt-out-propagator.ts               # NEW — 60s denorm cache
│   │   ├── share-card-renderer.tsx             # NEW — @vercel/og JSX
│   │   ├── og-metadata.ts                      # NEW — og:image, og:title, og:description
│   │   └── rate-limit.ts                       # NEW — IP-based 60 req/min
│   ├── mobile/                                 # NEW
│   │   ├── push-priority.ts                    # NEW — APNs > FCM > web-push
│   │   ├── device-token.ts                     # NEW — re-export from packages/types
│   │   └── app-version.ts                      # NEW
│   └── push/                                   # NEW (extends 003)
│       └── dispatcher.ts                       # NEW — multi-channel (APNs/FCM/web-push)
├── components/                                 # NEW
│   ├── leaderboard-row.tsx
│   ├── tier-badge.tsx
│   ├── share-card.tsx
│   ├── confetti.tsx                            # NEW — web canvas confetti
│   ├── streak-fire.tsx                         # NEW — web streak fire
│   └── daily-draft-cap-indicator.tsx           # NEW
└── messages/                                   # next-intl catalogs — extend en/hi/ta/te/mr
    ├── en.json                                 # extend with mobile + auto-apply + leaderboard keys
    ├── hi.json                                 # extend
    ├── ta.json                                 # extend
    ├── te.json                                 # extend
    └── mr.json                                 # extend

apps/web/public/                                 # NEW
└── share-cards/                                 # server-rendered PNGs cached here (signed URLs)

packages/
├── types/
│   ├── mobile.ts                               # NEW
│   ├── auto-apply.ts                           # NEW
│   ├── leaderboard.ts                          # NEW
│   ├── cover-letter.ts                         # NEW
│   ├── push.ts                                 # NEW
│   └── database.ts                             # UPDATE — add 051 table types
└── utils/
    ├── timezone.ts                             # NEW — daily cap reset helper
    └── percentile-band.ts                      # NEW — tier-band computation

tests/
├── e2e/
│   ├── mobile-onboarding.spec.ts               # NEW
│   ├── mobile-dashboard.spec.ts                # NEW
│   ├── mobile-push-fallback.spec.ts            # NEW
│   ├── auto-apply-cover-letter.spec.ts         # NEW
│   ├── auto-apply-headless-session.spec.ts     # NEW
│   ├── auto-apply-killswitch.spec.ts           # NEW
│   ├── auto-apply-never-autosubmit.spec.ts     # NEW
│   ├── leaderboard-public.spec.ts              # NEW
│   ├── leaderboard-opt-out.spec.ts             # NEW
│   ├── leaderboard-recruiter-view.spec.ts      # NEW
│   ├── leaderboard-tier-badge.spec.ts          # NEW
│   ├── share-card-og-metadata.spec.ts          # NEW
│   └── esports-streak-fire.spec.ts             # NEW
└── integration/
    ├── cover-letter-prompt.test.ts             # NEW
    ├── cover-letter-parser.test.ts             # NEW
    ├── daily-draft-cap.test.ts                 # NEW
    ├── tier-band.test.ts                       # NEW
    ├── leaderboard-opt-out-propagator.test.ts  # NEW
    ├── auto-apply-field-mapper.test.ts         # NEW
    ├── auto-apply-captcha-detector.test.ts     # NEW
    ├── auto-apply-kill-switch.test.ts          # NEW
    └── push-priority.test.ts                   # NEW
```

**Structure Decision**: Three new workspaces (`apps/mobile`, `apps/auto-apply`, plus the existing `apps/web` extending). One new additive migration (051) + one cron migration (052). The new mobile app and the auto-apply service are siblings in the monorepo; both registered in `pnpm-workspace.yaml`. The auto-apply service is **not** a Supabase Edge Function (Playwright is too heavy for Deno); it is a standalone Node service deployed alongside the existing `apps/web`.

### `pnpm-workspace.yaml` (the addition)

The brief asks for the workspace registration. Updated contents:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

No change is needed to the YAML — `apps/*` already globs `apps/mobile` and `apps/auto-apply`. The `package.json` of each new workspace registers them as `@antarix/mobile` and `@antarix/auto-apply` respectively. `turbo.json` `pipeline` is extended to add `build`/`start`/`eas-build` tasks for `apps/mobile` and `start`/`lint`/`test` for `apps/auto-apply`.

## Dependency Map

| Feature | What 005 depends on | Notes |
|---|---|---|
| 001 (foundation) | `users`, `institutions`, Supabase auth, RLS, audit | Inherited; no changes |
| 002 (verified skill platform) | `users.locale`, `users.timezone`, `verifiable_credentials`, `student_applications`, `job_matches` | Direct read for VC → form fields; existing `student_applications` extended with `cover_letter_text` |
| 003 (engage & showcase) | `nudges`, nudge dispatcher, web-push (`push_subscriptions`), streak | Web-push is the mobile fallback push channel; streak data feeds the leaderboard |
| 004 (11/10) | PWA service worker, public API, `next_best_skill`, configurable LLM (Groq primary, OpenAI fallback), weekly/monthly cost-cap pattern | LLM client reused; cost cap pattern copied; `next_best_skill` is a leaderboard input |
| 006 (deep signal capture) | `/api/settings/signals`, `biometric_aggregates`, score cap (3%+2%=5%) | Mobile signals tile is read-only against 006 surface; biometric score is a leaderboard input |
| 007 (adaptive learning) | `/api/mentors`, `/api/curriculum/today` | Mobile mentor + curriculum tiles are read-only against 007 surface; mentor-session count is a leaderboard input |
| 008 (collaborative mode) | `/api/collab/rooms`, `VideoRoomProvider` | Mobile collab tile deep-links to 008 web route; teamwork score is a leaderboard input |

## Complexity Tracking

No constitution violations to justify. The biggest single net-new risks:

1. **Playwright session reliability on flaky ATS forms** — mitigated by per-step logging + screenshot + resumable embed; per-tenant concurrency cap of 5 prevents one tenant from monopolizing the service; per-domain kill-switch prevents ToS violations.
2. **Materialized view staleness** — `REFRESH MATERIALIZED VIEW CONCURRENTLY` allows reads during refresh; on lock failure the API returns the previous refresh's data with `X-Leaderboard-Staleness` header; on 3rd failure the on-call is paged.
3. **Push channel fragmentation** — APNs/FCM/web-push are managed in a single `mobile_device_tokens` table; the dispatcher picks the highest-priority available; the brief permits a 60s propagation window.
4. **Cost-cap blowup on cover letters** — 5/student/day + 004 weekly + 004 monthly; the LLM call is gated before each call; the prompt is bounded (≤ 4K input tokens; ≤ 500 output tokens).
5. **Opt-out propagation race** — the MV is refreshed nightly; for sub-60s propagation, the API layer re-checks `leaderboard_opt_outs.opted_out` against the result set and filters in memory. The 60s SLO is met.

One explicit deferral (ClickHouse) is documented in spec.md "Out of Scope" with the rationale. The user's brief explicitly rejected the 004-considered ClickHouse plan in favour of a Postgres materialized view.

## Re-Evaluation of Constitution Check (post-design)

Still no violations. Plan respects:

- **Additive-only schema** (1 new migration creating 6 tables + 1 MV; 1 cron migration; 2 additive column changes; no DROP/ALTER on existing critical columns)
- **Privacy-first** (opted-out students excluded at MV + RLS + API; auto-apply never auto-submits; kill-switch per domain; sign-in required for all surfaces; cost caps prevent runaway LLM spend; push tokens are per-user + per-device; mobile sessions are per-cold-start)
- **Cost-aware** (5 drafts/student/day; per-student weekly + per-tenant monthly LLM caps inherited from 004; per-tenant Playwright concurrency cap; materialized view nightly refresh — no real-time warehouse)
- **Observability** (every auto-apply step logged with screenshot + latency; every share-card render logged; every push delivery logged; every leaderboard query logged at DEBUG; every cron run logged; every mobile cold-start logged)
- **Backward compatibility** (existing 001-004 + 006-008 functionality unchanged; mobile app is additive; PWA still works; auto-apply is opt-in via flags; leaderboard is opt-out by default)
- **Reuse over rebuild** (no new LLM provider — uses 004 Groq+OpenAI; no new push provider — uses 003 web-push + APNs/FCM; no new auth — uses Supabase; no new calendar — uses 002 calendar; no new cost-cap pattern — copies 004 weekly/monthly; no new embedding service — reads 007's; no new LLM prompt format — reuses 004)
- **Score integrity** (the leaderboard is built from already-capped scores: 004 anti-cheat deductions applied, 006 IDE+biometric caps applied, 008 teamwork cap applied)
