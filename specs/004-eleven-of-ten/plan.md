# Implementation Plan: 11/10 — Defensible Moat & Global Scale

**Branch**: `004-eleven-of-ten` | **Date**: 2026-06-06 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/004-eleven-of-ten/spec.md)
**Input**: Feature specification from `specs/004-eleven-of-ten/spec.md`
**Builds on**: 001 (foundation) + 002 (verified skill platform) + 003 (engage & showcase)

## Summary

Ten additive product moves on top of the 001+002+003 foundation, grouped by P1/P2/P3 priority. P1 closes existential trust/reach gaps (anti-cheat, ATS sync, i18n). P2 unlocks enterprise + active validation (SAML SSO, faculty grading, hackathons, mock interviews). P3 builds long-term moat (public API, PWA offline, outcome pricing, next-best-skill).

**Technical approach**: Reuse the entire 001+002+003 stack — Turborepo + pnpm, Next.js 15 multi-portal, Supabase (Postgres + Edge Functions + RLS), Chrome MV3 extension, Tailwind v4 + shadcn/ui, Vitest + Playwright, existing `next-intl`, web-push, handlebars, discord-verify, W3C VC infrastructure. Add 4 SQL migrations (034 anti-cheat + audit, 035 ats + sso + faculty, 036 hackathon + mock-interview, 037 api-keys + webhooks + outcome-pricing + next-best-skill), 8 new edge functions (`github-anticheat`, `dsa-anticheat`, `ats-sync-greenhouse`, `ats-sync-lever`, `mock-interview-llm`, `hackathon-grader`, `next-best-skill`, `webhook-dispatcher`), 1 SAML callback route (WorkOS), 4 locale catalogs (`hi`, `ta`, `te`, `mr`), 1 service worker + PWA manifest, and a handful of UI surfaces wired to the new tables.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+ *(inherited)*
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, next-intl, handlebars, web-push, discord-verify
**Primary Dependencies (new)**: `@workos-inc/node` (SAML), Greenhouse + Lever REST clients (no SDKs — REST is sufficient), OpenAI/Groq client for mock interviews (configurable provider), `serwist` or `next-pwa` for service worker, `@octokit/rest` (already implied) for GitHub anti-cheat enrichment
**Storage**: PostgreSQL (via Supabase) — 17 new tables across 4 additive migrations; no destructive changes
**Testing**: Vitest (unit) + Playwright (e2e) + Supabase CLI integration *(inherited)*
**Target Platform**: Web (responsive + PWA), Chrome Extension *(inherited)*, external bots *(inherited)*
**Project Type**: Web service (multi-portal SaaS) + Edge Functions + external integrations *(inherited)*
**Performance Goals (inherited)**: Dashboard <2s, search <5s, PublicProfile p95 ≤ 2s
**Performance Goals (new)**: ATS sync delivery p95 ≤ 5 min; anti-cheat full-account scan p95 ≤ 90s; mock-interview LLM turn p95 ≤ 5s; public API p95 ≤ 500ms
**Constraints (inherited)**: India market, opt-in privacy, RLS-enforced
**Constraints (new)**: Mock-interview LLM cost cap (per-student weekly, per-tenant monthly); ATS provider rate limits (Greenhouse 50 req/10s, Lever 10 req/s); WorkOS SAML connections counted by tier; hackathon code execution must be sandboxed (no network, CPU/memory caps); public API per-key rate limit
**Scale/Scope (inherited)**: 50K students Y2
**Scale/Scope (new)**: Same 50K student ceiling, with anti-cheat scan running per-student per-week (~7K scans/day average), ATS sync running on saved-search match (≤ 1K POSTs/day), mock interviews capped at 4/week/student (worst case 200K LLM turns/week)

## Constitution Check

The project constitution (`.specify/memory/constitution.md`) remains the unmodified template — no custom principles ratified. This plan respects the *implicit* principles followed by 001-003:
- **Additive-only schema** (no destructive migrations)
- **Privacy-first** (opt-out students never enumerable; anti-cheat appeals fully audited; API keys scoped)
- **Cost-aware** (LLM caps, ATS retry budgets, hackathon sandbox limits all explicit at the spec layer)
- **Observability** (every external dispatch — ATS, webhooks, mock-interview, anticheat — logs to an audit table)

