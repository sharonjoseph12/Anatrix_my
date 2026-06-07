# Implementation Plan: 008 — Collaborative Mode

**Branch**: `008-collaborative-mode` | **Date**: 2026-06-07 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/008-collaborative-mode/spec.md)
**Input**: Feature specification from `specs/008-collaborative-mode/spec.md`
**Builds on**: 001 (foundation) + 002 (verified skill platform + W3C VC) + 003 (engage & showcase) + 004 (anti-cheat + ATS + i18n + hackathon + mock-interview + public-API patterns)
**Migration**: `041_collab.sql` (single additive migration for all 8 new tables; see §1 for migration-ledger reconciliation)

## Summary

Four product moves on top of the 001-004 stack: live multiplayer coding (US1, P1), teamwork scoring (US2, P1), anti-collusion + per-student privacy (US3, P2), and recruiter observe mode (US4, P2). P1 ships a defensible "team" credential; P2 closes the gaming + consent loop and unlocks the recruiter interview use case.

**Technical approach**: Reuse the entire 001-004 stack — Turborepo + pnpm, Next.js 15 multi-portal, Supabase (Postgres + Edge Functions + RLS), Vitest + Playwright, the 004 anti-cheat pipeline, the 004 cron + audit patterns, and the 004 public API key/scope model. Add 1 SQL migration (041), 4 new edge functions (`collab-room-create`, `collab-room-end`, `collab-typing-divergence`, `teamwork-scorer`), 2 new Fly.io apps (`sandbox-firecracker-<region>`) for non-JS/Python languages, 2 third-party SDKs (Liveblocks + LiveKit), 1 browser-side runtime (WebContainer from StackBlitz), and ~12 new UI surfaces wired to the new tables. All P1/P2 work ships behind feature flags; default OFF.

## §1. Migration-ledger reconciliation

The brief states migration `041`. The live migration ledger already has `041_webhooks.sql` (from 005, 2026-05-22) and `042_verify_api_key.sql`. This plan uses `041_collab.sql` per brief instruction, with a fallback to `043_collab.sql` if the apply-time conflict surfaces (the 005 webhooks migration is itself additive, so the renumber is safe if applied before any tooling asserts the chronological order). The migration is **idempotent** (`if not exists` + `drop policy if exists` + `create policy`) per the project standard, so re-applying after a renumber is a no-op.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+, Deno 1.45+ (for Supabase Edge Functions) *(inherited)*
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, next-intl, Zod, the 004 `anticheat_signals` table and signal-enum extension pattern
**Primary Dependencies (new)**: `@liveblocks/client`, `@liveblocks/yjs`, `@liveblocks/node` (Liveblocks presence + Y.js relay + server auth), `yjs`, `y-monaco` (Monaco binding), `@monaco-editor/react` (Monaco host), `y-prosemirror` (not used in v1), `@livekit/components-react`, `livekit-client`, `livekit-server-sdk` (LiveKit voice), `@webcontainer/api` (WebContainer browser sandbox), `@fly.io/edge` or `@supabase/supabase-js` direct REST for the Firecracker Fly app, `pino` (structured logging, inherited from 004)
**Storage**: PostgreSQL (via Supabase) — 8 new tables in a single additive migration; 1 column addition to `anticheat_signals` (new `signal` enum value); no destructive changes
**Testing**: Vitest (unit) + Playwright (e2e) + Supabase CLI integration *(inherited)*
**Target Platform**: Web (Chromium-first, FF/Safari with sandbox-degradation), responsive; no native mobile
**Project Type**: Web service (multi-portal SaaS) + Edge Functions + 2 third-party SaaS (Liveblocks, LiveKit) + 1 browser-side runtime (WebContainer) + 1 remote sandbox fleet (Fly.io Firecracker microVMs)
**Performance Goals (inherited)**: Dashboard <2s, search <5s, PublicProfile p95 ≤ 2s
**Performance Goals (new)**: Y.js op replication p95 ≤ 200ms (measured client-side via Performance API); test-run round-trip p95 ≤ 500ms (room end-to-end); room boot p95 ≤ 8s (WebContainer / Firecracker first-byte); observer-token issuance p95 ≤ 500ms; recorder-review page p95 ≤ 2s
**Constraints (inherited)**: India market, opt-in privacy, RLS-enforced, 004 audit-trail pattern, 004 cron pattern, 004 feature-flag pattern
**Constraints (new)**: WebContainer requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (page-level COOP/COEP); WebContainer is Chromium-only — non-Chromium users get a degraded view (read-only editor + remote Firecracker); LiveKit has a per-room audio-publish cap (we set 4 publishers + 4 subscribers); Firecracker microVM CPU/memory caps (1 vCPU, 512MB) inherited from 004 sandbox patterns; recording egress bandwidth from LiveKit is billed per-GB — we cap recordings at 90 days default
**Scale/Scope (inherited)**: 50K students Y2, RLS-enforced, opt-in privacy
**Scale/Scope (new)**: Up to 4 simultaneous participants × N concurrent rooms; per-room Y.js doc size ≤ 5MB (5-minute snapshot cadence caps growth); `collab_events` is a write-heavy append-only table — we use `pg_partman` (inherited from 004) to partition by month; Liveblocks free tier supports 1K MAU, we ship behind a paid-tier flag

