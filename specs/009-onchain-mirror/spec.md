# Feature Specification: 009 — On-Chain Mirror (EAS on Base L2)

**Feature Branch**: `009-onchain-mirror`
**Created**: 2026-06-07
**Status**: Draft
**Migration**: `049_onchain_mirror.sql` (see [data-model.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/009-onchain-mirror/data-model.md) §0 — number reserved; if 042 is occupied at apply time, the file is renamed to the next free slot without changing the spec)
**Builds on**: 001 (foundation) + 002 (W3C Verifiable Credentials + revocation registry) + 003 (engagement) + 004 (defensibility, especially the audit/logging patterns) + 007 (adaptive learning graph; uses similar per-student opt-in patterns)
**Input**: User originally asked for "soulbound NFT" credentials. After a regulatory + cost + utility review (see [research.md](file:///c:/Users/Sharon/OneDrive/Desktop/Anatrix_my/specs/009-onchain-mirror/research.md) §D1), we declined the literal NFT path and scoped this feature as an **optional, hash-only on-chain mirror** of existing 002 W3C VCs onto the Ethereum Attestation Service (EAS) on Coinbase Base L2.

## Why this exists

### What the user originally asked for
"Soulbound NFT credentials" — a popular Web3 framing where each student receives a non-transferable token representing their skill credential. In the abstract, this is an attractive pitch: a globally-resolvable, wallet-bound badge that travels with the student across platforms.

### Why we did NOT ship a literal NFT
1. **DPDP Act (India) erasure conflict** — a literal NFT is a permanent, immutable on-chain record. A student who exercises their DPDP §12 right to erasure cannot be fully forgotten if their identifier (and any PII embedded in the tokenURI) is on-chain. For Indian students this is a hard regulatory floor; a literal NFT collides with it.
2. **Indian crypto-tax headwind** — under the Finance Act 2022 / Section 194BA, transferring any VDA (virtual digital asset), *including a received NFT*, attracts a 30% tax on notional gains and a 1% TDS at source on receipt. Students who "receive" a credential NFT would have to file crypto-tax paperwork for what is, for them, a passive credential. This makes the product legally and reputationally worse than the off-chain alternative.
3. **Employer utility is zero above what 002 already provides** — Indian employers and most global employers in 2026 still verify credentials via signed URLs, email, or QR — not by reading a chain. The 002 W3C VC + public verification page is already 90% of the user value. A literal NFT adds a token-bound shell with no incremental employer adoption.
4. **No off-ramp for the student** — a literal NFT becomes a permanent liability the student has to manage (key custody, wallet loss, chain reorgs). The product would be inheriting a custody story it does not have the support capacity to own.
5. **Gas + UX** — even on L2s, minting per-student tokens costs real money and 2+ wallet signatures the first time. Across 50K students, a literal NFT is ≈$5K-$15K of one-time gas + permanent wallet-burden for marginal user value.

### What the W3C VC + EAS-mirror approach gives us
1. **No PII on-chain** — only a `keccak256` of the canonicalized 002 W3C VC plus a revocation pointer back to the 002 registry. The VC itself stays in 002's existing storage; on-chain is a checksum + pointer.
2. **DPDP-friendly revocation** — EAS has a first-class `revoke(attestation_uid)` semantic. A student's "unmirror" call sets the 002 VC to `revocation_status='revoked'` *and* revokes the on-chain attestation. The on-chain entry becomes a tombstone, not a deletion — explicitly documented as the EAS revocation contract.
3. **EAS reputation portability** — the EAS schema we register is also readable by any EAS-aware dapp (EAS Scan, Farcaster clients, Optimism attestation explorers). A future employer or DAO can verify the credential via EAS, with a backlink to the 002 W3C VC for full detail.
4. **Sub-cent cost per mirror** — Base L2 attestation gas is <$0.01 per write at the time of writing (2026-Q2 base fee < 0.005 gwei). 50K mirrors = roughly $300-$500 in one-time gas.
5. **Optional 1-claim reputation bonus** — high-credibility VCs (snapshot score ≥ 90) can attach an additional `attesterReputation` field, which EAS-aggregator tools can use to weight the attestation. This is opt-in per student.
6. **No student crypto tax exposure** — a *received* EAS attestation is a read-only data record, not a VDA transfer under the Indian Finance Act 2022 framing (no chain movement of a token). The 30% tax + 1% TDS are not triggered. (This is a position supported by 2024-2025 industry legal commentary; legal sign-off is recorded as a launch prerequisite, see FR-CHS-007.)
7. **Behind a kill-switch and per-student opt-in, default OFF** — if any of the above assumptions breaks (regulatory clarification, cost spike, EAS contract bug), a single env flag (`009_onchain_mirror_enabled`) or per-student toggle halts the entire system with zero data loss in 002.

The 002 W3C VC remains the *source of truth*. 009 is a *read-only, optional, mirror*. This framing is what makes the feature shippable in a regulated, employer-facing product.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Student mirrors a verified credential on-chain (Priority: P2)

A final-year CS student at a Tier-2 college in India has 7 verified credentials on their Antarix public profile (DSA problem-solving tier-2, 3 GitHub repos, 2 mock interviews, 1 hackathon). A recruiter at a Web3-native DAO asks for an EAS-verifiable proof of the DSA score. The student visits `/dashboard/credentials`, sees a new "Mirror on-chain" button next to the DSA credential (which has the 002 W3C VC), clicks it, signs a single EIP-4361 (Sign-In with Ethereum) message, and within 30 seconds sees a status row: `Mirrored on Base L2 — attestation 0xabc... — $0.0042 USD gas`. They paste the attestation UID into a Discord channel; the DAO's verifier tool resolves it to "Issued by Antarix, schema W3C-VC-mirror-v1, points to antarix.app/verify/{slug}, snapshot score 87, revocation-status: active." The student can later "Unmirror" and the on-chain entry becomes a tombstone (still resolvable, but shows "revoked").

**Why this is P2**: A genuine *optional* Web3-native path. Not a core recruiting loop; complements 002. Deferred behind a feature flag so we can ship without disrupting the main funnel.

**Independent test**: With `009_onchain_mirror_enabled=true`, `users.onchain_mirror_opt_in=true`, `institutions.onchain_mirror_enabled=true`, mock EAS on a local Hardhat node + a seeded 002 W3C VC, invoke `POST /api/credentials/{id}/onchain`. Assert: `chain_mirror_audit` row with `tx_hash`, `block_number`, `gas_used`, `usd_cost`, `consent_version`; EAS `Attestation` event emitted on the local node; `chain_mirror_queue` row transitions `pending → submitted → confirmed`; `GET /api/credentials/{id}/onchain` returns `attestation_uid`, `explorer_url`, `status: 'confirmed'`.

**Acceptance scenarios**:
1. **Given** a student with a 002 W3C VC for "DSA tier-2" and `users.onchain_mirror_opt_in=true` and the master flag is on, **when** they POST `/api/credentials/{id}/onchain`, **then** within 30s the attestation is confirmed on Base L2, the audit row records the tx hash + block + gas + USD cost, and the credential page shows the mirror status with a "View on EAS Scan" link.
2. **Given** the same student with the master flag OFF, **when** they POST the same endpoint, **then** the response is 503 `kill_switch_active` and no on-chain side effect occurs.
3. **Given** the student has not yet connected a wallet, **when** they click "Mirror on-chain", **then** the UI prompts a Sign-In with Ethereum message and a wallet address is captured to `users.wallet_address` (or `NULL` for platform-custodial path — see US1.4 below).
4. **Given** the student is on a low-end phone with no wallet app, **when** they opt in, **then** the system offers "Antarix-custodial address" which uses a per-student derived EOA from a single platform key (HD-wallet-style, key never leaves the server-side KMS). The attestation's `recipient` is the derived address. The student can export the private key to their own wallet later.
5. **Given** a student mirrors a credential with `snapshot_overall_score ≥ 90`, **when** the mirror completes, **then** the attestation includes an additional `attesterReputation` field with value 1 (a single bonus claim issued by `chain_reputation_bonuses`), readable by EAS aggregators.
6. **Given** the mirror queue's first attempt fails with a gas-price spike error, **when** the cron retries with exponential backoff (max 5 attempts over 24h), **then** the eventual successful mirror records all failed attempts in `chain_mirror_audit` with `attempt_index` and `error_message`.

---

### User Story 2 — Recruiter verifies an on-chain attestation end-to-end (Priority: P2)

A DAO recruiter receives a candidate's attestation UID over Discord. They paste `https://antarix.app/verify/onchain/0xabc...` into a browser tab. The page resolves the attestation on Base L2 via the public Base RPC (no Antarix auth required), reads the `revocationPointer` field, and follows it to `antarix.app/verify/{slug}` (the 002 public page). The page renders a unified view: a green "Issued by Antarix attested address 0xATTESTER" banner, a "Mirrored VC: DSA tier-2 — snapshot score 87" card, the canonical W3C VC JSON in a collapsible drawer, the on-chain transaction hash with a Basescan link, the timestamp + block number, and the current 002 revocation status (active/revoked). If the 002 credential is revoked, the on-chain status shows "Tombstoned — VC revoked on 2026-06-07" (never deleted). The recruiter can independently verify the EAS attestation via EAS Scan or via Antarix — both paths must agree.

**Why this is P2**: This is the actual *user value* of 009. Without a public, fast, no-auth resolution path, mirroring is theatre. US2 is what makes the mirror load-bearing for Web3-native hiring.

**Independent test**: With a confirmed mirror in the local Hardhat + a seeded 002 VC, hit `GET /verify/onchain/{attestation_uid}` with no auth. Assert: 200 response with `attested_by`, `revocation_pointer` (resolves to 002 slug), `snapshot_score`, `chain_status`, `vc_status`, `transaction_url`, `block_number`, `attested_at`. Then revoke the 002 VC via the existing 002 endpoint; refetch the same URL; assert the response shows `chain_status: 'revoked'` and `vc_status: 'revoked'` with `tombstoned_at` set.

**Acceptance scenarios**:
1. **Given** a confirmed EAS attestation pointing to a 002 VC with `revocation_status='active'`, **when** anyone hits `GET /verify/onchain/{attestation_uid}`, **then** the page resolves in <2s and shows the unified view with EAS + 002 data agreeing.
2. **Given** a recruiter is on the Antarix company dashboard, **when** they view a saved candidate, **then** if the candidate has opted-in to on-chain mirroring, a "Has on-chain mirror" badge appears with the count of mirrors and the latest attestation's EAS Scan link.
3. **Given** the 002 VC is revoked after mirroring, **when** the public page is re-resolved, **then** it shows "Tombstoned — VC revoked at {timestamp}" with the revocation-pointer nullified (the `data` field is unchanged, the `revoked` boolean is true in the EAS contract).
4. **Given** the page is hit with an unknown attestation UID, **when** the resolver looks it up, **then** the response is 404 with a "Not found on Base L2" message (not a server error).
5. **Given** the page is hit while Base L2 RPC is unreachable, **when** the resolver times out, **then** it returns 503 with `Retry-After: 30` and a cached `last_successful_resolution` timestamp in the body.

---

### User Story 3 — Kill-switch + per-student + per-tenant consent + audit (Priority: P3)

A student at a partner college decides they no longer want their credentials mirrored on-chain (their wallet got compromised; they're concerned about future regulation; the college has changed its policy). They visit `/dashboard/settings/onchain-mirror` and click "Unmirror all". Within 60 seconds, all of their active on-chain attestations are revoked in EAS, all `chain_mirror_queue` rows are marked `cancelled`, and the `chain_mirror_audit` log gains one row per attestation with `action='unmirror'`. Their 002 W3C VCs are unaffected (remains the source of truth). Separately, the college admin toggles "Disable on-chain mirror for this institution" in `/college/admin/onchain-policy`, and the system prevents any new mirrors for students at that college. The Antarix ops team can additionally flip `009_onchain_mirror_enabled=false` (master flag) to halt every new mirror globally; in-flight mirrors complete but no new ones are submitted.

**Why this is P3**: Regulatory + trust plumbing. Essential for shipping to a regulated audience, but not directly user-facing value. P3 means we *must* ship the kill-switches in v1, but the rich compliance UI can iterate.

**Independent test**: With a student having 3 confirmed mirrors, POST `DELETE /api/credentials/{id}/onchain` for each. Assert: 3 `chain_mirror_audit` rows with `action='unmirror'` + `tx_hash` + `consent_version`; EAS `Revoked` event emitted for each on local Hardhat; `chain_mirror_queue` rows marked `cancelled`; 002 W3C VC's `revocation_status` is unchanged (mirror-only). Then set the per-tenant flag to disabled; assert a new mirror attempt is rejected with 403 `tenant_disabled`. Then set the master flag off; assert a new mirror attempt is rejected with 503 `kill_switch_active`.

**Acceptance scenarios**:
1. **Given** a student with ≥ 1 confirmed mirror, **when** they POST `DELETE /api/credentials/{id}/onchain`, **then** the on-chain attestation is revoked within 30s and the audit log records the revocation tx hash + gas + USD cost.
2. **Given** a student uses the "Unmirror all" button in settings, **when** the operation completes, **then** every active mirror for that student is revoked and a single `chain_mirror_audit` row with `action='bulk_unmirror'` records the batch.
3. **Given** a college admin toggles the per-tenant flag to disabled, **when** any student at that college attempts a new mirror, **then** the response is 403 `tenant_disabled` and the audit log records `action='denied_tenant_disabled'`.
4. **Given** the master flag is flipped to OFF, **when** any in-flight `chain_mirror_queue` row is processed, **then** rows already in `submitted` state complete, but no new rows transition to `submitted`; the audit log shows `action='kill_switch_engaged'`.
5. **Given** a student toggles `users.onchain_mirror_opt_in` to false, **when** they revisit the credentials page, **then** the "Mirror on-chain" CTA is hidden, and a previous unmirror is idempotent (re-issuing the request returns 200 with `status: 'already_revoked'`).
6. **Given** a student with a platform-custodial wallet requests a key export, **when** they confirm via email 2FA, **then** the system exports the derived EOA private key as a one-time downloadable file and rotates the platform-custodial key on the next mirror attempt.

---

### Edge Cases

- **Attestation UID typo on the public page** → Return 404, not 500; log the failed lookup to `chain_mirror_audit` with `action='resolution_failed'`.
- **Base L2 RPC outage during a mirror** → Queue row stays in `pending`; cron retries with exponential backoff; UI shows "Mirror queued — waiting for network".
- **Gas price spike above threshold** → Cron skips the submission and requeues for the next low-gas window; alert the Antarix ops Slack if it skips > 6 hours.
- **EAS schema is upgraded (v1 → v2)** → Old attestations remain readable; new mirrors use the new schema UID. Resolver detects schema version from the on-chain read and surfaces a "Schema v1 (legacy)" badge.
- **EAS contract is paused or upgraded on Base** → Resolver surfaces a clear "EAS contract unavailable" error; no silent failures.
- **Student deletes their 002 account (DPDP §12 erasure)** → All their `chain_mirror_queue` rows are cancelled, all their EAS attestations are revoked via the bulk-unmirror path, and the audit log records the deletion trigger. The on-chain entries remain as tombstones (revoked, not deleted) per EAS contract semantics — explicitly disclosed in the student's deletion confirmation UI.
- **Wallet address is reused by a different student (sanctioned-list re-use, key rotation mistake)** → Resolver does not dereference the recipient; it dereferences the `revocationPointer` to the 002 slug, which is the source of truth. Two students cannot accidentally share a credential.
- **Tenant opt-in after a student has already mirrored** → Mirror stands; future mirrors blocked; no retroactive revocation (per the policy that consent once-given is not auto-revoked by tenant — only by student action).
- **Hardhat local node drift in tests** → E2E tests reset the local node + redeploy EAS contracts in beforeAll; the schema UID is computed deterministically from the schema string.
- **Clock skew between the attester's signing time and the on-chain block timestamp** → Display the on-chain `block.timestamp` (not the local signing time) on the verification page.
- **The student-supplied wallet does not match the recipient on-chain** → This should never happen by construction (we encode the recipient ourselves); if it does, raise a critical alert — the attester key may be compromised.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Mirroring (US1)
- **FR-CHM-001**: System MUST allow a student to mirror an existing 002 W3C VC onto EAS on Base L2, provided the master, per-tenant, and per-student flags are all enabled.
- **FR-CHM-002**: The on-chain attestation's `data` field MUST be `abi.encode(bytes32 vcHash, string revocationPointer, uint64 scoreSnapshot)`, where `vcHash = keccak256(canonicalJSON(vcWithoutPII))`.
- **FR-CHM-003**: The `vcHash` input MUST be computed from a canonicalization of the 002 W3C VC with all PII removed (no display name, no email, no eth-address, no institution name) — only the credential type, snapshot score, snapshot timestamp, and per-skill proficiency scores.
- **FR-CHM-004**: The on-chain attestation's `recipient` MUST be either (a) the student-supplied EOA from a Sign-In with Ethereum message, or (b) a per-student derived EOA from the Antarix-custodial HD wallet path, with the derivation path recorded in `chain_mirror_consents.custodial_derivation_path`.
- **FR-CHM-005**: The `attester` MUST be the Antarix attested address held in env (`EAS_ATTESTER_ADDRESS_BASE`) and signed with `EAS_ATTESTER_PRIVATE_KEY` (stored in the server-side KMS, never in env at the Edge Function level).
- **FR-CHM-006**: The on-chain `revocationPointer` MUST be the 002 W3C VC public slug (e.g. `sharon-dave-7q3x`) — resolvable to `https://antarix.app/verify/{slug}`.
- **FR-CHM-007**: Mirrors MUST cost less than USD $0.01 per attestation at the time of submission; submissions MUST be deferred to a low-gas window if the current gas price would push cost over $0.02.
- **FR-CHM-008**: If the 002 W3C VC's `snapshot_overall_score ≥ 90`, the mirror MUST additionally call the `attesterReputation` extension contract (see FR-CHM-014) to issue 1 reputation bonus claim, recorded in `chain_reputation_bonuses`.
- **FR-CHM-009**: Every mirror attempt — success or failure — MUST write one row to `chain_mirror_audit` with `tx_hash`, `block_number`, `gas_used`, `usd_cost` (computed from the on-chain `effectiveGasPrice` and a USD-equivalent from the gas oracle), `consent_version`, and `attempt_index`.
- **FR-CHM-010**: The mirror queue (`chain_mirror_queue`) MUST retry with exponential backoff (1m, 5m, 25m, 2h, 12h) up to 5 attempts, then transition to `dead_letter` and alert the Antarix ops Slack.

#### Verification (US2)
- **FR-CHM-011**: System MUST expose `GET /verify/onchain/{attestation_uid}` (no auth) that resolves the EAS attestation on Base L2 via the public Base RPC, fetches the `revocationPointer`, resolves it to the 002 W3C VC, and renders a unified view.
- **FR-CHM-012**: The unified view MUST show `attested_by` (EAS attester address), `attested_at` (block timestamp), `block_number`, `transaction_url` (Basescan link), `chain_status` (active/revoked), `vc_status` (from 002 revocation_status), `snapshot_score`, `credential_type`, and a collapsible drawer with the full 002 W3C VC JSON.
- **FR-CHM-013**: Recruiters viewing a candidate on the company dashboard MUST see a "Has on-chain mirror" badge (with mirror count and latest attestation link) if and only if the candidate has at least one confirmed mirror.

#### Kill-switch + consent + audit (US3)
- **FR-CHM-014**: System MUST respect three independent gates, in order: (a) master env flag `009_onchain_mirror_enabled` (default false); (b) per-tenant flag `institutions.onchain_mirror_enabled` (default true, but college admin can disable); (c) per-student flag `users.onchain_mirror_opt_in` (default false). All three must be true to permit a new mirror.
- **FR-CHM-015**: System MUST allow a student to POST `DELETE /api/credentials/{id}/onchain` to revoke a single mirror, and provide a "Unmirror all" bulk action that revokes every active mirror for that student in a single batch transaction (or sequentially if batch is not supported by the EAS contract).
- **FR-CHM-016**: On revocation, the on-chain attestation MUST be marked `revoked` (EAS `revoke(attestation_uid)`); the 002 W3C VC's `revocation_status` MUST remain `active` (the 002 source of truth is unaffected by mirror-only revocation).
- **FR-CHM-017**: Every consent grant / revoke / tenant-disable / master-disable / bulk-unmirror MUST write a `chain_mirror_audit` row with `action` ∈ (`'mirror'`, `'unmirror'`, `'bulk_unmirror'`, `'consent_granted'`, `'consent_revoked'`, `'denied_tenant_disabled'`, `'denied_kill_switch'`, `'resolution_failed'`, `'kill_switch_engaged'`, `'unmirror_post_deletion'`).
- **FR-CHM-018**: The `consent_version` recorded in every audit row MUST be the current `chain_mirror_consent_policy.version` at the time of the action (e.g. v1.0, v1.1) — so the audit log carries proof of which policy the user consented to.

#### Wallet + key custody
- **FR-CHM-019**: If the student chooses platform-custodial keys, the system MUST derive a unique EOA per (student_id, chain_id) using BIP-44 with `m/44'/60'/0'/0/{index}` from a single platform seed held in the server-side KMS.
- **FR-CHM-020**: The platform-custodial private key MUST be exportable by the student to their own wallet, after email 2FA confirmation; the export is one-time and the system rotates to a new derived address on the next mirror attempt.

#### Schema registration (one-time)
- **FR-CHM-021**: On first deploy, the system MUST register the EAS schema string `"bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot"` on Base L2 via the EAS SchemaRegistry contract; the resulting `schema_uid` MUST be stored in env `EAS_SCHEMA_UID_BASE` and in a `chain_mirror_schema` table for audit.
- **FR-CHM-022**: If the schema is upgraded (v1 → v2), the system MUST register the new schema, support reads of both via the EAS contract, and mark the old schema as `superseded` in the audit log.

#### Reputation bonus (optional)
- **FR-CHM-023**: For VCs with `snapshot_overall_score ≥ 90`, the system MUST additionally call the `EAS_AttesterReputation` extension contract to issue a separate one-time reputation-bonus attestation (`attesterReputation` schema: `"uint8 bonusLevel"` with value 1), recorded in `chain_reputation_bonuses`. This is opt-out per student via a UI toggle in the mirror confirmation dialog.

#### Cost & gas
- **FR-CHM-024**: The mirror cron MUST use a gas oracle (env `GAS_ORACLE_URL`, default: public Base RPC's `eth_gasPrice`) to compute the projected USD cost before each submission; if cost > $0.02, the submission is deferred to the next 10-minute window.
- **FR-CHM-025**: The mirror cron MUST run every 5 minutes; the bulk-unmirror cron MUST run every 15 minutes.

### Key Entities

- **chain_mirror_audit** — immutable log of every mirror-related action: mirror, unmirror, bulk_unmirror, consent_granted, consent_revoked, denied_tenant_disabled, denied_kill_switch, resolution_failed, kill_switch_engaged, unmirror_post_deletion. Columns: `id`, `student_id`, `institution_id`, `credential_id` (FK 002), `attestation_uid`, `tx_hash`, `block_number`, `gas_used`, `effective_gas_price_wei`, `usd_cost`, `consent_version`, `action`, `attempt_index`, `error_message`, `created_at`. Append-only; RLS: student sees own; service role full.
- **chain_mirror_queue** — the per-mirror work queue: one row per requested mirror, lifecycle `pending → submitted → confirmed | failed | cancelled | dead_letter`. Columns: `id`, `student_id`, `credential_id`, `attestation_uid` (nullable until confirmed), `status`, `next_attempt_at`, `attempt_count`, `last_error`, `created_at`, `confirmed_at`. RLS: student sees own; service role full.
- **chain_mirror_consents** — the per-student, versioned consent grant: which `consent_version` the student agreed to, the timestamp, the IP, the user agent, the wallet type (self / platform-custodial), and the custodial derivation path. Columns: `id`, `student_id`, `consent_version`, `granted_at`, `revoked_at`, `wallet_type`, `wallet_address`, `custodial_derivation_path`, `consent_text_hash`, `ip_hash`, `user_agent`. RLS: student sees own; service role full.
- **chain_mirror_revocations** — the tombstone of every unmirror: links the 002 VC to the EAS attestation at the moment of revocation, for compliance audit. Columns: `id`, `audit_id` (FK chain_mirror_audit), `attestation_uid`, `revoke_tx_hash`, `block_number`, `revoked_at`, `reason` (`'user_request' | 'deletion' | 'tenant_disabled' | 'kill_switch'`). RLS: student sees own; service role full.
- **chain_reputation_bonuses** — the optional 1-claim reputation bonus issued for high-credibility VCs. Columns: `id`, `student_id`, `credential_id`, `bonus_attestation_uid`, `bonus_level` (always 1 in v1), `attester_reputation_contract`, `issued_at`. RLS: student sees own; service role full.
- **chain_mirror_schema** — the registered EAS schema on Base L2: `id`, `version` (`'v1' | 'v2' | ...`), `schema_string`, `schema_uid` (bytes32), `registered_tx_hash`, `registered_at`, `status` (`'active' | 'superseded' | 'replaced'`), `registered_by`. RLS: read-only for all authenticated; insert via service role only.

### Out of Scope (Deferred to v2 or explicitly declined)

1. **Literal "soulbound" NFTs (ERC-5114 / 721 with bound soul)** — explicitly declined; the W3C + EAS mirror approach is the regulatory-safe path (see top of this spec).
2. **Multi-chain mirror (EAS on Optimism, Arbitrum, Polygon, Avalanche)** — deferred; Base is the single chain for v1. The resolver, queue, and audit tables are designed chain-agnostic and can extend to additional `chain_id` values without schema changes.
3. **Self-attestations from students** — explicitly declined; only Antarix (the attested address) can issue mirror attestations. Student-side claims would invite Sybil / impersonation and break the recruiter trust contract.
4. **Mirror of non-002 credentials (GitHub, DSA, etc.)** — out of scope. Only 002 W3C VCs can be mirrored; raw signals are off-chain-only by design.
5. **On-chain revocation with a payload hash pointer** — EAS does not support updating the data field of a revoked attestation; we accept the tombstone semantics rather than re-writing (which is not possible).
6. **Soul-bound token integration for employers (employer issues, student holds)** — explicit no; this would invert the regulatory and product positioning.
7. **Mirror of a deleted VC** — already handled by the unmirror path; we do not allow a "mirror" of a `revocation_status='revoked'` VC.

## Success Criteria *(mandatory, measurable)*

### Measurable Outcomes

- **SC-CHM-001**: ≥ 5% of students with ≥ 1 verified W3C VC opt in to on-chain mirroring within 60 days of feature launch (with cohort rollout; the goal is to validate the *opt-in* flow, not the conversion).
- **SC-CHM-002**: Mirror submission success rate (confirmed ÷ attempted, excluding opt-outs and tenant-disabled) ≥ 98% over a rolling 30-day window.
- **SC-CHM-003**: Median cost per confirmed mirror < $0.01 USD; 95th-percentile cost < $0.02 USD.
- **SC-CHM-004**: `GET /verify/onchain/{attestation_uid}` p95 resolution time < 2 seconds at 1K req/min.
- **SC-CHM-005**: Zero P0 incidents (PII leak, incorrect revocation, attester key compromise) in the 90 days post-launch. Attester key is rotated quarterly; rotation ceremony is documented in the runbook.
- **SC-CHM-006**: DPDP / SOC2 audit of `chain_mirror_audit` can demonstrate consent provenance for 100% of active mirrors within 1 business day.
- **SC-CHM-007**: When the master kill-switch is flipped, the system reaches a "no new mirrors in flight" steady state within 5 minutes; this is verified by a chaos-test in the pre-launch gate.
- **SC-CHM-008**: 100% of post-DPDP-deletion students have all of their EAS attestations revoked within 1 hour of `users.deletion_requested_at` being set.

## Assumptions

- The 002 W3C VC infrastructure (migration 022, `verifiable_credentials` table, `/verify/{slug}` public page, revocation flow) is stable, in production, and follows the W3C VC Data Model 2.0 spec. 009 *extends* but does not modify 002.
- The EAS contract on Base L2 (EAS `0x420...0007` / SchemaRegistry `0x420...0008` at the time of writing) is the canonical EAS deployment; we treat it as a stable external dependency. Schema-UID upgrades (EAS v0.3 → v1.0 etc.) are handled by FR-CHM-022.
- Coinbase Base L2 gas prices remain in the 0.001-0.01 gwei range for attestation writes; a sustained price spike > 0.1 gwei for > 24h is a P1 alert.
- Students who self-custody a wallet can use any EIP-191 / EIP-4361 compatible signer (MetaMask, Rabby, Frame, Coinbase Wallet, WalletConnect v2). The platform-custodial path is the fallback for low-end Android without a wallet app.
- The Indian regulatory position that a *received* EAS attestation is not a "transfer of a virtual digital asset" under Section 194BA / 2(47A) holds for the duration of the feature's lifetime. We re-confirm with legal counsel at every quarterly attester-key-rotation cycle.
- No employer currently requires a literal on-chain NFT — the 002 W3C VC + public page + EAS mirror together exceed any current employer's request. The killer-question "do you have an NFT version?" is one we can answer with "yes, but the source of truth is the W3C VC; the chain is a mirror."
- The mirror cron runs on the existing Supabase cron infrastructure (from 001); we add a single new cron entry for `chain-mirror-dispatcher` and `chain-mirror-unmirror-dispatcher`.

## Out-of-Scope Exits

If any of the following signals fires, the master kill-switch is the default response (per FR-CHM-014):

- Regulatory clarification in India, EU MiCA, or US that EAS attestations are VDAs / NFTs / securities → flip master flag, do not re-enable.
- EAS contract on Base is paused, exploited, or replaced → flip master flag, route to EAS on a different chain (if and when a fallback is configured).
- Median attestation cost > $0.05 for > 7 days → flip master flag, revisit when costs normalize.
- Attester private key compromise or unauthorized use → flip master flag, rotate key, audit every action taken since the suspected compromise window.
