# Tasks: 009 — On-Chain Mirror (EAS on Base L2)

**Feature**: `009-onchain-mirror`
**Generated**: 2026-06-07
**Source**: `specs/009-onchain-mirror/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

Atomic, dependency-ordered tasks. `[P]` = parallelizable with siblings sharing the same phase prefix. **Bold** tasks are critical-path. `[US1/US2/US3]` labels map to spec user stories for traceability.

---

## Phase 0 — Pre-flight

- [x] T001 [P] Verify 001-008 task completion (existing migrations 001-042 present, including 002 W3C VC infra and 041 webhooks; the 049_verify_api_key.sql co-exists — see data-model.md §0 for the naming note)
- [x] T002 [P] Survey existing edge functions; confirm new function names (`chain-mirror-attest`, `chain-mirror-dispatcher`, `chain-unmirror-dispatcher`, `chain-mirror-resolver`) don't clash
- [x] T003 [P] Add 009 env vars to `.env.local.example` (per quickstart §1)
- [x] T004 [P] Add 009 env vars to `turbo.json` `globalEnv` array
- [x] T005 [P] Add new dependencies to `apps/web/package.json`: `@ethereum-attestation-service/sdk`, `siwe`, `viem` (if not already present from 001), `@noble/hdkey`; and to `hardhat/package.json`: `hardhat`, `@ethereum-attestation-service/contracts`, `typescript`, `ts-node`
- [x] T006 [P] Create `hardhat/` subproject (new top-level dir): `hardhat.config.ts`, `contracts/`, `scripts/deploy-eas.ts`, `scripts/register-schema.ts`, `package.json`
- [x] T007 [P] Create `pnpm-workspace.yaml` (or `turbo.json` pipeline) update to include the `hardhat` workspace

**Checkpoint**: Env + workspace ready. No code yet.

---

## Phase 1 — Schema (migration 042)

- [x] **T010** [US1] `supabase/migrations/049_onchain_mirror.sql` — 6 tables: `chain_mirror_audit`, `chain_mirror_queue`, `chain_mirror_consents`, `chain_mirror_revocations`, `chain_reputation_bonuses`, `chain_mirror_schema`; column additions on `users` (+`onchain_mirror_opt_in`, +`wallet_address`, +`custodial_address_index`) and `institutions` (+`onchain_mirror_enabled`); all indexes, CHECK constraints, RLS policies, and the `chain_mirror_audit_immutable` trigger per [data-model.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/009-onchain-mirror/data-model.md)
- [x] T011 [P] `supabase/migrations/050_cron_009.sql` — register 2 cron jobs on `pg_cron`: `chain-mirror-dispatcher` every 5 min, `chain-unmirror-dispatcher` every 15 min

**Checkpoint**: `pnpm supabase db reset` clean. RLS verified. `chain_mirror_audit_immutable` trigger blocks UPDATE/DELETE.

---

## Phase 2 — Shared types + utilities

- [x] T020 [P] Create `packages/types/onchain-mirror.ts` — TS types for all 6 tables; mirror + unmirror + audit action unions; consent version string union; chain ID literal (`8453` for Base mainnet)
- [x] T021 [P] Create `packages/types/eas.ts` — `EASAttestation`, `EASSchema`, `attesterReputation` shapes; `decodeAttestationData(schema, data) → { vcHash, revocationPointer, scoreSnapshot }`
- [x] T022 [P] Create `packages/utils/canonical-json.ts` — RFC 8785 implementation; PII allowlist helper `stripVCForHash(vc) → {credentialType, snapshotOverallScore, snapshotPerSkill, snapshotTakenAt}`
- [x] T023 [P] Create `packages/utils/wei-usd.ts` — `weiToUsd(wei, ethUsdPrice) → number` with the 6-decimal rounding
- [x] T024 [P] Update `packages/types/database.ts` with new table types (regenerate via `pnpm supabase gen types typescript`)

---

## Phase 3 — EAS SDK + lib utilities (US1 foundation)

- [x] **T030** [US1] `apps/web/src/lib/onchain/eas-client.ts` — wrap `@ethereum-attestation-service/sdk` + viem: `attest({schema, data, recipient})`, `revoke({schema, uid})`, `getAttestation(uid)`, `registerSchema(string)`, `getSchema(uid)`; all read from env + KMS
- [x] T031 [P] `apps/web/src/lib/onchain/canonical-json.ts` — production version: imports `packages/utils/canonical-json` and re-exports with the PII strip applied; `computeVCHash(vc) → 0x...{bytes32}`
- [x] T032 [P] `apps/web/src/lib/onchain/gas-oracle.ts` — `getProjectedCost(estimatedGas, gasPriceGwei, ethUsdPrice) → { wei, usd }`; `fetchGasPrice()` (Base RPC `eth_gasPrice`); `fetchEthUsdPrice()` (Coinbase or CoinGecko); `shouldDefer(projectedCostUsd, threshold) → boolean`
- [x] T033 [P] `apps/web/src/lib/onchain/siwe-verify.ts` — `verifySiwe(message, signature) → { address, nonce, issuedAt }`; nonce replay protection via `siwe_nonces` table (created in 042 if needed) or in-memory with a 5-min TTL
- [x] T034 [P] `apps/web/src/lib/onchain/hd-derive.ts` — `deriveCustodialAddress(seed, index) → { address, privateKey }` using `@noble/hdkey`; derivation path `m/44'/60'/0'/0/{index}`; seed fetched from Vault
- [x] T035 [P] `apps/web/src/lib/onchain/reputation-bonus.ts` — `issueReputationBonus(recipient, snapshotScore) → bonusAttestationUid` (only if `snapshotScore >= 90` AND `REPUTATION_BONUS_THRESHOLD` env)
- [x] T036 [P] `apps/web/src/lib/kill-switch.ts` — `evaluateMirrorGate(studentId) → { allowed, reason? }`; checks master → tenant → student in order; returns one of `{allowed}`, `{denied: 'kill_switch_active'}`, `{denied: 'tenant_disabled'}`, `{denied: 'opt_in_required'}`

