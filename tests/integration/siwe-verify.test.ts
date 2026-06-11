// ─── SIWE Verification Tests ────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { generateNonce } from '../../apps/web/src/lib/onchain/siwe-verify';

describe('siwe-verify', () => {
  it('should generate a 32-char hex nonce', () => {
    const nonce = generateNonce();
    expect(nonce).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
  });

  it('should generate unique nonces', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });

  it.todo('should verify a valid SIWE message + signature');
  it.todo('should reject a replayed nonce');
  it.todo('should reject an invalid signature');
});