**No violation blocks Phase 0 / Phase 1 of this plan.** Recommended: run `/speckit-constitution` before code, but not blocking.

## Project Structure

### Documentation (this feature)

```text
specs/004-eleven-of-ten/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 new decisions
├── data-model.md        # Phase 1 output — 17 new entities
├── quickstart.md        # Phase 1 output — env vars, migrations 034-037, new functions
├── contracts/
│   └── api.md           # Phase 1 output — internal + public API surfaces
├── checklists/
│   └── requirements.md  # From spec phase (placeholder)
└── tasks.md             # Phase 2 output — atomic, dependency-ordered
```

### Source Code (repository root)

Inherits 001 layout unchanged. New files:

```text
supabase/
├── migrations/
│   ├── 034_anticheat.sql              # signals, appeals, audit + GitHub/DSA delta columns
│   ├── 035_ats_sso_faculty.sql        # ats_connections, ats_saved_searches, ats_sync_log,
│   │                                  # sso_connections, faculty_grades, assignments
│   ├── 036_hackathon_mockinterview.sql # hackathons, hackathon_submissions, mock_interviews
│   └── 037_api_outcome_nbs.sql        # api_keys, webhook_subscriptions, webhook_deliveries,
│                                      # outcome_contracts, outcome_billing_events, next_best_skills,
│                                      # i18n_missing_keys
└── functions/
    ├── github-anticheat/      # fork-no-commit, commit-cluster, AI-fingerprint
    ├── dsa-anticheat/         # impossible-velocity, rating-delta-anomaly
    ├── ats-sync-greenhouse/   # POST candidates to Greenhouse
    ├── ats-sync-lever/        # POST candidates to Lever
    ├── mock-interview-llm/    # stream LLM turns, score rubric
    ├── hackathon-grader/      # sandboxed code execution + scoring
    ├── next-best-skill/       # alumni-similarity recommender
    └── webhook-dispatcher/    # signed POST to subscriber URLs

apps/web/src/
├── app/
│   ├── api/
│   │   ├── v1/                            # PUBLIC API (versioned)
│   │   │   ├── public/
│   │   │   │   ├── profiles/[slug]/route.ts
│   │   │   │   └── credentials/[id]/route.ts
│   │   │   ├── webhooks/
│   │   │   │   └── subscriptions/route.ts
│   │   │   └── _middleware.ts            # API key + rate limit
│   │   ├── anticheat/
│   │   │   ├── appeal/route.ts
│   │   │   └── decide/route.ts
│   │   ├── ats/
│   │   │   ├── connect/route.ts
│   │   │   ├── disconnect/route.ts
│   │   │   └── saved-search/route.ts
│   │   ├── sso/
│   │   │   ├── workos/login/route.ts
│   │   │   └── workos/callback/route.ts
│   │   ├── faculty/
│   │   │   ├── grade/route.ts
│   │   │   └── verify/route.ts
│   │   ├── hackathons/
│   │   │   ├── route.ts                  # POST create
│   │   │   └── [id]/submissions/route.ts # POST submit
│   │   ├── mock-interview/
│   │   │   ├── start/route.ts
│   │   │   ├── turn/route.ts             # streams LLM turn
│   │   │   └── complete/route.ts
│   │   ├── api-keys/
│   │   │   ├── route.ts                  # CRUD
│   │   │   └── [id]/rotate/route.ts
│   │   └── outcome-billing/
│   │       └── events/route.ts
│   ├── (student)/
│   │   └── dashboard/
│   │       └── skills/
│   │           ├── anticheat-banner.tsx       # NEW
│   │           └── next-best-skill.tsx        # NEW
│   ├── (college)/
│   │   └── faculty/
│   │       ├── grade/page.tsx                  # NEW
│   │       └── outliers/page.tsx               # NEW (anti-inflation monitor)
│   ├── (company)/
│   │   ├── ats/
│   │   │   └── page.tsx                        # NEW — Greenhouse/Lever config
│   │   ├── hackathons/
│   │   │   └── page.tsx                        # NEW
│   │   └── developers/
│   │       └── api-keys/page.tsx               # NEW — API key + webhook UI
│   ├── practice/
│   │   ├── mock-interview/page.tsx             # NEW
│   │   └── history/page.tsx                    # NEW
│   ├── manifest.ts                              # NEW — PWA manifest
│   └── offline/page.tsx                         # NEW — offline fallback
├── lib/
│   ├── anticheat/
│   │   ├── github-signals.ts                   # NEW
│   │   ├── dsa-signals.ts                      # NEW
│   │   └── score-aggregator.ts                 # NEW (extends 002 placement scorer)
│   ├── ats/
│   │   ├── greenhouse-client.ts                # NEW
│   │   ├── lever-client.ts                     # NEW
│   │   └── saved-search-evaluator.ts           # NEW
│   ├── algorithms/
│   │   ├── next-best-skill.ts                  # NEW
│   │   └── hackathon-scorer.ts                 # NEW
│   ├── api/
│   │   ├── apikey.ts                           # NEW — verify + scope check
│   │   ├── rate-limit.ts                       # NEW
│   │   └── webhook-sign.ts                     # NEW (HMAC-SHA256)
│   └── sso/
│       └── workos.ts                            # NEW
├── messages/                                    # next-intl catalogs
│   ├── en.json                                  # extend
│   ├── hi.json                                  # NEW
│   ├── ta.json                                  # NEW
│   ├── te.json                                  # NEW
│   └── mr.json                                  # NEW
└── sw/
    └── service-worker.ts                        # NEW

apps/web/public/
├── manifest.json                                # NEW (linked from app/manifest.ts)
└── icons/                                       # NEW (PWA icons)

packages/
├── types/
│   ├── anticheat.ts                             # NEW
│   ├── ats.ts                                   # NEW
│   ├── hackathon.ts                             # NEW
│   ├── mock-interview.ts                        # NEW
│   ├── public-api.ts                            # NEW
│   └── i18n.ts                                  # NEW (locale union)
└── utils/
    ├── locale.ts                                # NEW (locale validation)
    └── sandbox.ts                               # NEW (hackathon exec helper)

tests/
├── e2e/
│   ├── anticheat-fork-no-commits.spec.ts        # NEW
│   ├── ats-greenhouse-sync.spec.ts              # NEW
│   ├── i18n-hindi-nudge.spec.ts                 # NEW
│   ├── sso-workos-callback.spec.ts              # NEW
│   ├── faculty-grade-flow.spec.ts               # NEW
│   ├── hackathon-submit-and-grade.spec.ts       # NEW
│   ├── mock-interview-rubric.spec.ts            # NEW
│   ├── public-api-rate-limit.spec.ts            # NEW
│   ├── pwa-offline.spec.ts                      # NEW
│   └── outcome-billing.spec.ts                  # NEW
└── integration/
    ├── anticheat-scoring.test.ts                # NEW
    ├── greenhouse-client.test.ts                # NEW
    ├── next-best-skill.test.ts                  # NEW
    └── webhook-signing.test.ts                  # NEW
```

