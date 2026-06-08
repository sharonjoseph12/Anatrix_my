# Quickstart: 009 — On-Chain Mirror (EAS on Base L2)

**Date**: 2026-06-07
**Prereqs**: 001-008 quickstarts already executed. 002 W3C VC infra (migration 022) is in production.

> **Naming note**: This feature reserves migration number `042` per the spec. At the time of writing, `049_verify_api_key.sql` exists. The migration file for this feature is therefore written as `049_onchain_mirror.sql` and is applied *after* `049_verify_api_key.sql`. If your migration runner requires strictly-ordered numeric prefixes, rename to `043_onchain_mirror.sql` and the cron file to `050_cron_009.sql` — the schema content is unchanged.

## 1. New environment variables

Add to `.env.local` (and document in `.env.local.example`):

```env
# Master kill-switch
ONCHAIN_ENABLED_DEFAULT=false                    # default value of users.onchain_mirror_opt_in on new rows (always false, even if this is 'true')
ONCHAIN_MIRROR_ENABLED=false                     # master feature flag; read by 009_onchain_mirror_enabled

# EAS on Base L2
BASE_RPC_URL=https://mainnet.base.org            # or Alchemy/Infura URL for higher rate limits
EAS_CONTRACT_ADDRESS_BASE=0x4200000000000000000000000000000000000021
EAS_SCHEMA_REGISTRY_ADDRESS_BASE=0x4200000000000000000000000000000000000020
EAS_ATTESTER_REPUTATION_ADDRESS_BASE=0x4200000000000000000000000000000000000022  # for FR-CHM-014
EAS_SCHEMA_UID_BASE=                             # populated at schema registration; see §6

# Attester key (KMS-backed; see §3)
EAS_ATTESTER_ADDRESS_BASE=                       # the Antarix attested address (0x...)
# EAS_ATTESTER_PRIVATE_KEY must NEVER be in env at the Edge Function level.
# It is held in Supabase Vault and accessed via the KMS API.

# Gas oracle
GAS_ORACLE_URL=https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd
GAS_PRICE_RPC_METHOD=eth_gasPrice                # or eth_maxPriorityFeePerGas + eth_baseFee
GAS_COST_THRESHOLD_USD=0.02                      # reject submission if projected cost exceeds
GAS_COST_TARGET_USD=0.01                         # SC-CHM-003 target
LOW_GAS_DEFER_MINUTES=10                         # when over threshold, defer by N minutes

# Platform-custodial HD wallet (for self-custody-less students)
HD_WALLET_SEED_REF=antarix_chain_mirror_v1       # key in Supabase Vault; never in env
HD_WALLET_DERIVATION_PATH=m/44'/60'/0'/0         # BIP-44 Ethereum standard

# Cron
CHAIN_MIRROR_DISPATCH_CRON=*/5 * * * *           # every 5 min
CHAIN_UNMIRROR_DISPATCH_CRON=*/15 * * * *        # every 15 min

# Resolver (public, unauth)
ONCHAIN_RESOLVER_RATE_LIMIT_RPM=60               # per IP
ONCHAIN_RESOLVER_TIMEOUT_MS=2000                 # Base RPC timeout

# Reputation bonus
REPUTATION_BONUS_THRESHOLD=90                    # snapshot score ≥ 90 triggers bonus

# Consent policy
CHAIN_MIRROR_CONSENT_VERSION=v1.0                # bump this string when the consent text changes
CHAIN_MIRROR_CONSENT_TEXT_PATH=./legal/onchain-mirror-consent-v1.0.md
```

Also add the new vars to `turbo.json` `globalEnv` array so the build picks them up.

## 2. Migrations (run in order)

```bash
pnpm supabase db push       # applies 042 (schema) then 043 (cron) in sequence
```

Migration order:
1. `049_onchain_mirror.sql` — 6 new tables + RLS + triggers + column extensions on `users` and `institutions`
2. `050_cron_009.sql` — 2 new cron jobs on the existing `pg_cron` extension (mirror dispatcher every 5 min; unmirror dispatcher every 15 min)

If using the Strict-ordering variant:
1. `043_onchain_mirror.sql` (renamed)
2. `050_cron_009.sql` (renamed)

## 3. Attester key (KMS setup, one-time)

The attester private key is the most sensitive secret in this feature. It signs every mirror and every reputation bonus; if compromised, the master kill-switch must be flipped within minutes.

**Recommended setup** (Supabase Vault):
1. Generate a new EOA via `viem`: `const account = privateKeyToAccount(generatePrivateKey())`.
2. Store the private key in Supabase Vault with a name like `antarix_eas_attester_v1`.
3. Add the public address to env as `EAS_ATTESTER_ADDRESS_BASE`.
4. Document the rotation date (every 90 days) in the runbook.
5. The Edge Function signs via the Vault API; the private key never leaves the Vault.

**Alternative**: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager. The pattern is the same: store the key in a secret manager, sign via the secret manager's API, never put the key in env.

**Multi-sig for v2** (deferred): a 2-of-3 Safe wallet as the attester, with three engineering keys. Not in v1 scope.

## 4. New Edge Functions to deploy

