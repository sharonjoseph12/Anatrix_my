# API Contracts: 009 — On-Chain Mirror (EAS on Base L2)

**Date**: 2026-06-07
**Status**: Phase 1 design ratified
**Builds on**: `specs/002-antarix-definitive-vision/contracts/api.md` (W3C VC public page) and `specs/004-eleven-of-ten/contracts/api.md` (audit logging patterns)

Two API surfaces: **internal** (Next.js API routes + Supabase Edge Functions, Supabase-auth-gated, RLS-enforced, plus the kill-switch gate) and **public** (the `/verify/onchain/{attestation_uid}` page, no auth, rate-limited per IP).

All endpoints respect the 3-gate kill-switch in this order: **master** (`009_onchain_mirror_enabled`) → **tenant** (`institutions.onchain_mirror_enabled`) → **student** (`users.onchain_mirror_opt_in`).

---

## Internal: On-Chain Mirror

### `POST /api/credentials/{id}/onchain`

Request a mirror of an existing 002 W3C VC onto EAS on Base L2. Returns immediately with a queue status; the actual on-chain submission happens asynchronously via the `chain-mirror-dispatcher` cron.

**Request body**:
```json
{
  "wallet_choice": "self_custody" | "platform_custodial",
  "siwe_message"?: "string (required if wallet_choice='self_custody')",
  "siwe_signature"?: "0x... (required if wallet_choice='self_custody')",
  "include_reputation_bonus"?: true,
  "consent_version": "v1.0"
}
```

**Auth**: Student session (must own the 002 VC `{id}`). `consent_version` defaults to the current `CHAIN_MIRROR_CONSENT_VERSION` env.

**Gates evaluated** (in order):
1. `009_onchain_mirror_enabled` env → if false: `503 kill_switch_active`
2. `institutions.onchain_mirror_enabled` for the student's college → if false: `403 tenant_disabled`
3. `users.onchain_mirror_opt_in` for the student → if false: `403 opt_in_required`
4. 002 VC `revocation_status='active'` → if revoked: `409 vc_revoked`
5. No in-flight mirror for the same VC → if exists: `409 already_mirroring`
6. Cost projection (gas oracle) > `$0.02` → if so: `503 gas_too_high` (caller should retry after 10 min)

**Response 202** (accepted, queued):
```json
{
  "queue_id": "uuid",
  "status": "pending",
  "credential_id": "uuid",
  "consent_version": "v1.0",
  "wallet_address": "0x...",
  "estimated_usd_cost": 0.0042,
  "next_attempt_at": "2026-06-07T12:05:00Z"
}
```

**Side effects**:
- INSERT into `chain_mirror_queue` with `status='pending'`, `next_attempt_at=now()`.
- INSERT into `chain_mirror_audit` with `action='consent_granted'`, `consent_version=v1.0`.
- INSERT into `chain_mirror_consents` if no active consent exists for the student + version.

**Errors**:
- `400 invalid_input` (missing `siwe_message` for self_custody; bad consent_version)
- `401 unauthorized` (no session)
- `403 opt_in_required` (student has not opted in)
- `403 tenant_disabled` (college has disabled on-chain mirror)
- `403 wallet_invalid` (SIWE signature did not verify)
- `404 vc_not_found` (VC does not exist or student does not own it)
- `409 vc_revoked` (the 002 VC is already revoked)
- `409 already_mirroring` (a `pending` or `submitted` queue row already exists for this VC)
- `503 kill_switch_active` (master flag off)
- `503 gas_too_high` (current gas price would push cost over $0.02)
- `429 rate_limited` (more than 10 POSTs per student per hour)

---

### `GET /api/credentials/{id}/onchain`

Get the current mirror status for an existing 002 W3C VC.

