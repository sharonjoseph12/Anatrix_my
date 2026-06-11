# 009 On-Chain Mirror — Runbook

## Key Rotation Ceremony (every 90 days)

1. Generate new EOA: `const account = privateKeyToAccount(generatePrivateKey())`
2. Store new private key in Supabase Vault with name `antarix_eas_attester_v2` (incrementing)
3. Update `EAS_ATTESTER_ADDRESS_BASE` env to the new public address
4. Deploy updated env to all edge functions
5. The old key remains valid for attestation verification — only new attestations use the new key
6. Document rotation date in this runbook

**Last rotation**: N/A (initial deployment)
**Next rotation**: TBD

## EAS Contract Pause / Exploit on Base

1. **Immediately** flip master kill-switch: `UPDATE feature_flags SET enabled=false WHERE name='009_onchain_mirror_enabled';`
2. Monitor Base status at https://status.base.org
3. If Base is down > 1 hour, consider switching to Optimism:
   - Update `BASE_RPC_URL` to Optimism RPC
   - Update EAS contract addresses for Optimism
   - Re-register schema on Optimism
4. If Base recovers, switch back

## Gas Spike Response

1. The gas oracle auto-defers when cost > `GAS_COST_THRESHOLD_USD` ($0.02)
2. If spike persists > 24 hours:
   - Check `chain_mirror_queue` for backlog: `SELECT status, count(*) FROM chain_mirror_queue GROUP BY status;`
   - If backlog > 1000 rows, consider flipping master kill-switch
3. When gas normalizes, the dispatcher auto-resumes

## DPDP Deletion Backlog Response

1. Check unmirror backlog: `SELECT count(*) FROM chain_mirror_queue WHERE status='cancelled' AND attestation_uid IS NOT NULL;`
2. If backlog > 0 and unmirror dispatcher hasn't run:
   - Manually invoke: `pnpm supabase functions invoke chain-unmirror-dispatcher`
   - Repeat every 15 min until backlog = 0
3. Verify all revocations landed: `SELECT count(*) FROM chain_mirror_revocations WHERE student_id='<id>';`

## Dead Letter Investigation

1. Query: `SELECT * FROM chain_mirror_queue WHERE status='dead_letter' ORDER BY created_at DESC LIMIT 10;`
2. Check `last_error` for root cause
3. Common causes:
   - Gas price too high for 5+ consecutive attempts
   - EAS contract reverted (bad data encoding)
   - Network timeout
4. To retry: `UPDATE chain_mirror_queue SET status='pending', attempt_count=0, next_attempt_at=now() WHERE id='<queue_id>';`

## Auditor Access

- The `chain_mirror_audit` table is read-only for the audit admin role
- Auditors can query by `student_id`, `institution_id`, `consent_version`, and date range
- No special tooling required — standard SQL access via the audit role
