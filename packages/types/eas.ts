// ─── EAS (Ethereum Attestation Service) Types ───────────────────────────────

export interface EASAttestation {
  uid: string;          // bytes32 hex
  schema: string;       // schema UID bytes32
  refUID: string;       // reference UID
  time: bigint;         // attestation timestamp
  expirationTime: bigint;
  revocationTime: bigint;
  recipient: string;    // address
  attester: string;     // address
  revocable: boolean;
  data: string;         // encoded data
}

export interface EASSchema {
  uid: string;
  schema: string;       // e.g. "bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot"
  resolver: string;     // address
  revocable: boolean;
}

export interface AttesterReputation {
  attester: string;     // address
  attestationCount: number;
  revokedCount: number;
  firstAttestationTime: bigint;
}

/** Decoded attestation data for the 009 mirror schema */
export interface DecodedMirrorAttestation {
  vcHash: `0x${string}`;
  revocationPointer: string;
  scoreSnapshot: number;
}

/**
 * Decode EAS attestation data for the 009 mirror schema
 * Schema: "bytes32 vcHash, string revocationPointer, uint64 scoreSnapshot"
 */
export function decodeAttestationData(
  _schema: string,
  data: `0x${string}`
): DecodedMirrorAttestation {
  // This uses viem's decodeAbiParameters at runtime.
  // Import is deferred to avoid circular deps at type-definition time.
  // The actual implementation lives in apps/web/src/lib/onchain/eas-client.ts
  // This is a type-level helper for the shape.
  const { decodeAbiParameters } = require('viem') as typeof import('viem');

  const decoded = decodeAbiParameters(
    [
      { name: 'vcHash', type: 'bytes32' },
      { name: 'revocationPointer', type: 'string' },
      { name: 'scoreSnapshot', type: 'uint64' },
    ],
    data,
  );

  return {
    vcHash: decoded[0] as `0x${string}`,
    revocationPointer: decoded[1] as string,
    scoreSnapshot: Number(decoded[2]),
  };
}
