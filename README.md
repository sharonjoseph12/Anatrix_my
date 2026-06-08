<<<<<<< HEAD
# Antarix — Verified Skill Proof Ecosystem → 12/10
=======
# Antarix — Verified Skill Proof Ecosystem
>>>>>>> 002-antarix-definitive-vision

> Track. Prove. Hire. The verified skill proof ecosystem connecting students, colleges, and companies.

## Overview

Antarix is a multi-portal SaaS platform that creates a verified skill proof pipeline from learning to employment:

- **Students** track learning activity via Chrome extension + GitHub/Calendar sync
- **Colleges** manage placement readiness and match students with companies
- **Companies** search verified candidate profiles and hire based on data, not resumes

<<<<<<< HEAD
## 12/10 Vision (6 active features)

| # | Feature | Priority | Status | Migration |
|---|---|---|---|---|
| 004 | [Defensible Moat](specs/004-eleven-of-ten/) — anti-cheat, ATS sync, i18n, SSO, faculty, hackathons, mock interviews, public API, PWA, outcome pricing, next-best-skill | P1 | In development | 034-038 |
| 005 | [Mobile + Auto-Apply + Global Leaderboard](specs/005-mobile-autoapply-leaderboard/) — Expo RN app, LLM cover-letter drafter, Playwright headless form-filler, cross-college leaderboard | P1 | Spec ratified | 051-052 |
| 006 | [Deep Signal Capture](specs/006-deep-signal-capture/) — VS Code + Cursor IDE telemetry (aggregate-only), biometric integrations (Oura, Whoop, HealthKit, Google Fit), privacy center + audit | P2 | Spec ratified | 043-044 |
| 007 | [Adaptive Learning Graph](specs/007-adaptive-learning-graph/) — Alumni mentorship via pgvector trajectory embeddings, daily LLM-generated micro-curriculum, curriculum-mentor closed loop | P1 | Spec ratified | 045-046 |
| 008 | [Collaborative Mode](specs/008-collaborative-mode/) — Live multiplayer coding (Y.js + Liveblocks + LiveKit + WebContainer), teamwork scoring, anti-collusion, recruiter observe | P2 | Spec ratified | 047-048 |
| 009 | [On-Chain Mirror](specs/009-onchain-mirror/) — EAS-on-Base-L2 hash-only mirror of W3C VCs, behind kill-switch flag default OFF, DPDP-safe revocation | P3 | Spec ratified | 049-050 |

See [`specs/_roadmap/cross-feature-rollout.md`](specs/_roadmap/cross-feature-rollout.md) for the sprint plan, dependency graph, and risk register.

=======
>>>>>>> 002-antarix-definitive-vision
## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
<<<<<<< HEAD
- **Mobile**: React Native + Expo SDK 51 (w/ Expo Router + EAS Build)
- **Backend**: Supabase (Auth + PostgreSQL + pgvector + Edge Functions + Realtime)
- **Extension**: Chrome MV3 + Vite
- **Collaboration**: Y.js CRDT + Liveblocks + LiveKit (WebRTC)
- **Automation**: Playwright (headless form-filler, test suite)
- **On-Chain**: EAS (Ethereum Attestation Service) on Base L2
=======
- **Backend**: Supabase (Auth + PostgreSQL + Edge Functions + Realtime)
- **Extension**: Chrome MV3 + Vite
>>>>>>> 002-antarix-definitive-vision
- **Testing**: Vitest (unit) + Playwright (e2e)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Supabase (requires Docker)
npx supabase start

# Run web app
pnpm --filter web dev