**Checkpoint**: All lib utilities + EAS client available; kill-switch resolver returns the right reason on each gate.

---

## Phase 4 — Attestation edge function + dispatcher (US1)

- [x] **T040** [US1] `supabase/functions/chain-mirror-attest/index.ts` — entry point for ad-hoc mirror submissions (rarely used; the dispatcher does the bulk of work). Validates input, calls `evaluateMirrorGate`, calls `easClient.attest`, writes `chain_mirror_audit` with full tx details
- [x] **T041** [US1] `supabase/functions/chain-mirror-dispatcher/index.ts` — cron entry (every 5 min): SELECT FOR UPDATE on `chain_mirror_queue` rows where `status IN ('pending','failed')` AND `next_attempt_at <= now()`; for each: evaluate gate, fetch gas price, defer if too high, compute vcHash, sign + submit EAS.attest, write audit + queue UPDATE
- [x] T042 [P] [US1] `supabase/functions/chain-mirror-dispatcher/backoff.ts` — pure fn: `nextBackoffDelay(attemptCount) → minutes`; schedule: 1m, 5m, 25m, 2h, 12h; return `null` when attemptCount >= 5 (dead-letter)
- [x] T043 [P] [US1] `supabase/functions/chain-unmirror-dispatcher/index.ts` — cron entry (every 15 min): walks unmirror rows (can be a separate `chain_unmirror_queue` view or a `chain_mirror_queue` row with `action='unmirror'`); calls `easClient.revoke`; writes `chain_mirror_revocations` + audit
- [x] T044 [US1] Wire `chain-mirror-dispatcher` to the existing `pg_cron` extension (per migration 043)
- [x] T045 [US1] Wire `chain-unmirror-dispatcher` to `pg_cron`
- [ ] T046 [P] [US1] Unit test `tests/integration/eas-client.test.ts` — uses local Hardhat; sign + submit a mirror; assert audit row + queue transition
- [ ] T047 [P] [US1] Unit test `tests/integration/canonical-json.test.ts` — PII strip; stable hash for the same VC; different hash for a different VC
- [ ] T048 [P] [US1] Unit test `tests/integration/gas-oracle.test.ts` — backoff schedule; defer when over threshold; cost calculation
- [ ] T049 [P] [US1] Unit test `tests/integration/siwe-verify.test.ts` — message + signature roundtrip; replay rejection

