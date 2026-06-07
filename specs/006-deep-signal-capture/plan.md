# Implementation Plan: 006 — Deep Signal Capture

**Branch**: `006-deep-signal-capture` | **Date**: 2026-06-06 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/006-deep-signal-capture/spec.md)
**Input**: Feature specification from `specs/006-deep-signal-capture/spec.md`
**Builds on**: 001 (foundation) + 002 (verified skill platform) + 003 (engage & showcase) + 004 (defensible moat) + 005 (Expo mobile)

## Summary

Two opt-in, privacy-respecting signal channels (IDE telemetry and biometric integrations) plus the foundational Privacy Center and audit log that gates them. The score contribution is bounded (3% IDE, 2% biometrics, 5% combined) and the audit trail is append-only.

**Technical approach**: Reuse the entire 001-005 stack — Turborepo + pnpm, Next.js 15 multi-portal, Supabase (Postgres + Edge Functions + RLS), the existing `apps/extension` Chrome MV3 host rebuilt as a VS Code extension with a Cursor fork, the 005 Expo mobile app, and the existing `feature_flags` table. Add 1 SQL migration (039), 6 new tables, 2 new Supabase Edge Functions (`biometric-correlator`, `signal-purge`), 1 VS Code + 1 Cursor extension published from a single source tree, 1 privacy-center UI page + 4 API routes, 1 audit endpoint, 2 mobile modules (HealthKit, Google Fit) inside `apps/mobile/src/lib/biometrics/`, and 1 DPDP-aligned deletion flow that reuses `privacy-request-deletion` from 001.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+ *(inherited)*; VS Code Extension API 1.85+; Expo SDK 51+ *(inherited from 005)*
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, next-intl, vitest, playwright
**Primary Dependencies (new)**: `vscode` (extension API types only, devDep), `@vscode/vsce` (packaging), `web-tree-sitter` (AST parsing in Web Worker), `tree-sitter-python`, `tree-sitter-typescript`, `tree-sitter-javascript`, `tree-sitter-go`, `axios` for Oura/Whoop REST, `expo-health-connect` and `expo-healthkit` for mobile bridges, `pgcrypto` (already present), `pgsodium` (already present)
**Storage**: PostgreSQL (via Supabase) — 1 new additive migration (039), 6 new tables, no destructive changes; no extended tables
**Testing**: Vitest (unit) + Playwright (e2e) + extension host integration tests via `@vscode/test-electron`; mobile via `expo-test-runner` for the biometric module *(inherited + extension-specific additions)*
**Target Platform**: Web (Next.js), VS Code Marketplace + Cursor Marketplace, Expo iOS/Android (inherited from 005), Supabase Edge Functions (Deno)
**Project Type**: Web service (multi-portal SaaS) + Edge Functions + IDE extensions (TypeScript → JavaScript) + Expo mobile modules *(inherited + IDE-extension add)*
**Performance Goals (inherited)**: Dashboard < 2s, API p95 ≤ 1s
**Performance Goals (new)**: IDE aggregate upload p95 ≤ 3s; biometric correlation job p95 ≤ 30s per active user; privacy-center page load p95 ≤ 1.5s; AST-diff in Web Worker p95 ≤ 200ms per file
**Constraints (inherited)**: India market, opt-in privacy, RLS-enforced, feature-flagged
**Constraints (new)**: AST-diff runs only in Web Worker; server never receives parsed ASTs; OAuth refresh tokens for Oura/Whoop encrypted at rest with pgsodium; biometric OAuth scopes are read-only and enumerated; no raw biometric data leaves the device; IDE aggregate payload ≤ 2 KB per session; audit log rows are append-only (no UPDATE/DELETE on the table — enforced by REVOKE)
**Scale/Scope (inherited)**: 50K students Y2
**Scale/Scope (new)**: Up to 50K IDE devices × 30 sessions/day × 1 row = 1.5M `ide_sessions` rows/day peak; 30-day TTL → 45M rows active window; biometric correlation runs nightly across all active students → 50K rows; `signal_audit` is one row per signal event, ~10× the aggregate count → 15M rows/day; monthly retention rollup compresses to 500K summary rows/month

## Constitution Check

