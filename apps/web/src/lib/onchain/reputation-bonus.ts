// ─── Reputation Bonus ───────────────────────────────────────────────────────
// Issues an optional reputation bonus attestation for high-scoring VCs

import { attest, type AttestResult } from './eas-client';

function getEnv(key: string, fallback?: string): string {
  return process.env[key] ?? fallback ?? '';
}

/**
 * Issue a reputation bonus attestation if the snapshot score meets the threshold.
 * Only fires when snapshotScore >= REPUTATION_BONUS_THRESHOLD env (default 90).
 *
 * @param recipient - Student wallet address
 * @param snapshotScore - The VC's overall score snapshot
 * @param attesterPrivateKey - Attester signing key (from Vault)
 * @returns The bonus attestation UID, or null if below threshold
 */
export async function issueReputationBonus(
  recipient: string,
  snapshotScore: number,
  attesterPrivateKey: `0x${string}`,
): Promise<string | null> {
  const threshold = Number(getEnv('REPUTATION_BONUS_THRESHOLD', '90'));
  if (snapshotScore < threshold) return null;

  const schemaUid = getEnv('EAS_SCHEMA_UID_BASE');
  if (!schemaUid) throw new Error('EAS_SCHEMA_UID_BASE not set');

  const result: AttestResult = await attest(
    {
      schema: schemaUid,
      data: {
        vcHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        revocationPointer: 'reputation_bonus',
        scoreSnapshot: snapshotScore,
      },
      recipient,
    },
    attesterPrivateKey,
  );

  return result.uid;
}
