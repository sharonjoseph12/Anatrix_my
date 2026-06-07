# Phase 0 Research: 009 — On-Chain Mirror (EAS on Base L2)

**Date**: 2026-06-07
**Status**: Decisions ratified; ready for Phase 1

Nine architectural decisions for feature 009. Each captures the choice, the rejected alternatives, and the rationale.

---

## D1. Literal "soulbound NFT" declined; W3C VC + EAS mirror chosen

**Decision**: Ship an **optional, hash-only on-chain mirror** of the existing 002 W3C Verifiable Credential via the Ethereum Attestation Service (EAS) on Base L2. **Do not** ship a literal ERC-5114 / ERC-721 soulbound NFT.

**Why we declined the literal NFT** (full analysis in [spec.md §"Why this exists"](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/009-onchain-mirror/spec.md)):

1. **DPDP Act §12 erasure conflict** — a literal NFT is permanent and immutable on-chain. An Indian student who exercises their right to erasure cannot be fully forgotten if their identifier (and any PII in `tokenURI`) is on-chain. This is a hard regulatory floor; a literal NFT collides with it.
2. **Indian crypto-tax headwind (Finance Act 2022, §194BA, 2(47A))** — transferring any VDA, *including a received NFT*, attracts a 30% tax on notional gains + 1% TDS at source on receipt. A student who "receives" a credential NFT would have to file crypto-tax paperwork for what is, for them, a passive credential. The product becomes legally and reputationally worse than the off-chain alternative.
3. **Employer utility is zero above what 002 already provides** — Indian employers and most global employers in 2026 verify via signed URLs, email, QR — not by reading a chain. The 002 W3C VC + public page is already 90% of the user value.
4. **No off-ramp for the student** — a literal NFT becomes a permanent liability (key custody, wallet loss, chain reorgs). The product would inherit a custody story it does not have the support capacity to own.
5. **Gas + UX** — even on L2s, minting per-student tokens costs real money + 2+ wallet signatures. Across 50K students, ≈$5K-$15K of one-time gas for marginal user value.

**Why the W3C VC + EAS-mirror approach wins**:

1. **No PII on-chain** — only `keccak256(canonicalJSON(vcWithoutPII))` + a revocation pointer to the 002 slug. The VC itself stays in 002's storage.
2. **DPDP-friendly revocation** — EAS has first-class `revoke(attestation_uid)`. The mirror becomes a tombstone on unmirror — explicitly documented as the EAS contract semantic.
3. **EAS reputation portability** — the schema is readable by any EAS-aware dapp (EAS Scan, Farcaster, Optimism explorers).
4. **Sub-cent cost per mirror** — Base L2 attestation gas is < $0.01 per write at 2026-Q2 base fee.
5. **Optional 1-claim reputation bonus** — for high-credibility VCs (snapshot ≥ 90), an additional `attesterReputation` field. Opt-out per student.
6. **No student crypto-tax exposure** — a *received* EAS attestation is a read-only data record, not a VDA transfer under the Indian Finance Act 2022 framing. (Industry legal commentary supports this; legal sign-off is a launch prerequisite, see FR-CHM-007.)
7. **Behind a kill-switch and per-student opt-in, default OFF** — single env flag halts the entire system with zero data loss in 002.

**Alternatives considered**:
- ERC-5114 / soulbound NFT (rejected for the 5 reasons above)
- Off-chain only (the status quo in 002) — insufficient for the Web3-native hiring use case
- Hybrid: literal NFT for premium tier, EAS for free tier (rejected — two code paths, two regulatory positions, no real benefit)

**Rationale**: The W3C + EAS-mirror approach is the *minimum viable on-chain story* that survives a regulatory and cost review. It also gives us the upside (EAS Scan, reputation portability) without the downside (literal NFT tax exposure, key custody burden).

---

## D2. Chain choice: EAS on Coinbase Base L2

**Decision**: Use EAS deployed on Coinbase Base L2 (OP Stack, EVM-equivalent). Single chain for v1.

