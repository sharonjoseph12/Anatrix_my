# Implementation Plan: Antarix Verified Skill Proof Ecosystem

**Branch**: `001-antarix-complete-workflow` | **Date**: 2026-06-04 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/001-antarix-complete-workflow/spec.md)
**Input**: Feature specification from `specs/001-antarix-complete-workflow/spec.md`

## Summary

Antarix is a verified skill proof system connecting students, colleges, and companies through an education-to-work pipeline. Students track their learning activity via a Chrome extension and GitHub/Calendar integrations, receive AI-generated behavioral insights, and build verified skill profiles. Colleges use placement dashboards to manage student readiness and match with companies. Companies search verified candidate profiles and hire based on data, not resumes.

**Technical approach**: Turborepo monorepo with Next.js 15 (multi-portal via subdomain routing), Supabase (auth, PostgreSQL, edge functions, realtime), Chrome Extension (MV3), and Tailwind CSS + shadcn/ui for premium UI.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+
**Primary Dependencies**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, Chrome Extension MV3 APIs
**Storage**: PostgreSQL (via Supabase) — 17 tables, Row Level Security
**Testing**: Vitest (unit), Playwright (e2e), Supabase CLI (local integration)
**Target Platform**: Web (responsive), Chrome Extension
**Project Type**: Web service (multi-portal SaaS) + Browser extension
**Performance Goals**: Dashboard loads <2s, candidate search <5s across 10K+ profiles
**Constraints**: Chrome-only extension for v1, India-market pricing, student data opt-in for company visibility
**Scale/Scope**: 5K students (Y1), 50 colleges, 30 companies, ~50 screens across 3 portals

## Constitution Check

*GATE: Constitution is default template — no custom principles defined yet.*

No violations. Constitution should be configured before implementation begins (recommended: run `/speckit-constitution`).

## Project Structure

### Documentation (this feature)

```text
specs/001-antarix-complete-workflow/
├── plan.md              # This file
├── research.md          # Phase 0 output — tech decisions
├── data-model.md        # Phase 1 output — 17 entities
├── quickstart.md        # Phase 1 output — setup guide
├── contracts/
│   └── api.md           # Phase 1 output — all API endpoints
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
apps/
├── web/                    # Next.js 15 (App Router) — 3 portals
│   └── src/
│       ├── app/
│       │   ├── (student)/  # Student portal (antarix.app)
│       │   ├── (college)/  # College portal (college.antarix.app)
│       │   ├── (company)/  # Company portal (recruiting.antarix.app)
│       │   └── (auth)/     # Shared auth flows
│       ├── components/     # UI components (shadcn/ui + custom)
│       ├── lib/            # Supabase clients, algorithms, utils
│       └── types/
│
└── extension/              # Chrome Extension (MV3)
    └── src/
        ├── popup/          # Extension UI
        ├── background/     # Service worker, tracking, sync
        └── storage/        # Local session store

packages/
├── types/                  # Shared TypeScript types
└── utils/                  # Shared utilities

supabase/
├── migrations/             # 11 migration files (schema)
├── functions/              # Edge Functions (sync, insights, profiles)
└── seed.sql                # Skills catalog + test data

tests/
├── e2e/                    # Playwright (onboarding, dashboards, search)
└── integration/            # Insight algorithms, skill scoring
```

**Structure Decision**: Web application monorepo (Option 2 variant). Single Next.js app with route groups for 3 portals (shared components, separate layouts). Chrome extension as separate app in monorepo. Supabase handles entire backend (no custom Express server).

## Complexity Tracking

No constitution violations to justify.
