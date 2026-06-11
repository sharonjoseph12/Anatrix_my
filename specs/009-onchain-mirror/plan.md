# Implementation Plan: 009 — On-Chain Mirror (EAS on Base L2)

**Branch**: `009-onchain-mirror` | **Date**: 2026-06-07 | **Spec**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/009-onchain-mirror/spec.md)
**Input**: Feature specification from `specs/009-onchain-mirror/spec.md`
**Builds on**: 001 (foundation) + 002 (W3C VC + revocation registry) + 003 (engagement) + 004 (defensibility — audit/logging patterns, feature-flag infrastructure) + 007 (per-student opt-in patterns)

## Summary

An optional, hash-only on-chain mirror of existing 002 W3C VCs onto the Ethereum Attestation Service (EAS) on Base L2. Three independent gates (master, per-tenant, per-student opt-in) default-OFF the entire feature. On mirror, the system writes a single EAS attestation whose `data` is `abi.encode(bytes32 vcHash, string revocationPointer, uint64 scoreSnapshot)` with the student-supplied or platform-custodial EOA as `recipient` and the Antarix attested address as `attester`. On unmirror, the EAS attestation is revoked (EAS `revoke(uid)`); the 002 W3C VC is unchanged. Every action is recorded in `chain_mirror_audit` with `tx_hash`, `block_number`, `gas_used`, `usd_cost`, and `consent_version` for DPDP/SOC2-grade audit.

**Technical approach**: Pure additive. New migration `049_onchain_mirror.sql` (5 tables + RLS), 1 new Supabase Edge Function (`chain-mirror-attest`), 1 new cron-driven dispatcher (`chain-mirror-dispatcher`), 1 new resolver route (`/verify/onchain/[attestation_uid]`), 1 wallet-connect UI, 1 settings/unmirror UI, 1 schema-registration script. Reuse the entire 001-007 stack — Turborepo + pnpm, Next.js 15, Supabase Postgres + Edge Functions + RLS, Vitest + Playwright, viem (replacing ethers for EVM, per the 2026 house choice from 001), and the 002 W3C VC + `/verify/{slug}` infrastructure as the source of truth. New deps: `@ethereum-attestation-service/sdk` (official EAS SDK) and a thin viem wrapper for the attester signer. Optional Hardhat local node for E2E tests.

## Technical Context

**Language/Version**: TypeScript 5.5+, Node.js 20+ *(inherited from 001)*
**Primary Dependencies (inherited)**: Next.js 15, Supabase JS v2, Tailwind CSS v4, shadcn/ui, viem (1.x), handlebars, web-push
**Primary Dependencies (new)**: `@ethereum-attestation-service/sdk` (^2.0 — official EAS SDK on Base L2), `siwe` (EIP-4361 Sign-In with Ethereum message parser), `@spruceid/siwe-parser` (alt for v1.x), optional `@noble/hdkey` for platform-custodial HD derivation
**Storage**: PostgreSQL (via Supabase) — 5 new tables + 1 column on `users` + 1 column on `institutions`; all in a single additive migration `049_onchain_mirror.sql`
**Testing**: Vitest (unit) + Playwright (E2E) + Supabase CLI integration *(inherited)* + Hardhat local node for EAS contract interaction in E2E (optional, off by default; see quickstart §6)
**Target Platform**: Web (responsive) *(inherited)* + Base L2 (EVM, OP Stack)
**Project Type**: Web service (multi-portal SaaS) + Edge Functions + on-chain write path *(inherited + extended)*
**Performance Goals (inherited)**: Dashboard <2s, search <5s, PublicProfile p95 ≤ 2s
**Performance Goals (new)**: Mirror submission p95 ≤ 30s end-to-end (queue + Base L2 finality); `GET /verify/onchain/{uid}` p95 ≤ 2s; unmirror p95 ≤ 30s
**Constraints (inherited)**: India market, opt-in privacy, RLS-enforced, DPDP §12 erasure
**Constraints (new)**: Per-mirror cost < $0.01 USD (enforced by gas-oracle gate); master flag must be able to halt the system in < 5 minutes (verified by chaos test); attester private key held in server-side KMS, never in env at the Edge Function level
**Scale/Scope (inherited)**: 50K students Y2
**Scale/Scope (new)**: < 5% of eligible students opt in (SC-CHM-001), so target ~2.5K mirrors over 60 days, but the system must be safe and cheap for 50K students attempting it; queue dispatcher runs every 5 min, unmirror dispatcher every 15 min

## Constitution Check

The project constitution (`.specify/memory/constitution.md`) remains the unmodified template — no custom principles ratified. This plan respects the *implicit* principles followed by 001-007:

- **Additive-only schema** (1 new migration, 5 new tables, 2 column additions, no DROP/ALTER on existing critical columns)
- **Privacy-first** (no PII on-chain; hash + revocation pointer only; per-student opt-in default OFF; DPDP §12 erasure triggers a bulk-unmirror path; every action audited with `consent_version`)
- **Cost-aware** (gas-oracle gate enforces < $0.02 per mirror; queue + cron avoids the burst pattern of on-demand submissions; deferred to a low-gas window when needed)
- **Observability** (`chain_mirror_audit` is the immutable audit log; `chain_mirror_queue.status` is the operational health signal; mirror + unmirror dispatchers emit to the existing `supabase.functions.invoke_log`)
- **Backward compatibility** (002 W3C VC + public page are untouched; 009 is read-only on 002 data; 009 can be killed without losing any 002 functionality)
- **Kill-switch discipline** (3 independent gates; master, per-tenant, per-student — the master flag is the only "everything stops" lever; per-tenant and per-student are surgical)

**No violation blocks Phase 0 / Phase 1 of this plan.** Recommended: run `/speckit-constitution` before code, but not blocking.

## Project Structure

### Documentation (this feature)

```text
specs/009-onchain-mirror/
├── plan.md                  # This file
├── research.md              # Phase 0 output — 9 new decisions (D1-D9)
├── data-model.md            # Phase 1 output — 5 new tables, 1 migration
├── quickstart.md            # Phase 1 output — env vars, Hardhat local, test scripts
├── contracts/
│   └── api.md               # Phase 1 output — 4 internal + 1 public endpoint
├── checklists/
│   └── requirements.md      # From spec phase — 12-item quality checklist
└── tasks.md                 # Phase 2 output — ~60 atomic, dependency-ordered
```

### Source Code (repository root)

Inherits 001-007 layout unchanged. New files:

```text
supabase/
├── migrations/
│   ├── 049_onchain_mirror.sql                  # NEW — 5 tables + RLS + extensions
│   └── 050_cron_009.sql                        # NEW — mirror + unmirror dispatchers
└── functions/
    ├── chain-mirror-attest/                    # NEW — main mirror write path
    │   ├── index.ts                            # EAS.attest() with gas-oracle gate
    │   ├── schema.ts                           # canonical-JSON-of-VC-without-PII
    │   ├── sign.ts                             # attester signer wrapper (KMS)
    │   └── deno.json
    ├── chain-mirror-dispatcher/                # NEW — cron, every 5 min
    │   └── index.ts                            # walks chain_mirror_queue, gas-oracle gate
    ├── chain-unmirror-dispatcher/              # NEW — cron, every 15 min
    │   └── index.ts                            # walks chain_mirror_revocations, EAS.revoke()
    └── chain-mirror-resolver/                  # NEW — public, no auth
        └── index.ts                            # EAS.getAttestation(uid) → unified view JSON

apps/web/src/
├── app/
│   ├── (student)/
│   │   ├── dashboard/
│   │   │   └── credentials/
│   │   │       ├── mirror-button.tsx           # NEW — modal with wallet connect + custodial choice
│   │   │       └── mirror-status.tsx           # NEW — confirmed / pending / failed badge
│   │   └── settings/
│   │       └── onchain-mirror/
│   │           └── page.tsx                    # NEW — opt-in toggle + unmirror-all + key export
│   ├── (college)/
│   │   └── admin/
│   │       └── onchain-policy/
│   │           └── page.tsx                    # NEW — per-tenant disable
│   ├── (company)/
│   │   └── candidates/
│   │       └── [id]/
│   │           └── onchain-badge.tsx           # NEW — "Has on-chain mirror" badge
│   ├── verify/
│   │   └── onchain/
│   │       └── [attestation_uid]/
│   │           ├── page.tsx                    # NEW — public SSR, no auth
│   │           └── opengraph-image.tsx         # NEW — preview card for sharing
│   └── api/
│       ├── credentials/
│       │   └── [id]/
│       │       └── onchain/
│       │           ├── route.ts                # NEW — POST (request mirror) + GET (status)
│       │           └── [attestation_uid]/
│       │               └── route.ts            # NEW — DELETE (unmirror)
│       ├── onchain/
│       │   ├── consent/
│       │   │   └── route.ts                    # NEW — POST (grant consent) + DELETE (revoke)
│       │   ├── wallet/
│       │   │   ├── connect/route.ts            # NEW — POST (SIWE verify)
│       │   │   └── export/route.ts             # NEW — POST (export custodial key, 2FA gate)
│       │   └── policy/
│       │           └── route.ts                # NEW — GET (read flags) + PATCH (admin tenant flag)
├── lib/
│   ├── onchain/
│   │   ├── eas-client.ts                       # NEW — EAS SDK + viem wrapper
│   │   ├── canonical-json.ts                   # NEW — RFC 8785 + PII strip
│   │   ├── gas-oracle.ts                       # NEW — fetch + usd-equivalent
│   │   ├── siwe-verify.ts                      # NEW — SIWE message + signature verify
│   │   ├── hd-derive.ts                        # NEW — m/44'/60'/0'/0/{i} for custodial
│   │   └── reputation-bonus.ts                 # NEW — attesterReputation extension
│   └── kill-switch.ts                          # NEW — 3-gate resolver (master/tenant/student)
├── components/
│   └── wallet/
│       ├── connect-button.tsx                  # NEW — wagmi/rainbowkit (or thin custom)
│       └── custodial-prompt.tsx                # NEW — fallback when no wallet
└── public/
    └── verify/
        └── onchain/
            └── og-fallback.png                 # NEW — default OG image

packages/
├── types/
│   ├── onchain-mirror.ts                       # NEW — TS types for all 5 tables + EAS data shape
│   └── eas.ts                                  # NEW — schema string, decoded data type
└── utils/
    ├── canonical-json.ts                       # NEW (mirrored in apps/web for edge)
    └── wei-usd.ts                              # NEW — wei → USD via oracle

tests/
├── e2e/
│   ├── onchain-mirror-happy-path.spec.ts       # NEW — POST → wait → confirm → verify
│   ├── onchain-mirror-unmirror.spec.ts         # NEW — DELETE → revoke → re-verify
│   ├── onchain-mirror-kill-switch.spec.ts      # NEW — master flag off → 503
│   ├── onchain-mirror-tenant-disable.spec.ts   # NEW — college flag off → 403
│   ├── onchain-mirror-dpdp-deletion.spec.ts    # NEW — student deletion → bulk unmirror
│   └── onchain-resolver-public.spec.ts         # NEW — no-auth GET /verify/onchain/{uid}
└── integration/
    ├── canonical-json.test.ts                  # NEW — RFC 8785 + PII strip
    ├── gas-oracle.test.ts                      # NEW — backoff + USD conversion
    ├── eas-client.test.ts                      # NEW — local Hardhat, sign + submit
    └── siwe-verify.test.ts                     # NEW — message + signature roundtrip

hardhat/                                         # NEW — local EAS testing
├── contracts/
│   └── (uses @ethereum-attestation-service contracts via npm)
├── scripts/
│   ├── deploy-eas.ts                           # NEW — local EAS deployment
│   └── register-schema.ts                      # NEW — one-time schema registration
├── hardhat.config.ts                           # NEW
└── package.json                                # NEW
```