**Why Base**:
1. **Sub-cent attestation cost** — Base's 2026-Q2 base fee is < 0.005 gwei, so an EAS `attest()` (≈ 80K gas) costs < $0.005 at typical ETH prices.
2. **Regulated entity** — Base is operated by Coinbase Inc., a US-regulated entity. This is a "soft" governance signal that matters for enterprise recruiters in regulated industries (banking, govtech, defense).
3. **EVM-equivalent + OP Stack** — EAS is EVM-native; the SDK is the same as on Ethereum mainnet. We can re-deploy to Optimism, Arbitrum, or mainnet with one config change.
4. **Coinbase Wallet + Base name resolution** — easy wallet UX for the 5% of users who self-custody; one of the most popular L2 wallets in 2026.
5. **Bridge to mainnet** — if a future employer demands an Ethereum-mainnet attestation, we can re-mirror via the same code path (queue + EAS SDK) with a different RPC URL.

**Alternatives considered**:

| Chain | Verdict | Why |
|---|---|---|
| **Base L2** | **Chosen** | Sub-cent cost, regulated operator, EAS-native, EVM-equivalent |
| Optimism | Strong runner-up | EAS deployed; sub-cent cost; OP Stack; less Coinbase brand pull |
| Arbitrum | Viable | EAS deployed; ~2x the gas of Base at 2026-Q2; less popular for hiring use cases |
| Polygon PoS | Rejected | Higher gas variance; EAS deployed but less popular in the EAS Scan aggregator community |
| Solana | Rejected | EAS does not have a first-party deployment; non-EVM makes our viem-based toolchain inert |
| Ethereum L1 | Rejected | Gas > $1/attestation at 2026-Q2 prices; not viable for 50K students |

**Rationale**: Base gives us the lowest cost + the cleanest regulatory story + the best wallet UX for our Indian student base (Coinbase Wallet + MetaMask both first-class on Base). The resolver, queue, and audit tables are designed chain-agnostic (the `attestation_uid` is the chain-scoped identifier; we may add a `chain_id` column in v2 if/when we add a second chain).

**Multi-chain extension is explicitly deferred** to v2 — see spec.md "Out of Scope".

---

## D3. Hash-only mirror, no PII on-chain

**Decision**: The on-chain `data` field is `abi.encode(bytes32 vcHash, string revocationPointer, uint64 scoreSnapshot)`. No student name, no email, no institution, no eth-address of the student, no skill names.

**Why hash-only**:
1. **DPDP §4 minimization** — on-chain storage is permanent and public; only the minimum data needed to prove "this 002 VC was mirrored" should be stored.
2. **GDPR Art. 5(1)(c) / Art. 17** — even outside India, the same logic applies in the EU: on-chain immutable data is the worst place to store personal data.
3. **No employer should ever need PII from the chain** — the `revocationPointer` resolves to the 002 slug, which is the public page where the employer can see the (already-publicly-consented) data.

**What is on-chain**:
- `vcHash` — keccak256 of the canonical-JSON of the VC with all PII stripped. Lets a future auditor prove that the on-chain attestation matches a specific VC version.
- `revocationPointer` — the 002 public slug. Resolves to `antarix.app/verify/{slug}`.
- `scoreSnapshot` — the integer score at the time of mirror. Allows the EAS Scan aggregator to display the score without dereferencing the pointer.

**What is NOT on-chain**:
- Student name, email, eth-address (the recipient address is on-chain per EAS contract, but we treat it as an opaque identifier)
- Institution name, course, faculty
- Per-skill proficiency scores (callers must follow the revocationPointer to get the full breakdown)
- Any future fields we might add to the 002 VC

**Canonical JSON**: We use **RFC 8785 (JSON Canonicalization Scheme)** to ensure the hash is reproducible. PII is stripped via an allowlist: only `credentialType`, `snapshotOverallScore`, `snapshotPerSkill` (as a flattened object), and `snapshotTakenAt` are hashed; everything else is dropped.