**Auth**: Student session (must own the VC) or recruiter session (if the student's profile is public).

**Response 200**:
```json
{
  "credential_id": "uuid",
  "status": "not_mirrored" | "pending" | "submitted" | "confirmed" | "failed" | "cancelled" | "dead_letter",
  "attestation_uid"?: "0x...",
  "transaction_hash"?: "0x...",
  "block_number"?: 12345678,
  "gas_used"?: 80000,
  "usd_cost"?: 0.0042,
  "consent_version"?: "v1.0",
  "chain_explorer_url"?: "https://basescan.org/tx/0x...",
  "resolver_url"?: "https://antarix.app/verify/onchain/0x...",
  "attested_at"?: "2026-06-07T12:00:30Z",
  "revoked_at"?: null,
  "attempts": 1,
  "last_error"?: null,
  "reputation_bonus"?: {
    "bonus_attestation_uid": "0x...",
    "issued_at": "2026-06-07T12:00:35Z"
  }
}
```

**Errors**:
- `401 unauthorized`
- `404 vc_not_found`
- `403 forbidden` (recruiter without public-profile access)

---

### `DELETE /api/credentials/{id}/onchain`

Revoke the on-chain mirror for an existing 002 W3C VC. Calls EAS `revoke(attestation_uid)`. The 002 W3C VC's `revocation_status` is **unchanged** (mirror-only revocation).

**Auth**: Student session (must own the VC).

**Request body** (optional):
```json
{
  "reason"?: "user_request" | "tenant_disabled" | "kill_switch"  // defaults to 'user_request'
}
```

**Response 202** (accepted, queued for revocation):
```json
{
  "queue_id": "uuid",
  "status": "pending",
  "attestation_uid": "0x...",
  "estimated_usd_cost": 0.0008,
  "next_attempt_at": "2026-06-07T12:15:00Z"
}
```

**Side effects**:
- INSERT into `chain_mirror_queue` (or a parallel `chain_unmirror_queue` view) with `action='unmirror'`, `status='pending'`.
- INSERT into `chain_mirror_audit` with `action='unmirror'`, `consent_version=v1.0`.

**Errors**:
- `401 unauthorized`
- `404 mirror_not_found` (no confirmed mirror exists for this VC)
- `409 already_revoked` (the on-chain attestation is already revoked; idempotent — returns 200 with `status='already_revoked'`)
- `503 kill_switch_active` (master flag off — but in-flight unmirrors still complete)

**Note**: This endpoint is idempotent. A second DELETE on the same VC returns 200 with `status='already_revoked'`.

---

### `POST /api/onchain/consent`

Grant or revoke the per-student on-chain mirror consent. Called by the settings UI when the student toggles `users.onchain_mirror_opt_in`.

**Auth**: Student session.

**Request body** (POST = grant):
```json
{
  "consent_version": "v1.0",
  "wallet_choice": "self_custody" | "platform_custodial",
  "siwe_message"?: "string (required if wallet_choice='self_custody')",
  "siwe_signature"?: "0x... (required if wallet_choice='self_custody')"
}
```

**Response 200**:
```json
{
  "consent_id": "uuid",
  "consent_version": "v1.0",
  "granted_at": "2026-06-07T12:00:00Z",
  "wallet_address": "0x...",
  "wallet_type": "self_custody"
}
```

**Side effects**:
- INSERT into `chain_mirror_consents`.
- UPDATE `users.onchain_mirror_opt_in = true` (or `false` on DELETE).
- UPDATE `users.wallet_address` (if self_custody) or allocate a new `custodial_address_index`.
- INSERT into `chain_mirror_audit` with `action='consent_granted'` (or `consent_revoked`).

### `DELETE /api/onchain/consent`

Revoke consent. Triggers a bulk-unmirror of all active mirrors for the student.

**Response 200**:
```json
{
  "consent_revoked_at": "2026-06-07T12:00:00Z",
  "active_mirrors_revoked": 3,
  "bulk_unmirror_queue_id": "uuid"
}
```

**Side effects**:
- UPDATE `users.onchain_mirror_opt_in = false`.
- For each confirmed mirror, INSERT into `chain_mirror_queue` with `action='bulk_unmirror'`.
- INSERT into `chain_mirror_audit` with `action='consent_revoked'`, plus one `bulk_unmirror` row.

---

### `POST /api/onchain/wallet/connect`

Connect a self-custody wallet via SIWE. The endpoint is reachable for any student, but the resulting `wallet_address` is only persisted to `users.wallet_address` after `POST /api/onchain/consent` is called (so we don't pollute the user record with unverified addresses).

**Request body**:
```json
{
  "siwe_message": "antarix.app wants you to sign in with your Ethereum account:\n0x...",
  "siwe_signature": "0x..."
}
```

**Response 200**:
```json
{
  "wallet_address": "0x...",
  "siwe_verified_at": "2026-06-07T12:00:00Z"
}
```

**Errors**:
- `400 invalid_input`
- `403 wallet_invalid` (SIWE signature verification failed; or nonce reused; or message is older than 5 minutes)

---

### `POST /api/onchain/wallet/export`

Export the platform-custodial EOA private key to the student's own wallet. Gated by email 2FA.

**Request body**:
```json
{
  "email_2fa_code": "123456",
  "destination_address"?: "0x... (if non-null, the system will also send a 0-value tx to this address to 'prove' the key on-chain)"
}
```

**Response 200** (one-time; client must store):
```json
{
  "private_key": "0x... (raw, NOT a keystore)",
  "wallet_address": "0x...",
  "derivation_path": "m/44'/60'/0'/0/123",
  "expires_at": "2026-06-07T12:05:00Z"
}
```

**Side effects**:
- INSERT into `chain_mirror_audit` with `action='consent_granted'`, `consent_version=v1.0` (the export itself is treated as a re-grant of consent with a new wallet_address).
- A new `custodial_address_index` is allocated for any future mirrors; the old index is marked retired in the audit log.

**Errors**:
- `401 unauthorized`
- `403 wallet_invalid` (2FA code invalid or expired)
- `404 no_custodial_wallet` (the student never had a platform-custodial wallet)
- `410 export_expired` (the one-time download window passed)

---

### `GET /api/onchain/policy`

Read the current kill-switch state for the calling student.

**Auth**: Any authenticated user.

**Response 200**:
```json
{
  "master_enabled": false,
  "tenant_enabled": true,
  "student_opted_in": true,
  "can_mirror": false,
  "block_reason": "kill_switch_active" | "tenant_disabled" | "opt_in_required" | null
}
```

### `PATCH /api/onchain/policy`

Update the per-tenant flag (institution admin only). Master flag is env-only; per-student flag is set via `/api/onchain/consent`.

**Auth**: Institution admin session.

**Request body**:
```json
{
  "institution_id": "uuid",
  "onchain_mirror_enabled": false
}
```

**Response 200**:
```json
{
  "institution_id": "uuid",
  "onchain_mirror_enabled": false,
  "updated_at": "2026-06-07T12:00:00Z"
}
```

**Side effects**:
- UPDATE `institutions.onchain_mirror_enabled`.
- INSERT into `chain_mirror_audit` with `action='denied_tenant_disabled'` (or `'re-enabled'` if toggling back).

---

## Internal: Cron (Edge Functions)

### `chain-mirror-dispatcher` (every 5 min)

Walks `chain_mirror_queue` for rows with `status IN ('pending', 'failed')` AND `next_attempt_at <= now()`. For each row:
1. Re-evaluates the 3-gate kill-switch.
2. Fetches gas price; computes projected cost; defers if over threshold.
3. Computes `vcHash` from the 002 VC (canonical-JSON, PII-stripped).
4. Signs and submits `EAS.attest({ schema, data: abi.encode(vcHash, revocationPointer, scoreSnapshot), recipient })`.
5. On confirmation, UPDATE the queue row to `status='confirmed'`, INSERT into `chain_mirror_audit` with `action='mirror'`.
6. On failure, UPDATE `attempt_count++`, set `next_attempt_at` per exponential backoff (1m, 5m, 25m, 2h, 12h), or transition to `status='dead_letter'` after 5 attempts.

Not externally callable.

### `chain-unmirror-dispatcher` (every 15 min)

Walks the unmirror queue (rows marked for revocation). For each row:
1. Fetches the existing attestation.
2. Signs and submits `EAS.revoke({ schema, uid })`.
3. On confirmation, INSERT into `chain_mirror_revocations` + `chain_mirror_audit` with `action='unmirror'`.

Not externally callable.

### `chain-mirror-resolver` (public, rate-limited)

Called by `GET /verify/onchain/{attestation_uid}`. Reads the EAS attestation from Base L2 via the public Base RPC, dereferences the `revocationPointer` to the 002 public page, and returns a unified view JSON. Not auth-gated; rate-limited to 60 req/min per IP.

---

## Public: `/verify/onchain/{attestation_uid}` (no auth)

### `GET /verify/onchain/{attestation_uid}`

Public, unauthenticated resolution of an on-chain attestation. Returns HTML by default (the recruiter-friendly page) or JSON if `Accept: application/json`.

**Auth**: None.

**Rate limit**: 60 req/min per IP (env `ONCHAIN_RESOLVER_RATE_LIMIT_RPM`).

**Response 200** (HTML — the recruiter-friendly page):
A server-rendered page that shows:
- A "Mirrored on Base L2 by Antarix attested address 0xATTESTER" banner
- The 002 W3C VC summary card (credential type, snapshot score, snapshot taken at)
- A collapsible drawer with the full 002 W3C VC JSON
- The on-chain transaction hash with a Basescan link
- The block number + block timestamp
- The current 002 revocation status (active / revoked)
- The EAS schema version (v1 / v2)

**Response 200** (JSON — for API consumers):
```json
{
  "attestation": {
    "uid": "0xabc...",
    "schema_uid": "0xdef...",
    "schema_version": "v1",
    "attester": "0xATTESTER",
    "recipient": "0xRECIPIENT",
    "attested_at": "2026-06-07T12:00:30Z",
    "block_number": 12345678,
    "transaction_hash": "0x...",
    "transaction_url": "https://basescan.org/tx/0x...",
    "revoked": false,
    "data": {
      "vcHash": "0x...",
      "revocationPointer": "sharon-dave-7q3x",
      "scoreSnapshot": 87
    }
  },
  "vc": {
    "slug": "sharon-dave-7q3x",
    "public_url": "https://antarix.app/verify/sharon-dave-7q3x",
    "credential_type": "DSA tier-2",
    "snapshot_overall_score": 87,
    "snapshot_taken_at": "2026-06-04T02:00:00Z",
    "revocation_status": "active",
    "per_skill": [
      { "name": "Machine Learning", "proficiency": 87 }
    ],
    "cohort_percentile": 95
  },
  "chain_status": "active",
  "vc_status": "active",
  "tombstoned_at": null,
  "reputation_bonus": {
    "uid": "0x...",
    "issued_at": "2026-06-07T12:00:35Z"
  } | null,
  "resolved_at": "2026-06-07T12:01:00Z"
}
```

**If the 002 VC is revoked** (and the on-chain is still active):
```json
{
  "attestation": { ... "revoked": false ... },
  "vc": { ... "revocation_status": "revoked" ... },
  "chain_status": "active",
  "vc_status": "revoked",
  "disclosure": "VC revoked at 2026-06-08T10:00:00Z. The on-chain mirror is still active; the 002 source of truth is revoked. For an authoritative view, follow the public_url."
}
```

**If the on-chain is revoked** (and the 002 VC is still active — unusual but possible if 002 issuance was post-mirror-unmirror):
```json
{
  "attestation": { ... "revoked": true, "revoked_at": "2026-06-08T11:00:00Z" ... },
  "vc": { ... "revocation_status": "active" ... },
  "chain_status": "revoked",
  "vc_status": "active",
  "tombstoned_at": "2026-06-08T11:00:00Z",
  "disclosure": "On-chain mirror was revoked on 2026-06-08. The 002 W3C VC remains active. For the authoritative credential, follow the public_url."
}
```

**Errors**:
- `404 not_found` (unknown attestation UID)
- `503 rpc_unavailable` (Base RPC unreachable; body includes `last_successful_resolution`)
- `429 rate_limited` (60 req/min per IP exceeded)
- `504 timeout` (Base RPC exceeded 2s timeout)

**Side effects**:
- INSERT into `chain_mirror_audit` with `action='resolution_failed'` on any error.
- (No INSERT on success — successful resolutions are rate-limited but not audited individually; they are observable in the `chain_mirror_audit` table via the original `mirror` row.)

---

## EAS schema registration (one-time)

The schema is registered once at deploy via a script (`scripts/register-eas-schema-base.ts`). It is **not** a runtime endpoint; the result is stored in env + `chain_mirror_schema` table.

**Schema string** (v1):
```
bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot
```

**Computed `schema_uid`** (deterministic):
```typescript
import { keccak256, stringToBytes } from 'viem';
const schemaUid = keccak256(stringToBytes('bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot'));
// → 0x...
```

**Registration call** (via EAS SDK):
```typescript
import { EAS, SchemaRegistry } from '@ethereum-attestation-service/sdk';
import { base } from 'viem/chains';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.EAS_SCHEMA_REGISTRER_PRIVATE_KEY);
const client = createWalletClient({ account, chain: base, transport: http(process.env.BASE_RPC_URL) });
const schemaRegistry = new SchemaRegistry({ client, address: process.env.EAS_SCHEMA_REGISTRY_ADDRESS_BASE });
const tx = await schemaRegistry.register({
  schema: 'bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot',
  revocable: true,
});
const receipt = await tx.wait();
// receipt.events contains the Registered event with the schema_uid
```

**On success**:
- INSERT into `chain_mirror_schema` (`version='v1'`, `schema_uid=0x...`, `status='active'`, `registered_tx_hash=...`).
- Write `EAS_SCHEMA_UID_BASE=0x...` to env.

**Idempotency**:
- If the schema is already registered (detected by querying the SchemaRegistry for the schema UID), the script reads the existing `schema_uid` and exits 0 without submitting a new transaction.

---

## Reputation bonus (optional, opt-out per student)

When a student mirrors a VC with `snapshot_overall_score >= 90` AND `include_reputation_bonus=true` in the POST body (default true; can be toggled off in the mirror confirmation dialog), the dispatcher additionally calls the EAS `attesterReputation` extension:

```typescript
import { EAS, SchemaRegistry } from '@ethereum-attestation-service/sdk';

const attesterReputation = new EAS({ client, address: process.env.EAS_ATTESTER_REPUTATION_ADDRESS_BASE });
const bonusSchema = 'uint8 bonusLevel';
const bonusSchemaUid = keccak256(stringToBytes(bonusSchema));
await attesterReputation.attest({
  schema: bonusSchemaUid,
  data: encodeAbiParameters([{ type: 'uint8' }], [1]),
  recipient: mirrorRecipient,
});
```

The resulting `bonus_attestation_uid` is stored in `chain_reputation_bonuses`. The resolver surfaces the bonus in the unified view.

---

## Webhook delivery contract (not used in 009)

009 does not emit outbound webhooks; it consumes the existing 002 events (VC issuance, VC revocation) to enqueue mirrors and unmirrors. The 004 `webhook_dispatcher` is unchanged.

---

## Error response shape (all endpoints)

```json
{
  "error": {
    "code": "kill_switch_active" | "tenant_disabled" | "opt_in_required" | "vc_revoked" | "already_mirroring" | "already_revoked" | "invalid_input" | "not_found" | "forbidden" | "conflict" | "rate_limited" | "internal_error" | "rpc_unavailable" | "timeout" | "gas_too_high" | "wallet_invalid" | "no_custodial_wallet" | "export_expired",
    "message": "<human-readable>",
    "details": { ... }   // optional structured field hints
  }
}
```

---

## Versioning

- The on-chain mirror is not versioned via URL; it is a single feature with a master flag.
- The EAS schema is versioned via `chain_mirror_schema.version` (v1, v2, ...). The resolver surfaces the schema version in the unified view.
- The consent text is versioned via `CHAIN_MIRROR_CONSENT_VERSION` env + `chain_mirror_consents.consent_version`. When the text changes, the env is bumped (e.g. v1.0 → v1.1) and existing consents are NOT auto-revoked; students are prompted to re-consent on next mirror attempt.
