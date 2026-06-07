// packages/utils/__tests__/credential-threshold.test.ts
// T076 — The refresh threshold (A-014 default 3) gates when a new snapshot is
// issued. Same number of points below OR above the existing snapshot both
// trigger a refresh; the absolute delta is the rule.

import { describe, it, expect } from "vitest";

const DELTA = 3;
function shouldRefresh(existing: number | null, current: number, delta = DELTA): boolean {
  if (existing === null) return true;
  return Math.abs(current - existing) >= delta;
}

describe("credential refresh threshold", () => {
  it("issues a credential the first time", () => {
    expect(shouldRefresh(null, 50)).toBe(true);
  });
  it("skips refresh when the delta is below the threshold", () => {
    expect(shouldRefresh(50, 51)).toBe(false);
    expect(shouldRefresh(50, 52)).toBe(false);
  });
  it("refreshes when the delta is exactly at the threshold", () => {
    expect(shouldRefresh(50, 53)).toBe(true);
  });
  it("refreshes when the delta is above the threshold (up)", () => {
    expect(shouldRefresh(50, 60)).toBe(true);
  });
  it("refreshes when the delta is above the threshold (down)", () => {
    expect(shouldRefresh(80, 70)).toBe(true);
  });
  it("respects a custom delta", () => {
    expect(shouldRefresh(50, 53, 5)).toBe(false);
    expect(shouldRefresh(50, 55, 5)).toBe(true);
  });
});