**Alternatives considered**:
- Store the full VC JSON on IPFS + hash on-chain (rejected — adds a third-party dependency; IPFS pinning is its own operational story)
- Store the full VC JSON in the EAS `data` field (rejected — EAS data is bytes; variable-size strings cost more gas; PII risk)
- Hash only the credential ID (rejected — we lose the ability to prove a specific VC version was mirrored, which matters for the audit trail)

**Rationale**: Hash-only is the minimum data needed to (a) prove mirror existence, (b) resolve the full VC, (c) audit, and (d) revoke. Anything more is privacy debt we'd have to defend in front of a regulator.

---

## D4. Behind a feature flag (3-gate kill-switch)

**Decision**: Three independent gates must all be true to permit a new mirror:
1. **Master flag** — `009_onchain_mirror_enabled` (env var, read into the `feature_flags` table at deploy). Default **false**.
2. **Per-tenant flag** — `institutions.onchain_mirror_enabled` (column). Default **true**, but college admin can disable for their college. Affects every student at that college.
3. **Per-student flag** — `users.onchain_mirror_opt_in` (column). Default **false**. Each student explicitly opts in via the dashboard.

**Why 3 gates, not 1**:
1. **Master flag** is the "everything stops" lever for ops (regulatory event, EAS bug, gas spike). It must be possible to halt the system in < 5 minutes from a single env change.
2. **Per-tenant flag** lets a college that has institutional concerns (e.g. a college that has been told by their legal team that on-chain credentialing conflicts with their own student-data policy) opt out *all* of its students without us having to maintain a per-student enforcement list.
3. **Per-student flag** is the regulatory floor for India + EU — explicit, informed, versioned consent.

**Why default OFF**:
- The first 6-8 weeks of the feature should land with zero risk: no mirrors happen until an ops engineer explicitly flips the master flag.
- The 002 W3C VC remains the source of truth; the on-chain mirror is genuinely *optional*. Default-ON would imply the platform believes on-chain is required, which is not true and would create regulatory exposure.
- A successful opt-in (a student clicking the toggle) is a much better signal of value than a default-ON number that includes a lot of "I didn't know this was happening" consents.

**Alternatives considered**:
- One master flag, no per-student or per-tenant (rejected — no granular opt-out for institutions that want to ban it; no per-student consent versioning)
- Per-student only (rejected — no global kill switch for ops emergencies; no college-level policy)
- Per-tenant + per-student, no master (rejected — we want a "kill everything" lever for the EAS contract being paused or exploited)

**Rationale**: 3 gates, evaluated in this order: master → tenant → student. Any gate returning false → 503 (`kill_switch_active`) or 403 (`tenant_disabled`) as appropriate. Each gate has its own audit row (`denied_kill_switch` / `denied_tenant_disabled`).

---

## D5. Gas cost projection & low-gas window deferral