The project constitution (`.specify/memory/constitution.md`) remains the unmodified template — no custom principles ratified. This plan respects the *implicit* principles followed by 001-005:
- **Additive-only schema** (1 new migration, 6 new tables, no DROP/ALTER on existing critical columns)
- **Privacy-first** (opt-in with granular per-provider toggles; one-click delete; DPDP data-principal-rights endpoint; audit log of every byte)
- **Cost-aware** (nightly batch correlation, capped contribution to score, exponential backoff on all OAuth)
- **Observability** (every signal upload writes a `signal_audit` row; the audit log itself is monitored for integrity via a nightly check on `SC-PRI-001`)
- **Capped score contribution** (3% IDE + 2% biometric = 5% combined ceiling, server-enforced)

**No violation blocks Phase 0 / Phase 1 of this plan.** Recommended: run `/speckit-constitution` before code, but not blocking.

## Project Structure

### Documentation (this feature)

```text
specs/006-deep-signal-capture/
├── plan.md              # This file
├── research.md          # Phase 0 output — 6 new decisions
├── data-model.md        # Phase 1 output — 6 new entities
├── quickstart.md        # Phase 1 output — env vars, migration 039, new functions
├── contracts/
│   └── api.md           # Phase 1 output — internal + audit API surfaces
├── checklists/
│   └── requirements.md  # From spec phase
└── tasks.md             # Phase 2 output — atomic, dependency-ordered
```

### Source Code (repository root)

Inherits 001-005 layout unchanged. New files:

```text
supabase/
├── migrations/
│   └── 039_deep_signal_capture.sql     # ide_sessions, ide_aggregates,
│                                       # biometric_connections, biometric_aggregates,
│                                       # peak_window_inferences, signal_audit
└── functions/
    ├── biometric-correlator/           # nightly job: merge 002 + IDE + biometric → peak_window_inferences
    └── signal-purge/                   # nightly TTL rollup + 30-day DPDP purge queue drain

apps/extension-ide/                     # NEW WORKSPACE — extends the existing apps/extension with VS Code & Cursor support
├── src/
│   ├── ide/                            # NEW — VS Code extension surface
│   │   ├── extension.ts                # activate/deactivate
│   │   ├── aggregator.ts               # per-session aggregator
│   │   ├── ast-diff.ts                 # Web Worker AST diff
│   │   ├── keystroke-entropy.ts        # Shannon entropy over key codes (no content)
│   │   ├── debug-tracker.ts            # debug session duration + step ratio
│   │   ├── time-in-file.ts             # per-file active-time counter
│   │   ├── test-run-detector.ts        # test-runner output listener
│   │   ├── error-resolution.ts         # diagnostic → cleared latency
│   │   ├── uploader.ts                 # batched POST to /api/ide-telemetry/session
│   │   ├── privacy-banner.ts           # in-IDE privacy notice + revoke command
│   │   └── types.ts
│   ├── cursor/                         # NEW — Cursor fork (shared source, different manifest)
│   │   └── manifest.json               # publisher: antarix-cursor, displayName: Antarix (Cursor)
│   ├── background/                     # EXISTING — reused for telemetry buffer
│   ├── lib/                            # EXISTING — storage helpers
│   └── popup/                          # EXISTING — now also shows "IDE: on/off" status
├── package.json                        # NEW — `vscode:prepublish` script
├── manifest.json                       # NEW — VS Code extension manifest (publisher: antarix)
├── tsconfig.json                       # NEW — extends base, lib: ["ES2022"]
├── .vscodeignore                       # NEW
└── README.md                           # NEW — install + privacy contract

apps/web/src/
├── app/
│   ├── (student)/
│   │   └── settings/
│   │       └── signals/                          # NEW — privacy center page
│   │           ├── page.tsx
│   │           ├── source-card.tsx
│   │           ├── what-we-learned.tsx
│   │           ├── delete-all-button.tsx
│   │           └── partial-capture-banner.tsx
│   └── api/
│       ├── ide-telemetry/                         # NEW
│       │   └── session/route.ts                   # POST aggregate
│       ├── biometrics/                            # NEW
│       │   ├── connections/route.ts               # GET list, DELETE all
│       │   ├── connect/[provider]/route.ts        # POST OAuth start/callback
│       │   ├── disconnect/[provider]/route.ts     # POST disconnect
│       │   └── mobile-sync/route.ts               # POST from 005 Expo bridge
│       ├── settings/
│       │   └── signals/                           # NEW
│       │       ├── route.ts                       # GET snapshot
│       │       └── [source]/route.ts              # DELETE one source
│       └── admin/                                 # NEW
│           └── audit/[student_id]/route.ts        # GET paginated audit dump
├── lib/
│   ├── signals/                                   # NEW
│   │   ├── types.ts                               # provider union, source state
│   │   ├── hash.ts                                # SHA-256 of aggregate payload
│   │   ├── plain-language.ts                      # "what we learned" template
│   │   └── score-cap.ts                           # 3% + 2% enforcement helper
│   ├── biometrics/                                # NEW
│   │   ├── oura-client.ts                         # REST client (OAuth2)
│   │   ├── whoop-client.ts                        # REST client (OAuth2)
│   │   ├── google-fit-client.ts                   # server-side webhook for Fit
│   │   ├── aggregator.ts                          # 90-day TTL rollup
│   │   └── correlator.ts                          # merge 002 + IDE + biometric
│   └── audit/                                     # NEW
│       ├── log.ts                                 # writeSignalAudit()
│       └── dpdp-erasure.ts                        # reuses privacy-request-deletion
└── messages/                                       # next-intl catalogs — extend en/hi/ta/te/mr with privacy-center keys

apps/mobile/src/lib/biometrics/                    # NEW — depends on 005 shipping first
├── healthkit/                                     # iOS HealthKit bridge
│   ├── index.ts                                   # requestScopes, readDaily, postToServer
│   ├── permissions.ts                             # 4 scopes enumerated
│   └── types.ts
├── google-fit/                                    # Android Google Fit bridge
│   ├── index.ts
│   ├── permissions.ts
│   └── types.ts
├── shared/                                        # shared between both
│   ├── post-to-server.ts
│   └── device-info.ts
└── README.md                                      # documents 005 dependency

packages/
├── types/
│   ├── ide-telemetry.ts                           # NEW
│   ├── biometrics.ts                              # NEW
│   ├── signals.ts                                 # NEW
│   └── audit.ts                                   # NEW
└── utils/
    ├── hash.ts                                    # NEW — SHA-256 wrapper
    └── plain-language.ts                          # NEW — re-export

tests/
├── e2e/
│   ├── ide-extension-aggregate.spec.ts            # NEW
│   ├── cursor-fork-install.spec.ts                # NEW
│   ├── biometric-oura-connect.spec.ts             # NEW
│   ├── biometric-whoop-connect.spec.ts            # NEW
│   ├── biometric-healthkit-mobile.spec.ts         # NEW
│   ├── privacy-center-disable-source.spec.ts      # NEW
│   ├── privacy-center-delete-all.spec.ts          # NEW
│   ├── audit-log-integrity.spec.ts                # NEW
│   └── dpdp-erasure-request.spec.ts               # NEW
└── integration/
    ├── ide-aggregator.test.ts                     # NEW
    ├── ast-diff.test.ts                           # NEW
    ├── biometric-correlator.test.ts               # NEW
    ├── score-cap.test.ts                          # NEW
    └── signal-audit-writer.test.ts                # NEW
```