**Checkpoint**: US1 backend shippable behind `009_onchain_mirror_enabled=false` (master flag).

---

## Phase 5 — Verification UI + resolver (US2)

- [x] **T060** [US2] `apps/web/src/app/verify/onchain/[attestation_uid]/page.tsx` — public SSR page; calls `chain-mirror-resolver`; renders the unified view (banner + 002 VC card + collapsible VC JSON drawer + on-chain transaction details); no auth; rate-limited
- [x] T061 [P] [US2] `apps/web/src/app/verify/onchain/[attestation_uid]/opengraph-image.tsx` — OG preview card showing "Mirrored on Base L2 by Antarix — score 87" for sharing
- [x] T062 [P] [US2] `supabase/functions/chain-mirror-resolver/index.ts` — public; reads EAS attestation via viem public client (no signer); dereferences the `revocationPointer` to the 002 public page; returns unified view JSON; rate-limited per IP via the `ONCHAIN_RESOLVER_RATE_LIMIT_RPM` env
- [x] T063 [P] [US2] `apps/web/src/lib/onchain/resolver-cache.ts` — 5-minute in-memory LRU cache for resolver responses (Base L2 finality is ~2s, so a 5-min cache is safe and reduces RPC calls)
- [x] T064 [US2] `apps/web/src/app/api/v1/verify/onchain/[attestation_uid]/route.ts` — JSON variant of the resolver for API consumers (returns `Accept: application/json` shape)
- [x] T065 [P] [US2] `apps/web/src/app/(company)/candidates/[id]/onchain-badge.tsx` — recruiter dashboard widget: "Has on-chain mirror" badge with mirror count + latest attestation's EAS Scan link; shown when student has ≥ 1 confirmed mirror
- [ ] T066 [P] [US2] E2E `tests/e2e/onchain-resolver-public.spec.ts` — happy path: confirmed mirror → no-auth GET → 200 with all fields; revocation path: revoked 002 → re-fetch → disclosure shown; RPC outage path: mock Base RPC timeout → 503

**Checkpoint**: US2 shippable behind master flag.

---

## Phase 6 — Mirror request UI + consent flow (US1 + US3)

- [x] T080 [US1] `apps/web/src/app/api/credentials/[id]/onchain/route.ts` — POST (request mirror) + GET (status); uses `kill-switch.evaluateMirrorGate`; writes queue + consent + audit
- [x] T081 [P] [US1] `apps/web/src/app/api/credentials/[id]/onchain/[attestation_uid]/route.ts` — DELETE (unmirror); idempotent
- [x] T082 [P] [US1] `apps/web/src/app/api/onchain/consent/route.ts` — POST (grant) + DELETE (revoke); handles SIWE verification + consent row insert + opt-in flag update
- [x] T083 [P] [US3] `apps/web/src/app/api/onchain/wallet/connect/route.ts` — POST; SIWE verify; returns verified address (does NOT yet persist to users.wallet_address — that happens on consent)
- [x] T084 [P] [US3] `apps/web/src/app/api/onchain/wallet/export/route.ts` — POST; 2FA-gated; returns the platform-custodial private key as a one-time downloadable file
- [x] T085 [P] [US3] `apps/web/src/app/api/onchain/policy/route.ts` — GET (read all 3 gates for the calling student) + PATCH (per-tenant flag, admin-only)
- [x] T086 [P] [US1] `apps/web/src/app/(student)/dashboard/credentials/mirror-button.tsx` — "Mirror on-chain" CTA; opens a modal with: consent text, wallet choice (self / platform-custodial), reputation bonus toggle (if `snapshotScore >= 90`), SIWE prompt (if self); POSTs to `/api/credentials/{id}/onchain`
- [x] T087 [P] [US1] `apps/web/src/app/(student)/dashboard/credentials/mirror-status.tsx` — status badge: `not_mirrored` | `pending` | `submitted` | `confirmed` | `failed` | `cancelled` | `dead_letter`; with "View on EAS Scan" + "View resolver" links when confirmed
- [x] T088 [P] [US3] `apps/web/src/app/(student)/settings/onchain-mirror/page.tsx` — opt-in toggle + active mirrors list + "Unmirror all" bulk action + key export button
- [x] T089 [P] [US3] `apps/web/src/app/(college)/admin/onchain-policy/page.tsx` — college admin: per-tenant flag toggle
- [x] T090 [P] [US3] `apps/web/src/components/wallet/connect-button.tsx` — wagmi/rainbowkit-based wallet connect; falls back to custodial prompt if no wallet detected
- [x] T091 [P] [US3] `apps/web/src/components/wallet/custodial-prompt.tsx` — "No wallet? Use an Antarix-custodial address" CTA

