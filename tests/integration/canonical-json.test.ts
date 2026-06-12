// ─── Canonical JSON Unit Tests ───────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { canonicalize, stripVCForHash } from '@antarix/utils';

describe('canonical-json', () => {
  it('should produce deterministic output regardless of key order', () => {
    const a = canonicalize({ z: 1, a: 2 });
    const b = canonicalize({ a: 2, z: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"z":1}');
  });

  it('should handle nested objects', () => {
    const result = canonicalize({ b: { d: 1, c: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it('should handle arrays (order preserved)', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('should handle null', () => {
    expect(canonicalize(null)).toBe('null');
  });

  it('should strip PII from a VC', () => {
    const vc = {
      type: ['VerifiableCredential', 'AntarixSkillCredential'],
      credentialSubject: {
        name: 'John Doe',
        email: 'john@example.com',
        snapshotOverallScore: 87,
        snapshotPerSkill: { react: 92, node: 85 },
        snapshotTakenAt: '2026-06-10T00:00:00Z',
      },
    };
    const stripped = stripVCForHash(vc);
    expect(stripped.credentialType).toBe('AntarixSkillCredential');
    expect(stripped.snapshotOverallScore).toBe(87);
    expect(stripped).not.toHaveProperty('name');
    expect(stripped).not.toHaveProperty('email');
  });

  it('should produce the same hash for the same VC content', () => {
    const vc = {
      type: 'TestCredential',
      credentialSubject: {
        snapshotOverallScore: 87,
        snapshotPerSkill: { a: 1 },
        snapshotTakenAt: '2026-01-01T00:00:00Z',
      },
    };
    const hash1 = canonicalize(stripVCForHash(vc));
    const hash2 = canonicalize(stripVCForHash(vc));
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different VC content', () => {
    const vc1 = { type: 'A', credentialSubject: { snapshotOverallScore: 80 } };
    const vc2 = { type: 'B', credentialSubject: { snapshotOverallScore: 90 } };
    expect(canonicalize(stripVCForHash(vc1))).not.toBe(canonicalize(stripVCForHash(vc2)));
  });
  it('should handle booleans', () => {
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(false)).toBe('false');
  });

  it('should throw on non-finite numbers', () => {
    expect(() => canonicalize(NaN)).toThrow('Non-finite numbers not allowed');
    expect(() => canonicalize(Infinity)).toThrow('Non-finite numbers not allowed');
  });

  it('should throw on unsupported types', () => {
    expect(() => canonicalize(() => {})).toThrow('Unsupported type: function');
    expect(() => canonicalize(Symbol('test'))).toThrow('Unsupported type: symbol');
  });
});
