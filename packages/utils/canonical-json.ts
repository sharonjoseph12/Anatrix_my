// ─── RFC 8785 Canonical JSON ─────────────────────────────────────────────────
// Deterministic JSON serialization for hashing W3C VCs

/**
 * RFC 8785 canonical JSON serialization.
 * - Keys sorted lexicographically
 * - No insignificant whitespace
 * - Numbers as shortest decimal representation
 * - Unicode escaping per RFC 8785
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('Non-finite numbers not allowed in canonical JSON');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  return canonicalizeComplex(value);
}

function canonicalizeComplex(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalize(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k]));
    return '{' + pairs.join(',') + '}';
  }
  throw new Error(`Unsupported type: ${typeof value}`);
}

/** PII allowlist: strip a VC down to only the fields needed for hashing */
export interface StrippedVC {
  credentialType: string;
  snapshotOverallScore: number;
  snapshotPerSkill: Record<string, number>;
  snapshotTakenAt: string;
}

/**
 * Strip PII from a W3C VC, keeping only the fields that contribute to the hash.
 * The resulting object is safe to hash and store on-chain.
 */
export function stripVCForHash(vc: Record<string, unknown>): StrippedVC {
  const subject = (vc.credentialSubject ?? vc) as Record<string, unknown>;
  return {
    credentialType: String(extractType(vc.type)),
    snapshotOverallScore: Number(subject.snapshotOverallScore ?? subject.overallScore ?? 0),
    snapshotPerSkill: (subject.snapshotPerSkill ?? subject.perSkill ?? {}) as Record<string, number>,
    snapshotTakenAt: String(subject.snapshotTakenAt ?? subject.issuanceDate ?? new Date().toISOString()),
  };
}

function extractType(typeVal: unknown) {
  if (Array.isArray(typeVal)) return typeVal[typeVal.length - 1];
  return typeVal ?? 'UnknownCredential';
}