**Checkpoint**: Full UI flow for US1 + US3 shippable.

---

## Phase 7 — Kill-switch + DPDP integration (US3)

- [ ] **T100** [US3] Hook the existing 002 deletion handler (`apps/web/src/app/api/users/me/delete/route.ts` or equivalent) to enqueue a bulk-unmirror on `users.deletion_requested_at` set. Verify: every active mirror for the deleted student is revoked within 1 hour (SC-CHM-008)
- [x] T101 [P] [US3] `apps/web/src/lib/onchain/dpdp-bulk-unmirror.ts` — `enqueueBulkUnmirrorForStudent(studentId) → queueIds[]`; walks `chain_mirror_queue` for `status='confirmed'` rows; inserts an unmirror row for each
- [x] T102 [P] [US3] `apps/web/src/lib/onchain/policy-audit.ts` — pure fn: `emitPolicyAudit(action, actor, subject, payload)`; called from every policy change
- [ ] T103 [P] [US3] Slack notifier — when `chain_mirror_queue.status` transitions to `dead_letter` for any row, post to the Antarix ops Slack via the existing webhook from 041
- [ ] T104 [P] [US3] Chaos test `tests/e2e/onchain-mirror-kill-switch.spec.ts` — flip master flag mid-flight; assert no new submissions; assert in-flight submissions complete; measure time-to-no-new-submissions < 5 min
- [ ] T105 [P] [US3] E2E `tests/e2e/onchain-mirror-tenant-disable.spec.ts` — per-tenant flag off → 403; new mirror denied; old mirrors stand
- [ ] T106 [P] [US3] E2E `tests/e2e/onchain-mirror-dpdp-deletion.spec.ts` — student deletion → bulk unmirror → all EAS attestations revoked; verify on local Hardhat
- [ ] T107 [P] [US3] Unit test `tests/integration/policy-audit.test.ts` — every consent change writes an audit row with the correct `consent_version` + `action`

**Checkpoint**: US3 kill-switch + DPDP flow shippable.

---

## Phase 8 — Schema registration + reputation bonus

- [ ] T120 [US1] `scripts/register-eas-schema-base.ts` — one-time script; reads `EAS_SCHEMA_REGISTRY_ADDRESS_BASE` from env; calls `schemaRegistry.register({schema: 'bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot', revocable: true})`; writes the resulting `schema_uid` to env + `chain_mirror_schema` table; idempotent
- [ ] T121 [P] [US1] `hardhat/scripts/deploy-eas.ts` — deploys the EAS contracts to the local Hardhat node; prints addresses
- [ ] T122 [P] [US1] `hardhat/scripts/register-schema.ts` — calls `register-eas-schema-base.ts` against the local Hardhat node; writes the schema_uid to `.env.local.test`
- [ ] T123 [P] [US1] `hardhat/hardhat.config.ts` — configures the local network; imports EAS contracts from `@ethereum-attestation-service/contracts`
- [ ] T124 [US1] Wire `reputation-bonus.ts` into `chain-mirror-attest` (T040) and `chain-mirror-dispatcher` (T041) — only fires when `snapshotScore >= 90` AND `include_reputation_bonus=true`
- [ ] T125 [US1] E2E `tests/e2e/onchain-mirror-happy-path.spec.ts` — seed VC + opt-in + request mirror + wait for dispatcher + verify on local Hardhat + resolve publicly

**Checkpoint**: Full mirror + unmirror + bonus + resolver pipeline tested end-to-end on local Hardhat.

---

## Phase 9 — Tests + observability + cross-cutting