# Build Chrome extension
pnpm --filter extension dev
```

See [specs/001-antarix-complete-workflow/quickstart.md](specs/001-antarix-complete-workflow/quickstart.md) for full setup guide.

## Project Structure

```
antarix/
├── apps/
<<<<<<< HEAD
│   ├── web/               # Next.js 15 — 3 portals via subdomain routing
│   ├── extension/          # Chrome MV3 extension
│   ├── mobile/             # React Native + Expo (005)
│   ├── auto-apply/         # Playwright headless service (005)
│   └── extension-ide/      # VS Code + Cursor IDE telemetry extension (006)
├── packages/
│   ├── config/             # Shared config (LLM cost caps, etc.)
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Shared utilities
├── supabase/
│   ├── migrations/         # 001-052 sequential additive migrations
│   └── functions/          # Edge functions per feature
├── specs/                  # Feature specifications (001-009 + roadmap)
│   ├── 001-antarix-complete-workflow/
│   ├── 002-antarix-definitive-vision/
│   ├── 003-engage-and-showcase/
│   ├── 004-eleven-of-ten/
│   ├── 005-mobile-autoapply-leaderboard/
│   ├── 006-deep-signal-capture/
│   ├── 007-adaptive-learning-graph/
│   ├── 008-collaborative-mode/
│   ├── 009-onchain-mirror/
│   └── _roadmap/           # Cross-feature rollout Gantt + dependency graph
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Score Contribution Budget

All new signal sources combined are capped at **+25%** upside to the Skill Proof Score.
Anti-cheat (004) is defensive: **-100%** uncapped.

| Signal | Cap | Owned by |
|---|---|---|
| Faculty grading | +10% | 004 |
| Mock-interview rubric | +5% | 004 |
| IDE telemetry | +3% | 006 |
| Biometrics | +2% | 006 |
| Teamwork score | +5% | 008 |
| **Total upside** | **+25%** | |

See [`specs/004-eleven-of-ten/score-budget.md`](specs/004-eleven-of-ten/score-budget.md) for full budget + server-side enforcement rules.

## Deep Signal Capture (006)

Feature 006 adds two passive signal channels to the Skill Proof Score: IDE telemetry (3% cap) from a VS Code / Cursor extension that captures aggregate-only metrics (keystroke entropy, debug session duration, AST refactor distance, test-run frequency, error-resolution latency) and biometric integrations (2% cap) connecting Oura, Whoop, Apple HealthKit, and Google Fit for sleep, HRV, resting heart rate, and daily readiness data. Raw keystrokes and source code never leave the device.

The entire surface is privacy-first by design. Every signal upload writes an append-only `signal_audit` row with a content hash but never the payload. Raw IDE data is retained 30 days, raw biometric data 90 days, then rolled into monthly summaries. Users control every source from a unified privacy center (`/settings/signals`) with per-provider toggles and a one-click "Delete all and disconnect" action. DPDP erasure requests are fulfilled within the 30-day statutory window with a fully auditable trail. The VS Code extension source is in `apps/extension-ide/`; the Cursor fork shares the same code with a different publisher manifest.

## Constitution

The project constitution (`.specify/memory/constitution.md`) governs all spec, plan, and task work. Seven principles:
Additive-Only Schema · Privacy-First (DPDP Act 2023) · Cost-Aware · Test-First on Critical Paths ·
Observability (Append-Only Audit) · Feature-Flagged Rollout · Migration Number Discipline

## Documentation

- [Cross-Feature Roadmap](specs/_roadmap/cross-feature-rollout.md) — sprint plan, dependency graph, feature-flag matrix, risk register
- [Feature Specs (001-009)](specs/) — 9 additive feature specifications
- [API Contracts](specs/004-eleven-of-ten/contracts/api.md) — public + internal API surfaces
- [Data Model](specs/004-eleven-of-ten/data-model.md) — full schema: 70+ tables
- [Quickstart Guide](specs/001-antarix-complete-workflow/quickstart.md) — local dev setup
- [Agent Working Context](AGENTS.md) — for opencode agents
- [006 Rollout Runbook](docs/006-rollout-runbook.md) — deployment runbook for 006
=======
│   ├── web/         # Next.js 15 — 3 portals via subdomain routing
│   └── extension/   # Chrome MV3 extension
├── packages/
│   ├── types/       # Shared TypeScript types
│   └── utils/       # Shared utilities
└── supabase/        # Database migrations + edge functions
```

## Documentation

- [Feature Spec](specs/001-antarix-complete-workflow/spec.md)
- [Implementation Plan](specs/001-antarix-complete-workflow/plan.md)
- [Data Model](specs/001-antarix-complete-workflow/data-model.md)
- [API Contracts](specs/001-antarix-complete-workflow/contracts/api.md)
- [Quickstart Guide](specs/001-antarix-complete-workflow/quickstart.md)
>>>>>>> 002-antarix-definitive-vision

## License

Private — All rights reserved.