```bash
pnpm supabase functions deploy chain-mirror-attest
pnpm supabase functions deploy chain-mirror-dispatcher
pnpm supabase functions deploy chain-unmirror-dispatcher
pnpm supabase functions deploy chain-mirror-resolver
```

Each function uses the secret bundle declared in step 1 (excluding `EAS_ATTESTER_PRIVATE_KEY`, which is fetched from the Vault at signing time).

## 5. Wallet connect (self-custody path)

For students who self-custody, we use **Sign-In with Ethereum (EIP-4361)**:

```typescript
// apps/web/src/lib/onchain/siwe-verify.ts
import { SiweMessage } from 'siwe';

export async function verifySiwe(message: string, signature: string): Promise<{ address: string }> {
  const siwe = new SiweMessage(message);
  const result = await siwe.verify({ signature });
  if (!result.success) throw new Error('SIWE verification failed');
  return { address: siwe.address.toLowerCase() };
}
```

The UI uses either:
- **Wagmi + RainbowKit** (heavier but covers 10+ wallets) — recommended for v1
- **A thin custom SIWE flow** (lighter, no wallet-library lock-in) — alternative

Choose wagmi for v1; document the alternative in the runbook.

## 6. Hardhat local dev (for E2E tests, optional but recommended)

For local EAS testing, we use Hardhat with the official EAS contracts:

```bash
# 1. Install Hardhat subproject deps
pnpm --filter hardhat install

# 2. Start local node
pnpm --filter hardhat hardhat node

# 3. Deploy EAS contracts + register schema
pnpm --filter hardhat run scripts/deploy-eas.ts
pnpm --filter hardhat run scripts/register-schema.ts

# 4. Set env to point at local
export BASE_RPC_URL=http://localhost:8545
export EAS_CONTRACT_ADDRESS_BASE=<deployed-eas-address>
export EAS_SCHEMA_REGISTRY_ADDRESS_BASE=<deployed-schema-registry-address>
export EAS_ATTESTER_ADDRESS_BASE=<first-hardhat-account>
export EAS_SCHEMA_UID_BASE=<registered-schema-uid>
```

The deploy script (`hardhat/scripts/deploy-eas.ts`) does the following:
1. Deploys the EAS contract (or imports the canonical one from `@ethereum-attestation-service/contracts`).
2. Deploys the SchemaRegistry contract.
3. Deploys the AttesterReputation contract.
4. Registers the schema `"bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot"` via the SchemaRegistry.
5. Prints the contract addresses and the schema UID.

The schema-UID computation is deterministic:
```typescript
import { keccak256, stringToBytes } from 'viem';
const schemaString = 'bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot';
const schemaUid = keccak256(stringToBytes(schemaString));
```

## 7. EAS schema registration (production, one-time)

In production, the schema is registered once via the EAS SchemaRegistry on Base L2:

```bash
# Run the registration script
pnpm tsx scripts/register-eas-schema-base.ts

# Outputs:
#   tx_hash:        0xabc...
#   schema_uid:     0xdef...
#
# Save the schema_uid to:
#   - env EAS_SCHEMA_UID_BASE
#   - chain_mirror_schema table (version='v1', status='active')
```

The script is idempotent: if the schema is already registered, the script reads the existing `schema_uid` from the SchemaRegistry and exits 0.

## 8. Test attestation script (end-to-end smoke test)

After schema registration, run the smoke test:

```bash
# 1. Seed a test student with a 002 W3C VC
pnpm tsx scripts/seed-test-student-with-vc.ts

# 2. Flip the master flag
psql -c "UPDATE feature_flags SET enabled=true WHERE name='009_onchain_mirror_enabled';"

# 3. Opt the test student in
psql -c "UPDATE users SET onchain_mirror_opt_in=true WHERE email='[email protected]';"

# 4. Request a mirror
curl -X POST http://localhost:3000/api/credentials/<vc-id>/onchain \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{}'

# 5. Wait for the dispatcher to pick it up (≤ 5 min) OR trigger it manually
pnpm supabase functions invoke chain-mirror-dispatcher

# 6. Check the status
curl http://localhost:3000/api/credentials/<vc-id>/onchain \
  -H "Cookie: <session-cookie>"
# → { "status": "confirmed", "attestation_uid": "0x...", "explorer_url": "https://basescan.org/tx/0x..." }

# 7. Resolve publicly
curl http://localhost:3000/verify/onchain/<attestation_uid>
# → JSON with attested_by, revocation_pointer, snapshot_score, chain_status: 'active', vc_status: 'active'
```

## 9. Unmirror flow test

```bash
# Single unmirror
curl -X DELETE http://localhost:3000/api/credentials/<vc-id>/onchain \
  -H "Cookie: <session-cookie>"

# Wait ≤ 15 min for the unmirror dispatcher, or trigger manually
pnpm supabase functions invoke chain-unmirror-dispatcher

# Verify the on-chain status
curl http://localhost:3000/verify/onchain/<attestation_uid>
# → { "chain_status": "revoked", "tombstoned_at": "...", "vc_status": "active" }
```

## 10. Kill-switch tests