**Structure Decision**: Pure additive. No new top-level packages, no monorepo split, no new build pipelines. The new IDE extension lives in a new `apps/extension-ide/` workspace parallel to the existing `apps/extension` (Chrome MV3) and `apps/mobile` (Expo) — Turborepo treats them as siblings. The Cursor fork is a duplicate of the VS Code source tree with a different `manifest.json` and is built by the same CI matrix step with a `TARGET=cursor` env var.

## Complexity Tracking

No constitution violations to justify. The biggest single net-new risk is **biometric OAuth refresh-token leakage** — mitigated by pgsodium encryption at rest, 24h backoff-then-expire on refresh failure, and an explicit "expired" state that the privacy center surfaces (never silent). The second is **AST-parser bundle size in the extension** — mitigated by using `web-tree-sitter` (WASM, lazy-loaded only when a project contains a supported language) and capping AST-diff files at 2 MB.

One explicit deferral (CGM, OS-level screen-time, keystroke-rhythm auth) is documented in spec.md "Out of Scope" with the rationale.

## Re-Evaluation of Constitution Check (post-design)

Still no violations. Plan respects:
- **Additive-only schema** (1 new migration, no DROP/ALTER on existing critical columns)
- **Privacy-first** (opt-in, granular toggles, DPDP data-principal-rights endpoint, one-click delete, audit log of every byte including metadata-only)
- **Cost-aware** (nightly batch correlation, capped contribution to score, exponential backoff on all OAuth, AST parser lazy-loaded)
- **Observability** (every signal upload writes an audit row; the audit log integrity is itself monitored nightly)
- **Backward compatibility** (existing 001-005 functionality unchanged; new features are opt-in via flags; biometric mobile path gated behind 005 shipping)
- **Score integrity** (3% + 2% = 5% ceiling is server-enforced, client cannot game the cap)
