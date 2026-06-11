// ─── SIWE Verification ──────────────────────────────────────────────────────
// Sign-In with Ethereum (EIP-4361) verification with nonce replay protection

import { SiweMessage } from 'siwe';

// ─── In-memory nonce store with TTL ─────────────────────────────────────────

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const usedNonces = new Map<string, number>();

// Clean expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiry] of usedNonces) {
    if (now > expiry) usedNonces.delete(nonce);
  }
}, 60_000);

export interface SiweVerifyResult {
  address: string;
  nonce: string;
  issuedAt: string;
}

/**
 * Verify a SIWE message + signature.
 * Includes nonce replay protection with a 5-minute TTL.
 *
 * @throws Error if verification fails or nonce is replayed
 */
export async function verifySiwe(
  message: string,
  signature: string,
): Promise<SiweVerifyResult> {
  const siwe = new SiweMessage(message);
  const result = await siwe.verify({ signature });

  if (!result.success) {
    throw new Error('SIWE verification failed');
  }

  // Nonce replay protection
  const nonce = siwe.nonce;
  if (usedNonces.has(nonce)) {
    throw new Error('Nonce already used');
  }
  usedNonces.set(nonce, Date.now() + NONCE_TTL_MS);

  return {
    address: siwe.address.toLowerCase(),
    nonce: siwe.nonce,
    issuedAt: siwe.issuedAt ?? new Date().toISOString(),
  };
}

/**
 * Generate a fresh nonce for SIWE.
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