**Structure Decision**: Pure additive. No new top-level packages, no monorepo split, no new build pipelines. Every new capability is one or more of: a Supabase Edge Function (executed by existing schedulers or HTTP triggers), a Next.js API route (auth-gated by existing Supabase RLS), a UI page rendered inside the existing 3-portal app, or a Postgres table sitting in additive migrations 034-037.

## Complexity Tracking

No constitution violations to justify. The biggest single net-new risk is **LLM-cost runaway** in mock interviews — mitigated with hard per-student and per-tenant caps (FR-MI-005) enforced at the edge-function gate, with token-usage telemetry recorded for every turn.

Three explicit deferrals (RN app, ClickHouse, native group video) are documented in spec.md "Out of Scope" with the rationale.

## Re-Evaluation of Constitution Check (post-design)

Still no violations. Plan respects:
- **Additive-only schema** (4 new migrations, no DROP/ALTER on existing critical columns)
- **Privacy-first** (anti-cheat appeals fully audited; API keys scoped + revocable; SSO failures fail-closed; outcome-billing dispute window enforced)
- **Cost-aware** (LLM caps, ATS retry budgets, hackathon sandbox limits, public API rate limits — all explicit)
- **Observability** (every external dispatch logged to an audit table; missing-i18n-key telemetry; faculty-grading distribution monitoring)
- **Backward compatibility** (existing 001-003 functionality unchanged; new features are opt-in via flags or per-tenant configuration)