- [ ] T140 [P] Unit tests for `kill-switch.ts` — all 3 gate combinations; each returns the right reason
- [ ] T141 [P] E2E `tests/e2e/onchain-mirror-unmirror.spec.ts` — happy path unmirror; idempotency check; audit row created
- [ ] T142 [P] Add `009_onchain_mirror_enabled` to `feature_flags` seed (in `supabase/seed.sql`)
- [ ] T143 [P] Add `CHAIN_MIRROR_CONSENT_VERSION` + `CHAIN_MIRROR_CONSENT_TEXT_PATH` to env.example
- [ ] T144 [P] Add structured logging in all 4 edge functions to `supabase.functions.invoke_log` (per existing 004 pattern)
- [ ] T145 [P] Add `daily_chain_mirror_metrics` SQL view exposing: mirror count, unmirror count, dead-letter count, median cost, p95 cost, median resolution latency
- [ ] T146 [P] Add ops dashboard panel (read-only) at `/admin/observability/onchain-mirror` — shows the daily metrics + a "kill-switch state" widget
- [ ] T147 [P] Update `AGENTS.md` to reference 009 plan
- [ ] T148 [P] `docs/009-runbook.md` — key rotation ceremony, EAS contract pause response, gas spike response, DPDP deletion backlog response
- [ ] T149 [P] DPDP / SOC2 audit log addendum: ensure `chain_mirror_audit` is in the auditor's read-only role
- [ ] T150 [P] Update `README.md` with the 009 feature surface (1 paragraph: on-chain mirror + resolver + kill-switch)

---

## Parallel Opportunities

- Phase 1 (T010) blocks Phase 2-9; T011 can be parallel with T010 (different file, no FK dependency).
- Phase 2 (T020-T024) all parallel after Phase 1.
- Phase 3 (T030-T036) all parallel after Phase 2.
- Phase 4 (T040-T049) critical path: T040, T041, T044, T045. T042, T046-T049 are parallel.
- Phase 5 (T060-T066) can start in parallel with Phase 4 (T040-T049). T060 is critical path; T062 depends on T030 (EAS client).
- Phase 6 (T080-T091) depends on T036 (kill-switch) and T030 (EAS client); otherwise parallel.
- Phase 7 (T100-T107) depends on T040 (attest) and T043 (unmirror) for E2E tests; T101-T103 can be parallel with Phase 6.
- Phase 8 (T120-T125) depends on T030 (EAS client); T121-T123 are local Hardhat setup, fully parallel.
- Phase 9 (T140-T150) is the consolidation phase; can start once Phase 5-7 are done.

## Task Count Summary

| Phase | Tasks | Critical Path |
|---|---|---|
| 0 — Pre-flight | 7 | T005, T006 |
| 1 — Migrations | 2 | T010 |
| 2 — Types + utils | 5 | T022 |
| 3 — EAS SDK + lib | 7 | T030, T036 |
| 4 — Edge functions + dispatcher (US1) | 10 | T040, T041 |
| 5 — Verification UI + resolver (US2) | 7 | T060, T062 |
| 6 — Mirror UI + consent flow (US1 + US3) | 12 | T080, T086 |
| 7 — Kill-switch + DPDP (US3) | 8 | T100 |
| 8 — Schema reg + reputation bonus | 6 | T120, T124 |
| 9 — Tests + observability + cross-cutting | 11 | T142, T146 |
| **Total** | **75** | |

## Rollout Recommendation

1. Land Phases 0-4 in the first sprint (US1 backend + lib + dispatchers) — all behind master flag, default OFF.
2. Land Phases 5-6 in the second sprint (US2 resolver + US1/US3 UI) — flag still OFF.
3. Land Phases 7-8 in the third sprint (US3 kill-switch + DPDP + reputation bonus + schema reg) — flag still OFF.
4. Phase 9 in parallel with sprint 3 (observability + runbook + audit addendum).
5. Cohort rollout: Day 0 internal dogfood (engineering only) → Day 30 cohort 1% of students (only those who actively toggle) → Day 60 cohort 10% → Day 90 cohort 100%.
6. The `009_reputation_bonus` flag stays OFF until Day 60 (deliberately a slower ramp than the mirror itself).
