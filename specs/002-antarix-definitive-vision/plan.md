# Implementation Plan: Antarix 11/10 — Verified Skill Intelligence Platform

**Branch**: `002-antarix-definitive-vision` | **Date**: 2026-06-04 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/002-antarix-definitive-vision/spec.md)
**Input**: Feature specification from `specs/002-antarix-definitive-vision/spec.md`
**Builds on**: `specs/001-antarix-complete-workflow/` (foundation spec/plan/data-model/research/contracts/quickstart)

## Summary

This plan implements the 11/10 Antarix vision on top of the 001 foundation: zero-effort Day-1 onboarding (kills the 7-day cold start), an AI Coach that pushes daily and real-time nudges via WhatsApp with push fallback, an optional Power Mode Chrome Extension that upgrades (never gates) the experience, verified Skill Proof Scores, ML-style placement predictions, exportable verifiable credentials with public resolution, live college leaderboards with curriculum intelligence, and a one-click-apply recruiting flow with calendar-aware interview scheduling — all under a privacy-first contract where opted-out students are never enumerable in any aggregate.

**Technical approach**: Inherit the 001 stack (Turborepo + pnpm, Next.js 15 multi-portal, Supabase, Chrome Extension MV3, Tailwind v4 + shadcn/ui, Vitest + Playwright). Add a WhatsApp Business API integration (Meta Cloud API preferred, Twilio fallback) as a new channel, a trigger→template→render→dispatch pipeline for the AI Coach, a rule-augmented placement-prediction scorer, a signed-URL public credential verification page, and seven new database tables (whatsapp_connections, nudge_preferences, nudges, nudge_responses, placement_predictions, verifiable_credentials + credential_distributions, student_applications + interview_slots, extension_telemetry, privacy_requests, exam_windows) on top of the 001 schema with additive column deltas only.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+ *(inherited from 001)*
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, Chrome Extension MV3 APIs
**Primary Dependencies (new)**: Meta WhatsApp Cloud API client, Twilio WhatsApp SDK (fallback), template-rendering library (Handlebars or similar), HMAC signing for public credential slugs
**Storage**: PostgreSQL (via Supabase) — 17 baseline tables from 001 + 11 new tables from 002 + additive column deltas
**Testing**: Vitest (unit), Playwright (e2e), Supabase CLI (local integration) *(inherited from 001)* + new e2e suites for Day-1 onboarding, AI Coach, credential, and privacy
**Target Platform**: Web (responsive), Chrome Extension, WhatsApp (Meta Cloud API or Twilio)
**Project Type**: Web service (multi-portal SaaS) + Browser extension + WhatsApp bot *(inherited SaaS + extension, new WhatsApp channel)*
**Performance Goals (inherited)**: Dashboard loads <2s, candidate search <5s across 10K+ profiles
**Performance Goals (new)**: WhatsApp nudge delivery p95 ≤ 60s; public credential page p95 ≤ 3s; Day-1 dashboard populated ≤ 60s from GitHub OAuth completion
**Constraints (inherited)**: Chrome-only extension for v1, India-market pricing, student data opt-in for company visibility
**Constraints (new)**: WhatsApp message-template approval by Meta is a hard prerequisite for production; quiet hours + exam-week suppression MUST be honored at the dispatch layer; opted-out students MUST NOT be enumerable in any aggregate or search-result count
**Scale/Scope (inherited)**: 5K students (Y1), 50 colleges, 30 companies, ~50 screens across 3 portals
**Scale/Scope (new)**: 50K active students in Y2; 1.8M passive data points collected in Y1 as the data-moat foundation; per-student message volume is the WhatsApp cost driver and is treated as an operational, not architectural, concern

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is the default template — no custom principles have been ratified yet. As with the 001 plan, this is a non-blocking observation: no violations, and the recommended next step is to run `/speckit-constitution` to ratify principles (test-first, library-first, observability, simplicity) before implementation begins. **No violation blocks Phase 0 / Phase 1 of this plan.**

## Project Structure

### Documentation (this feature)