**Structure Decision**: Pure additive. No new top-level packages, no monorepo split, no new build pipelines. Every new capability is one or more of: a Supabase Edge Function (executed by existing schedulers or HTTP triggers), a Next.js API route (auth-gated by existing Supabase RLS), a UI page rendered inside the existing 3-portal app, a Postgres table sitting in the additive migration, or a Hardhat local subproject under a new top-level `hardhat/` directory for EAS testing.

## Cross-Feature Dependencies

| From | To | Dependency | Notes |
|---|---|---|---|
| 002 | 009 | `verifiable_credentials` table | Source of truth for the mirror; 009 reads `snapshot_overall_score`, `public_slug`, `revocation_status`, `snapshot_per_skill`, `snapshot_taken_at` |
| 002 | 009 | `/verify/{slug}` public page | The 002 page is the `revocationPointer` target; 009's resolver fetches it server-side to render the unified view |
| 002 | 009 | 002 revocation flow | When a student deletes via DPDP §12, the existing 002 deletion handler triggers the 009 bulk-unmirror path |
| 004 | 009 | `feature_flags` table | The master kill-switch reads from the same `feature_flags` mechanism; 009 contributes one new flag (`009_onchain_mirror_enabled`) |
| 004 | 009 | `supabase.functions.invoke_log` | The new edge functions log to the existing observability table |
| 007 | 009 | Per-student opt-in pattern | The `users.onchain_mirror_opt_in` column + UI follows the same opt-in pattern as 007's adaptive graph sharing |
| 001 | 009 | Supabase cron | 009's dispatchers run on the existing `pg_cron` infrastructure; one new cron entry per dispatcher |

## Complexity Tracking

No constitution violations to justify. The biggest single net-new risk is **regulatory drift** in India (or another jurisdiction) that re-classifies EAS attestations as VDAs. Mitigated by the master kill-switch and the explicit "Out-of-Scope Exits" section in spec.md. The second-largest risk is **attester private key compromise** — mitigated by KMS-backed key storage, quarterly rotation (with the 90-day incident-free window as a launch gate), and the master kill-switch as the immediate response.

Three explicit deferrals (multi-chain mirror, self-attestations, employer-issued credentials) are documented in spec.md "Out of Scope".

## Re-Evaluation of Constitution Check (post-design)

Still no violations. Plan respects:
- **Additive-only schema** (1 new migration, 5 new tables, 2 column additions, no destructive changes)
- **Privacy-first** (no PII on-chain; per-student opt-in default OFF; DPDP §12 erasure triggers bulk-unmirror; full audit trail with `consent_version`)
- **Cost-aware** (gas-oracle gate < $0.02; queue + cron; deferred low-gas window; reputation bonus is opt-out)
- **Observability** (5 audit + queue tables; chaos test for kill-switch in < 5 min; structured logs to `invoke_log`)
- **Backward compatibility** (002 untouched; 009 is read-only on 002; can be killed without losing 002 functionality)
- **Kill-switch discipline** (3 independent gates; master, per-tenant, per-student; tested in E2E)
