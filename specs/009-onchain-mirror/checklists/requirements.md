# Requirements Quality Checklist: 009 — On-Chain Mirror (EAS on Base L2)

**Purpose**: Validate the completeness, clarity, and consistency of the spec, plan, research, data-model, contracts, and quickstart before implementation begins.
**Created**: 2026-06-07
**Feature**: [spec.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/009-onchain-mirror/spec.md) (009 — On-Chain Mirror)
**Source spec**: `specs/009-onchain-mirror/spec.md`

---

## 1. Scope & Boundaries

- [x] **CHK001** — Spec explicitly documents why a literal "soulbound NFT" was **declined** and what the W3C + EAS-mirror approach gains (5 DPDP/cost/utility reasons in the "Why this exists" section; 7 wins in the W3C + EAS-mirror bullet list).
- [x] **CHK002** — Spec enumerates 7 explicit "Out of Scope" deferrals (literal NFT, multi-chain, self-attestations, non-002 sources, on-chain payload rewrites, employer-issued tokens, mirror of a deleted VC) and 4 "Out-of-Scope Exits" (regulatory event, EAS contract pause, cost spike, attester key compromise).
- [x] **CHK003** — Spec's 3 user stories (US1, US2, US3) are independently testable, prioritized (P2, P2, P3), and each has ≥ 5 acceptance scenarios plus a clearly stated "Why this priority" rationale.

## 2. Regulatory & Privacy

- [x] **CHK004** — DPDP Act §12 erasure is explicitly addressed: the 002 deletion handler triggers a bulk-unmirror path; the on-chain entries are documented as tombstones (EAS `revoke` semantic, not deletion) which does not violate erasure because no PII is on-chain.
- [x] **CHK005** — Indian Finance Act 2022 / §194BA / 2(47A) crypto-tax position is explicitly captured: a *received* EAS attestation is a read-only data record, not a VDA transfer; legal sign-off is a launch prerequisite (FR-CHM-007 referenced in research.md D1 + the position is re-confirmed quarterly during the attester key rotation ceremony).
- [x] **CHK006** — Per-student opt-in is default OFF; per-tenant and master flags default OFF; consent is versioned (`consent_version` field on `chain_mirror_consents`); consent text is hashed at grant time (`consent_text_hash`) for tamper-evidence; IP is hashed (not stored raw) for DPDP minimization.

## 3. Data Model & Audit

- [x] **CHK007** — Data-model.md specifies 6 new tables (`chain_mirror_audit`, `chain_mirror_queue`, `chain_mirror_consents`, `chain_mirror_revocations`, `chain_reputation_bonuses`, `chain_mirror_schema`) with full DDL: types, constraints (PK / FK / UNIQUE / CHECK), indexes, RLS policies, and the `chain_mirror_audit_immutable` trigger that blocks UPDATE/DELETE on the audit log.
- [x] **CHK008** — Cross-feature FK references are explicit and resolve to existing 001-007 tables: `verifiable_credentials` (002), `users` (001), `institutions` (001). No circular dependencies; no new top-level packages required.
- [x] **CHK009** — ER diagram is included (mermaid) showing all 6 new tables and their relationships to the 002 + 001 entities.

## 4. Kill-Switch & Operational Readiness

- [x] **CHK010** — 3-gate kill-switch is implemented in this exact order — master (`009_onchain_mirror_enabled`) → tenant (`institutions.onchain_mirror_enabled`) → student (`users.onchain_mirror_opt_in`) — with distinct HTTP error codes (503 `kill_switch_active`, 403 `tenant_disabled`, 403 `opt_in_required`) and a chaos test that asserts < 5-minute time-to-no-new-submissions (SC-CHM-007).
- [x] **CHK011** — Attester key custody is non-env (KMS / Vault), with documented rotation cadence (every 90 days) and a compromise response: flip master flag → audit every mirror since the suspected window → rotate key → decide re-mirror vs leave-revoked (research.md D8).
- [x] **CHK012** — Gas cost is bounded: $0.02 hard threshold (defer if over), $0.01 target median (SC-CHM-003), with a gas-oracle gate in the dispatcher and a 10-minute deferral window. Cost is recorded per-action in `chain_mirror_audit.usd_cost` for ops dashboards.