```text
specs/002-antarix-definitive-vision/
├── plan.md              # This file
├── research.md          # Phase 0 output — 7 new decisions (WhatsApp, AI Coach pipeline, credential, prediction, privacy, scheduling, timezones)
├── data-model.md        # Phase 1 output — 11 new entities + schema deltas to 001 baseline
├── quickstart.md        # Phase 1 output — new env vars, migrations 012-018, new Edge Functions
├── contracts/
│   └── api.md           # Phase 1 output — new endpoints (whatsapp, nudges, prediction, credential, applications, privacy, extension, scheduling)
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

Inherits the 001 monorepo layout unchanged. Additions are scoped inside the existing `apps/`, `supabase/functions/`, and `supabase/migrations/` trees:

```text
apps/
├── web/                    # Next.js 15 (App Router) — 3 portals
│   └── src/
│       ├── app/
│       │   ├── (student)/  # Updated: dashboard Day-1, new: ai-coach, credential, settings/{sources,notifications,privacy}, applications
│       │   ├── (college)/  # Inherited; ready for leaderboards + curriculum intelligence
│       │   ├── (company)/  # Inherited; ready for verified search + one-click invite
│       │   └── (auth)/     # Inherited
│       ├── components/     # Inherited + nudge inbox, credential card
│       ├── lib/
│       │   ├── algorithms/ # Inherited + placement-prediction.ts, peak-window.ts (refined), credential-snapshot.ts
│       │   └── supabase/   # Inherited
│       └── types/
│
└── extension/              # Chrome Extension (MV3)
    └── src/
        ├── popup/          # Inherited
        ├── background/     # Inherited + heartbeat.ts
        └── storage/        # Inherited

packages/
├── types/                  # Shared TypeScript types (new: nudge, credential, prediction)
└── utils/                  # Shared utilities (+ time-zone helpers, exam-week detection)

supabase/
├── migrations/             # 001's 11 + new 012-018 (7 new tables + deltas)
├── functions/              # 001's functions + new: whatsapp-send, whatsapp-webhook, nudge-trigger, placement-predict, credential-issue, credential-public, exam-week-detect, account-deletion-purge
└── seed.sql                # Inherited + new test seeds for Day-1 flow

tests/
├── e2e/                    # Inherited + new: day1-onboarding, ai-coach-whatsapp, credential-public-page, privacy-opt-out
└── integration/            # Inherited + new: placement-prediction, exam-week-suppression, credential-threshold
```

**Structure Decision**: Pure additive — no new top-level packages, no monorepo split, no new build pipelines. The WhatsApp channel is a Supabase Edge Function consumed by the existing Next.js app; the Chrome Extension gains a `heartbeat.ts` background script; the new database tables live in additive migrations `012–018`. This keeps the 001 build, lint, test, and dev workflows intact.

## Complexity Tracking

No constitution violations to justify. The plan deliberately stays additive to keep the 001 build pipeline, RLS model, and three-portal architecture intact. The only material new architectural surface is the WhatsApp channel (one provider abstraction, one webhook receiver, one dispatch path) — every other 002 capability (placement prediction, credential, exam-week suppression) is implemented as a documented PostgreSQL function or a small Edge Function over the existing schema.

## Re-Evaluation of Constitution Check (post-design)

Still no violations. The plan respects:
- **Privacy-first** via aggregate-correctness from the start (cohort counts reflect opted-in students only; recruiter search counts reflect only company-search-visible students).
- **Backward compatibility** by additive schema changes only — no 001 table is renamed, dropped, or has columns removed.
- **Test-first** by specifying new e2e and integration test files alongside each new capability.
- **Build-pipeline simplicity** by avoiding new top-level apps/packages.

## Stop and Report

- **Branch**: `002-antarix-definitive-vision`
- **Plan path**: `specs/002-antarix-definitive-vision/plan.md`
- **Generated artifacts**:
  - `specs/002-antarix-definitive-vision/research.md` — 7 new decisions (A through G)
  - `specs/002-antarix-definitive-vision/data-model.md` — 11 new entities + schema deltas
  - `specs/002-antarix-definitive-vision/quickstart.md` — new env vars, migrations 012-018, new Edge Functions
  - `specs/002-antarix-definitive-vision/contracts/api.md` — new endpoint contracts
- **Open follow-up (recommended, not blocking)**: Run `/speckit-constitution` to ratify project principles before implementation begins.
- **Next command**: `/speckit-tasks` to generate the dependency-ordered task list for this plan.