```bash
# Master flag off
psql -c "UPDATE feature_flags SET enabled=false WHERE name='009_onchain_mirror_enabled';"
curl -X POST http://localhost:3000/api/credentials/<vc-id>/onchain -H "Cookie: <session-cookie>"
# → 503 kill_switch_active

# Per-tenant flag off
psql -c "UPDATE institutions SET onchain_mirror_enabled=false WHERE id=<college-id>;"
curl -X POST http://localhost:3000/api/credentials/<vc-id>/onchain -H "Cookie: <session-cookie>"
# → 403 tenant_disabled

# Per-student flag off
psql -c "UPDATE users SET onchain_mirror_opt_in=false WHERE id=<student-id>;"
curl -X POST http://localhost:3000/api/credentials/<vc-id>/onchain -H "Cookie: <session-cookie>"
# → 403 opt_in_required
```

## 11. DPDP deletion → bulk-unmirror

```bash
# Trigger a deletion
psql -c "UPDATE users SET deletion_requested_at=now() WHERE id=<student-id>;"

# The 002 deletion handler should enqueue a bulk-unmirror in chain_mirror_queue
# Wait for the unmirror dispatcher

# Verify
psql -c "SELECT status, count(*) FROM chain_mirror_queue WHERE student_id='<student-id>' GROUP BY status;"
# → cancelled (all old in-flight rows)
psql -c "SELECT action, count(*) FROM chain_mirror_audit WHERE student_id='<student-id>' GROUP BY action;"
# → unmirror_post_deletion, kill_switch_engaged (etc.)
```

## 12. Feature flags (recommended rollout)

Behind feature flags from day 1:
- `009_onchain_mirror_enabled` — master kill-switch, default `false`. Day 0 (engineering only) → Day 30 (cohort 1% of students) → Day 60 (cohort 10%) → Day 90 (cohort 100%).
- `009_reputation_bonus` — default `false`. Day 60 (cohort 10%) → Day 90 (all opted-in students).

The flags are read at the API layer *and* at the edge function layer (defense in depth).

## 13. Smoke tests

```bash
pnpm test                                            # unit
pnpm test:e2e -- --grep "onchain"                    # E2E for mirror + unmirror + resolver
pnpm test:e2e -- --grep "onchain.*kill-switch"       # E2E for kill-switch tests
pnpm test:e2e -- --grep "onchain.*dpdp"              # E2E for DPDP deletion → bulk-unmirror
```

The E2E tests use the local Hardhat node (per §6); the schema is registered once in `beforeAll`; the attester key is a known Hardhat account.

## 14. Observability

- **Audit volume**: `chain_mirror_audit` row count by `action` per day. Expected: 1 row per mirror + 1 per unmirror + occasional `denied_*` rows.
- **Queue health**: `chain_mirror_queue` rows by `status`. Expected: 99% `confirmed` or `cancelled`; < 1% `dead_letter`. Alert on > 5% `dead_letter` in a 24h window.
- **Cost**: `chain_mirror_audit.usd_cost` 95th-percentile per day. Expected: < $0.02. Alert on > $0.05.
- **Resolution latency**: `GET /verify/onchain/{uid}` p50/p95 from edge function logs. Expected: p95 < 2s.
- **Kill-switch readiness**: chaos test runs weekly — flips the master flag and asserts the queue reaches "no new submissions" in < 5 min.

## 15. Rollback

Each migration is a pure additive `CREATE TABLE` + `ALTER TABLE ADD COLUMN` + `CREATE TRIGGER`. To roll back:

```bash
pnpm supabase migration repair --status reverted 043 042
# then re-apply the corresponding DROP statements (held in supabase/migrations/_rollback/009/)
```

The 2 cron entries (mirror + unmirror) are removed automatically by the rollback of `050_cron_009.sql`.

**Note**: Do NOT roll back the schema migration while mirrors are in flight; the in-flight attestations will become unresolvable in our resolver. The recommended kill path is:
1. Flip `009_onchain_mirror_enabled = false` (no new mirrors).
2. Wait for in-flight mirrors to complete (≤ 5 min).
3. Run the unmirror dispatcher to revoke all `pending` and `confirmed` mirrors.
4. Then roll back the migration.

## 16. Runbook highlights

- **Attester key rotation** (every 90 days): see `docs/009-runbook.md` §"Key rotation ceremony".
- **EAS contract pause / exploit on Base**: flip master flag immediately; switch to EAS on Optimism (or wait for Base to recover); update `BASE_RPC_URL` and the contract addresses in env.
- **Gas spike alert** (> $0.05/attestation for > 1h): cron auto-defers; if the spike persists for > 24h, alert the Antarix ops Slack; consider flipping the master flag if the deferral backlog exceeds 1000 rows.
- **DPDP deletion bulk-unmirror backlog**: if the unmirror dispatcher falls behind, manually trigger it via `pnpm supabase functions invoke chain-unmirror-dispatcher` every 15 min until the backlog is 0.
- **Auditor access**: the `chain_mirror_audit` table is read-only for the audit admin role; auditors can query by `student_id`, `institution_id`, `consent_version`, and date range. No special tooling required.
