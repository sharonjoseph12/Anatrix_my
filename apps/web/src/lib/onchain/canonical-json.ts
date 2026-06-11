// ─── Canonical JSON + VC Hash ────────────────────────────────────────────────
// Production wrapper: imports shared canonical-json and applies PII strip

import { canonicalize, stripVCForHash } from '@antarix/utils';
import { keccak256, stringToBytes } from 'viem';

/**
 * Compute the on-chain hash of a W3C VC.
 * 1. Strip PII (keep only credentialType, scores, timestamp)
 * 2. Canonicalize to RFC 8785 JSON
 * 3. keccak256 hash
 *
 * @returns bytes32 hex string
 */
export function computeVCHash(vc: Record<string, unknown>): `0x${string}` {
  const stripped = stripVCForHash(vc);
  const canonical = canonicalize(stripped);
  return keccak256(stringToBytes(canonical));
}

export { canonicalize, stripVCForHash };