## Constitution Check

The project constitution (`.specify/memory/constitution.md`) remains the unmodified template — no custom principles ratified. This plan respects the *implicit* principles followed by 001-004:

- **Additive-only schema** (1 new migration, 1 column-add to `anticheat_signals.signal` enum, no DROP/ALTER on existing critical columns)
- **Privacy-first** (per-room consent, per-student opt-out, PII redaction in observer view, account-deletion cascade, consent-revoke mid-session)
- **Cost-aware** (LiveKit bandwidth cap, Liveblocks MAU tier, Firecracker microVM per-region cap, WebContainer browser-side = zero infra cost for JS/Python, recording retention cap, 5% Skill-Proof-Score cap on teamwork contribution)
- **Observability** (every consent change, every observer join, every anti-collusion signal, every sandbox-escape attempt, every Y.js divergence recovery is logged to `collab_audit` + `collab_events`)
- **Backward compatibility** (existing 001-004 functionality unchanged; new features are opt-in via flags; consent is per-room, not global)
- **Reuse-not-rebuild** (anti-collusion rides on 004's `anticheat_signals`; cron rides on 004's cron registry; API-key + rate-limit rides on 004's pattern; webhook-dispatcher rides on 004's `webhook-dispatcher` edge function; W3C VC issuance on `teamwork_score` events rides on 004's `credential-vc-issue`)

**No violation blocks Phase 0 / Phase 1 of this plan.** Recommended: run `/speckit-constitution` before code, but not blocking.

## Project Structure

### Documentation (this feature)

```text
specs/008-collaborative-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output — 8 architectural decisions
├── data-model.md        # Phase 1 output — 8 new entities, full DDL + RLS + Mermaid ER
├── quickstart.md        # Phase 1 output — env vars, migration 041, sandbox boot script
├── contracts/
│   └── api.md           # Phase 1 output — 7 collab endpoints + Y.js + LiveKit init flows
├── checklists/
│   └── requirements.md  # 12-item quality checklist + open questions
└── tasks.md             # Phase 2 output — ~95 atomic, dependency-ordered tasks
```

### Source Code (repository root)

Inherits 001-004 layout unchanged. New files:

```text
supabase/
├── migrations/
│   └── 041_collab.sql                       # NEW: 8 tables + 1 enum extension
└── functions/
    ├── collab-room-create/                  # NEW: creates room + issues host tokens
    ├── collab-room-end/                     # NEW: ends room, persists artifact, enqueues scorer
    ├── collab-typing-divergence/            # NEW: streams divergence signal while a coach request is in flight
    └── teamwork-scorer/                     # NEW: turns collab_events into teamwork_scores

apps/web/src/
├── app/
│   ├── api/
│   │   ├── collab/
│   │   │   ├── rooms/route.ts                            # NEW: POST create
│   │   │   ├── rooms/[id]/route.ts                       # NEW: GET room meta
│   │   │   ├── rooms/[id]/join/route.ts                  # NEW: POST join
│   │   │   ├── rooms/[id]/end/route.ts                   # NEW: POST end
│   │   │   ├── rooms/[id]/teamwork/route.ts              # NEW: GET score + breakdown
│   │   │   ├── rooms/[id]/consent/route.ts               # NEW: POST/DELETE consent
│   │   │   ├── rooms/[id]/observe/route.ts               # NEW: POST observer token
│   │   │   ├── rooms/[id]/events/route.ts                # NEW: POST event ingestion (server-side relay)
│   │   │   ├── rooms/[id]/snapshots/route.ts             # NEW: POST/GET Y.js snapshot
│   │   │   └── rooms/[id]/transcript/route.ts            # NEW: GET terminal scrollback
│   │   ├── collab/recruiter/
│   │   │   └── reviews/[roomId]/route.ts                 # NEW: GET review-page payload
│   │   └── _middleware.ts                                # extend with 008 scope check
│   ├── (student)/
│   │   └── collab/
│   │       ├── page.tsx                                  # NEW: list + create room
│   │       ├── [id]/page.tsx                             # NEW: room entry (auth + role redirect)
│   │       ├── [id]/editor/page.tsx                      # NEW: student/mentor editor view
│   │       ├── [id]/settings/page.tsx                    # NEW: in-room settings (voice, terminal)
│   │       └── history/page.tsx                          # NEW: past rooms + scores
│   ├── (recruiter)/
│   │   └── observe/
│   │       ├── page.tsx                                  # NEW: consent-gated room list
│   │       ├── [id]/page.tsx                             # NEW: live observer view
│   │       └── [id]/review/page.tsx                      # NEW: recorded review
│   ├── (college)/
│   │   └── mentor/
│   │       └── collab-review/page.tsx                    # NEW: queue of `conflict_unresolved` flags
│   └── settings/
│       └── collab-opt-out/page.tsx                       # NEW: privacy toggle
├── components/
│   └── collab/
│       ├── collab-editor.tsx                             # NEW: Monaco + Y.js + Liveblocks binding
│       ├── collab-terminal.tsx                           # NEW: xterm.js + WebContainer / firecracker WS
│       ├── collab-voice.tsx                              # NEW: LiveKit room
│       ├── collab-presence.tsx                           # NEW: cursors + selection
│       ├── collab-artifact-renderer.tsx                  # NEW: read-only review
│       ├── collab-consent-dialog.tsx                     # NEW: per-room consent grant UI
│       └── collab-opt-out-toggle.tsx                     # NEW: settings privacy toggle
├── lib/
│   ├── collab/
│   │   ├── liveblocks.ts                                 # NEW: client + server auth
│   │   ├── livekit.ts                                    # NEW: token mint
│   │   ├── webcontainer.ts                               # NEW: boot + sandbox manager (browser)
│   │   ├── firecracker-client.ts                         # NEW: remote sandbox WS client
│   │   ├── typing-divergence.ts                          # NEW: cadence divergence signal
│   │   ├── yjs-snapshot.ts                               # NEW: snapshot helpers
│   │   ├── collab-rls-helpers.ts                         # NEW: server-side RLS-coerced queries
│   │   └── consent.ts                                    # NEW: consent grant/revoke
│   ├── algorithms/
│   │   ├── teamwork-scorer.ts                            # NEW: pure scoring fn (4 sub-scores)
│   │   └── collab-typing-divergence.ts                   # NEW: pure signal fn
│   └── anticheat/
│       └── collab-typing-divergence.ts                   # NEW: thin wrapper into 004 anticheat
└── messages/
    ├── en.json                                           # extend: collab.* keys
    ├── hi.json                                           # extend
    ├── ta.json                                           # extend
    ├── te.json                                           # extend
    └── mr.json                                           # extend

apps/web/public/
└── sandbox/                                              # NEW: WebContainer static files (compiled by boot script)

apps/sandbox-firecracker/                                 # NEW: standalone Node + WS service
├── src/
│   ├── server.ts                                         # NEW: Fly.io entry; spawns Firecracker microVM per room
│   ├── vm-pool.ts                                        # NEW: microVM pool (1 per region)
│   └── runtime/                                          # NEW: language-specific runtimes (python, go, rust)
├── Dockerfile                                            # NEW: uses firecracker microVM image
└── fly.toml                                              # NEW: 1 app per region (ap-south-1, ap-southeast-1)

packages/
├── types/
│   ├── collab.ts                                         # NEW: room, participant, event, artifact, score, consent types
│   ├── collab-events.ts                                  # NEW: typed event enum + payload shapes
│   └── anticheat.ts                                      # extend: add 'collab_typing_divergence' to signal union
└── utils/
    ├── cron.ts                                           # extend: add 008 cron jobs
    ├── feature-flags.ts                                  # extend: add 008 flags
    └── collab-opt-out.ts                                 # NEW: opt-out resolver

tests/
├── e2e/
│   ├── collab-room-join-and-edit.spec.ts                 # NEW
│   ├── collab-test-run-roundtrip.spec.ts                 # NEW
│   ├── collab-teamwork-scorer.spec.ts                    # NEW
│   ├── collab-opt-out.spec.ts                            # NEW
│   ├── collab-anti-collusion.spec.ts                     # NEW
│   ├── collab-recruiter-observe-live.spec.ts             # NEW
│   ├── collab-recruiter-review-recorded.spec.ts          # NEW
│   ├── collab-consent-revoke.spec.ts                     # NEW
│   └── collab-webcontainer-egress-block.spec.ts          # NEW
└── integration/
    ├── teamwork-scorer.test.ts                           # NEW
    ├── collab-typing-divergence.test.ts                  # NEW
    ├── yjs-snapshot.test.ts                              # NEW
    ├── liveblocks-auth.test.ts                           # NEW
    ├── livekit-token-mint.test.ts                        # NEW
    └── collab-consent.test.ts                            # NEW
```

**Structure Decision**: Pure additive. No new top-level packages, no monorepo split, no new build pipelines for the web app. The Firecracker sandbox service is a *new* standalone deployable (`apps/sandbox-firecracker/`) — it's a Node + WS service that boots Firecracker microVMs, and it ships as a Fly.io app per region. Every new capability is one or more of: a Supabase Edge Function (HTTP-triggered or cron), a Next.js API route (auth-gated by Supabase RLS), a UI page rendered inside the existing 3-portal app, or a Postgres table sitting in the single additive migration `041_collab.sql`.

## Complexity Tracking

No constitution violations to justify. The biggest single net-new risks:

1. **WebContainer COOP/COEP headers** — WebContainer requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on the *entire page*. This conflicts with embedded iframes and certain analytics scripts. Mitigation: the collab route is a dedicated top-level page (`/collab/[id]/editor`); we set headers at the route layout level and refuse iframe embed via `X-Frame-Options: DENY`.
2. **Liveblocks + LiveKit auth at scale** — Token minting on every page load is fine for ≤ 1K MAU (free tier); beyond that we need the paid tier. Mitigation: feature flag `008_liveblocks_paid` controls when the room uses the paid tier; on the free tier, rooms are limited to 4 concurrent participants (FR-001 already caps at 4).
3. **Y.js doc size growth** — A 4-hour session can produce 10+ MB of Y.js ops. Mitigation: 5-minute snapshot to `collab_snapshots` (FR-007 implied); on reconnect, rehydrate from the latest snapshot (FR-007 + edge case in spec).
4. **Anti-collusion false positives** — A pair-programming student (legitimately one driving, one navigating) can look like `collab_typing_divergence`. Mitigation: the signal threshold is tuned against 100 hand-labelled sessions; mentor-review queue catches false positives; we ship behind `008_anti_collusion` flag with 2-week cohort.
5. **Sandbox escape via WebContainer** — WebContainer is a browser-side VM, but it does have access to the user's localhost and certain browser APIs. Mitigation: `network: 'disabled'` is the default (FR-025); egress attempts are logged; the room is a top-level page (no iframe embedder privilege).

Three explicit deferrals (mobile collab client, AI code review inside collab editor, in-room AI pair-programmer) are documented in spec.md "Out of Scope" with the rationale.

## Re-Evaluation of Constitution Check (post-design)

Still no violations. Plan respects:
- **Additive-only schema** (1 new migration, 1 enum extension to `anticheat_signals`)
- **Privacy-first** (per-room consent, per-student opt-out, PII redaction, account-deletion cascade, consent-revoke mid-session)
- **Cost-aware** (Liveblocks MAU tier, LiveKit bandwidth cap, Firecracker per-region cap, WebContainer = zero infra cost, recording retention cap, 5% Skill-Proof-Score cap)
- **Observability** (every consent change, every observer join, every anti-collusion signal, every sandbox-escape attempt logged to `collab_audit` + `collab_events`)
- **Backward compatibility** (existing 001-004 functionality unchanged; new features are opt-in via flags; consent is per-room)
- **Reuse-not-rebuild** (anti-collusion rides on 004's `anticheat_signals`; cron rides on 004's cron registry; API-key + rate-limit rides on 004's pattern; webhook-dispatcher rides on 004's `webhook-dispatcher`; W3C VC issuance rides on 004's `credential-vc-issue`)
