// ─── Gas Oracle Unit Tests ──────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { getProjectedCost, shouldDefer } from '../../apps/web/src/lib/onchain/gas-oracle';
import { nextBackoffDelay } from '../../supabase/functions/chain-mirror-dispatcher/backoff';

describe('gas-oracle', () => {
  it('should compute projected cost', () => {
    const result = getProjectedCost(21000n, 1_000_000_000n, 3000);
    // 21000 * 1 gwei = 21000 gwei = 0.000021 ETH * $3000 = $0.063
    expect(result.usd).toBeCloseTo(0.063, 3);
  });

  it('should return shouldDefer=true when over threshold', () => {
    expect(shouldDefer(0.05, 0.02)).toBe(true);
  });

  it('should return shouldDefer=false when under threshold', () => {
    expect(shouldDefer(0.01, 0.02)).toBe(false);
  });
});

describe('backoff', () => {
  it('should return 1 minute for first attempt', () => {
    expect(nextBackoffDelay(0)).toBe(1);
  });

  it('should return 5 minutes for second attempt', () => {
    expect(nextBackoffDelay(1)).toBe(5);
  });

  it('should return 25 minutes for third attempt', () => {
    expect(nextBackoffDelay(2)).toBe(25);
  });

  it('should return 120 minutes for fourth attempt', () => {
    expect(nextBackoffDelay(3)).toBe(120);
  });

  it('should return 720 minutes for fifth attempt', () => {
    expect(nextBackoffDelay(4)).toBe(720);
  });

  it('should return null (dead-letter) for 5+ attempts', () => {
    expect(nextBackoffDelay(5)).toBeNull();
    expect(nextBackoffDelay(10)).toBeNull();
  });
});