**Decision**: Submissions with projected cost > $0.02 are deferred to the next 10-minute window. Cost projection uses a gas oracle (env `GAS_ORACLE_URL`; default: Base public RPC's `eth_gasPrice`).

**Cost model** (2026-Q2 Base L2):
- EAS `attest()` ≈ 80,000 gas (EAS contract `attest` v1.0.0)
- EAS `revoke(uid)` ≈ 50,000 gas
- `attesterReputation` bonus (optional) ≈ 60,000 gas
- Base L2 base fee: ~0.005 gwei at low-traffic times, ~0.05 gwei at peak
- ETH price: assume $3,000 USD (conservative 2026 estimate)

**Cost per mirror** (low-traffic):
- 80,000 gas × 0.005 gwei × $3,000/ETH = 80,000 × 0.000000000005 × 3,000 = **$0.0012**

**Cost per mirror** (peak):
- 80,000 gas × 0.05 gwei × $3,000/ETH = **$0.012**

**Cost per unmirror**:
- 50,000 gas × 0.005 gwei × $3,000/ETH = **$0.00075**

**Cost per reputation bonus**:
- 60,000 gas × 0.005 gwei × $3,000/ETH = **$0.0009**

**Total worst case** (mirror + bonus + unmirror): ≈ $0.015 per student — well under the $0.02 threshold.

**The $0.02 threshold** is chosen as 2x the typical cost, with a 100% safety margin for ETH price volatility. The cron dispatcher fetches `eth_gasPrice` + an ETH/USD price (from `https://api.coinbase.com/v2/prices/ETH-USD/spot` or similar) before each submission; if projected cost > $0.02, the queue row's `next_attempt_at` is pushed +10 minutes.

**Alternatives considered**:
- Always submit (rejected — bad UX for the student if cost spikes; the user sees $0.08 in their gas history and is unhappy)
- Use a private mempool / MEV-protected relayer (rejected for v1 — adds a third-party dependency for marginal benefit at < $0.01/attestation)
- L2 batch submit (deferred to v2 — would require deploying a custom AntarixBatch contract; not worth the complexity for 50K students)

**Rationale**: The gas-oracle gate is the simplest way to guarantee SC-CHM-003 (median cost < $0.01, p95 < $0.02) without manual ops intervention. The cron is the natural fit; we add no new infrastructure.

---

## D6. EAS schema design

**Decision**: Register the schema string `"bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot"` on Base L2 via the EAS SchemaRegistry. The resulting `schema_uid` is stored in env `EAS_SCHEMA_UID_BASE` and in the `chain_mirror_schema` table.

**Schema breakdown**:
- `bytes32 vcHash` — keccak256 of the canonical-JSON of the 002 VC with PII stripped
- `string revocationPointer` — the 002 public slug
- `uint64 scoreSnapshot` — the integer score at mirror time (allows EAS Scan to display the score without dereferencing the pointer)

**Why these 3 fields and no more**:
- `vcHash` — the integrity anchor; lets an auditor prove that a specific 002 VC version was mirrored
- `revocationPointer` — the resolution path; the 002 slug is human-readable and is the URL fragment of the public verification page
- `scoreSnapshot` — the *summary* field; recruiters glancing at EAS Scan can see "Issued by Antarix — score 87" without leaving the chain explorer

**Why no per-skill scores**: Per-skill scores can change with the VC; storing them on-chain would create a versioning problem. The 002 public page has the latest, most accurate per-skill breakdown.

**Schema UID** = keccak256(abi.encodePacked("bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot", EAS schema registry address, ...) — actually, the EAS SchemaRegistry computes it as keccak256 of the schema string, and registers it in the contract. We compute the expected UID off-chain at deploy time and verify it matches the on-chain read.

**Schema upgrade path** (FR-CHM-022):
- v1 (this spec): 3 fields as above
- v2 (future): add `bytes32 institutionHash` if colleges want to anchor institution identity on-chain too
- v3 (future): add `uint64 expirationTimestamp` if we want attestations to expire on-chain

When a v2 is registered, the v1 schema is marked `superseded` in `chain_mirror_schema.status`. Old attestations remain readable; new mirrors use v2. The resolver detects the schema version from the on-chain `Attestation.schema` field and surfaces a "Schema v1 (legacy)" badge.

**Alternatives considered**:
- Reuse an existing public EAS schema (e.g. the "EAS string" schema or "EAS uint256" schema) — rejected; we need the 3-field combination to make the attestation meaningful
- Use a single `bytes32` field that hashes everything including the pointer and score — rejected; we lose the score-summary field that makes EAS Scan useful
- Use 4 fields (add `address recipient` for self-resolution) — rejected; EAS already has a top-level `recipient` field; encoding it twice is wasteful and confusing

**Rationale**: The 3-field schema is the minimum that gives EAS Scan enough information to be useful as a *summary* view, while the revocationPointer gives the *full* view for anyone who wants to dig deeper.

---

## D7. Revocation semantics: EAS revoke (tombstone, not deletion)

**Decision**: Unmirror calls EAS `revoke(attestation_uid)`. The on-chain entry remains a tombstone (it is marked `revoked: true` in the EAS contract's storage) and remains resolvable forever; only the `revoked` flag changes.

**Why tombstone, not deletion**:
1. **EAS contract semantics** — EAS does not support deleting or re-writing an attestation. The `revoke(uid)` function is the only sanctioned way to invalidate an attestation; it sets `attestations[uid].revoked = true`.
2. **Audit trail integrity** — if we could delete on-chain, the audit log would have a hole. With tombstone, the audit log can show "this attestation was issued at T1, revoked at T2, and the on-chain entry still proves it existed."
3. **DPDP §12 conflict resolution** — even on DPDP erasure, the on-chain entry is *not* the source of PII (it's hash + pointer only). The pointer resolves to the 002 slug, which is the row we actually erase. The on-chain entry is, at worst, "a record that some student once had a credential mirrored" — which is not PII.

**What we explicitly disclose to the student on unmirror**:
- "Your on-chain mirror will be marked as revoked on Base L2. The transaction will be visible on Basescan forever, but it will show 'Revoked' instead of 'Active.' Your underlying 002 W3C VC is unchanged — it remains the source of truth."

**What the resolver shows after revocation**:
- `chain_status: 'revoked'`
- `vc_status: 'active' | 'revoked'` (from 002)
- `tombstoned_at: <timestamp>` (the EAS revoke transaction's block timestamp)
- A "Tombstoned" badge in the UI

**Alternatives considered**:
- Re-write the on-chain data with a null hash (rejected — EAS contract does not support re-writing)
- Try to call the EAS contract's `selfdestruct` (rejected — EAS does not have a `selfdestruct` path; and even if it did, calling it would brick every other user's attestations)
- Just abandon the on-chain entry without revoking (rejected — leaves "active" mirror that is actually deleted in 002; confusing for any future auditor)

**Rationale**: EAS `revoke(uid)` is the only operationally-correct way to invalidate an attestation. The tombstone is the documented EAS semantic; we lean into it explicitly in the UI copy and in the verification page.

---

## D8. Attester key custody: server-side KMS, quarterly rotation

**Decision**: The attester private key (`EAS_ATTESTER_PRIVATE_KEY`) is held in the server-side KMS (Supabase Vault or an equivalent), not in env. The Edge Function signs via the KMS API; the private key never leaves the KMS.

**Key properties**:
1. **No env leak surface** — Edge Function env vars are visible to anyone with `viewer` role on the Supabase project. KMS secrets are not.
2. **Rotation without code deploy** — we can rotate the attester key by updating the KMS secret; the next mirror uses the new key. Old attestations remain valid (EAS attester is per-attestation, not per-key-version).
3. **Audit log of every signing** — KMS can log every signing request, giving us a second-layer audit trail in addition to `chain_mirror_audit`.
4. **Quarterly rotation ceremony** — every 90 days, a new key is generated; the previous key is moved to "retired" status. Mirrors issued under the old key remain valid (we never re-issue); the new key is used for all new mirrors.
5. **2-of-3 multisig option for the master key** — for the next iteration (deferred to v2), we can move to a 2-of-3 multisig where two engineers must approve a rotation.

**What this is NOT**:
- This is *not* a self-custody key. Antarix is the attester. The student is the *recipient*, not the attester. This matches the EAS model: only the attester signs; the recipient is a passive field.
- The student does not have the attester key. The student may have the *recipient* key (self-custody) or may use the platform-custodial recipient path.

**Compromise response**:
1. Flip the master kill-switch (immediate).
2. Audit every mirror since the suspected compromise window.
3. Rotate the attester key.
4. Decide: do we re-mirror the affected credentials under the new key, or do we leave the old ones revoked and require the student to re-request?

**Alternatives considered**:
- Hard-code the key in env (rejected — env is leak-prone; KMS is a marginal cost improvement for a huge security gain)
- Use a hardware wallet (Ledger / Trezor) for the attester key (deferred to v2 — the operational overhead of a hardware signing ceremony in a CI/CD pipeline is non-trivial; KMS is the v1 compromise)
- Use a smart contract wallet (Safe) as the attester (rejected — adds a transaction overhead for every mirror; also, the 2-of-3 multisig is more about who can sign, not about the key material itself)

**Rationale**: KMS is the 2026 default for EAS attester key custody. It removes the env leak risk, enables rotation without redeploy, and gives us a second audit trail. Hardware wallet / Safe multisig are v2 improvements once the feature is in steady state.

---

## D9. Optional 1-claim reputation bonus via `attesterReputation` extension

**Decision**: For VCs with `snapshot_overall_score ≥ 90`, the mirror additionally calls the EAS `attesterReputation` extension contract to issue 1 reputation-bonus claim. This is **opt-out per student** (default ON, toggle in the mirror confirmation dialog).

**Why optional, opt-out (not opt-in)**:
1. **Default behavior should be the high-value path** — for a student mirroring a high-credibility VC, the reputation bonus is a strict improvement (more verifiable signal to EAS aggregators). Opting out requires the student to *want* less visibility, which is the unusual case.
2. **Opt-in would be too conservative** — making the student click an extra checkbox to get the "best" mirror is a UX tax that adds friction to the feature's value proposition.
3. **We tell the student explicitly** — the mirror confirmation dialog explains: "We're also adding a 1-point reputation bonus to this attestation, which signals to EAS aggregators that this is a high-credibility credential. You can opt out."

**What the bonus is**:
- A second EAS attestation with a different schema (`attesterReputation` schema: `"uint8 bonusLevel"`, value 1)
- The bonus attestation's `recipient` is the same as the mirror's recipient
- The bonus attestation's `attester` is the Antarix attested address
- The bonus attestation's data field is `abi.encode(uint8(1))`
- Recorded in `chain_reputation_bonuses`

**Why only 1 claim (not a sliding scale)**:
- Sliding scale (e.g. 1, 2, 3 based on score) would create a moving target for EAS aggregators. A single binary "bonus or no bonus" is easier to interpret.
- The threshold (snapshot ≥ 90) is itself a quality gate; the bonus is a "yes this is a real Antarix high-credibility VC" signal, not a "how good is it" signal.
- We can introduce a sliding scale in v2 if the aggregators want it.

**Alternatives considered**:
- Always issue the bonus, no threshold (rejected — dilutes the signal)
- Issue the bonus on every mirror (rejected — bonus loses meaning if it's universal)
- Make the bonus opt-in (rejected — UX friction; default-ON with explicit disclosure is the better product call)

**Rationale**: The 1-claim bonus is a small, opt-out, opt-in-by-default product feature that adds a clear signal to EAS aggregators for high-credibility VCs, with no privacy cost (no PII, no extra on-chain data beyond the bonus level).

---

## Cross-cutting decisions

- **Migrations land additive (042, 043).** No destructive changes. Each migration is independently reversible. Migration 042 is the schema; 043 is the cron entries (kept separate so the cron can be paused/replayed without affecting the schema).
- **All new edge functions emit structured logs to `supabase.functions.invoke_log`** for the existing observability stack.
- **All new external dispatches (EAS attest, EAS revoke) log to `chain_mirror_audit`** with `actor`, `subject`, `action`, `tx_hash`, `block_number`, `gas_used`, `usd_cost`, `consent_version`, `created_at`.
- **Feature flags via the existing `feature_flags` table** (added in 003): `009_onchain_mirror_enabled` defaults to `false`. The flag is checked at the API layer *and* at the edge function layer (defense in depth).
- **All mirrors are hash-only, no PII on-chain.** This is non-negotiable and is enforced at the canonical-JSON step (the PII strip is part of the hash input; if a developer accidentally adds a PII field to the input, the test `tests/integration/canonical-json.test.ts` fails the build).
- **E2E tests use a local Hardhat node** with the EAS contracts deployed via `@ethereum-attestation-service/contracts`. The schema UID is computed deterministically; the attester key is a known Hardhat account. `pnpm test:e2e -- --grep "onchain"` runs these by default; the `hardhat/` subproject is a new top-level directory.
- **The resolver is a public, unauthenticated route** with rate limiting (default 60 req/min per IP, env-configurable). It does *not* expose PII; it dereferences the revocationPointer to the 002 public page, which is itself public.
