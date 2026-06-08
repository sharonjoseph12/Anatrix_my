// packages/utils/__tests__/power-mode-badge.test.ts
// T062 — Badge freshness rule: heartbeat within NUDGE_POWER_MODE_BADGE_FRESHNESS_HOURS → active.

import { describe, it, expect } from "vitest";

function isPowerModeActive(lastHeartbeatAt: string | null, freshnessHours = 2): boolean {
  if (!lastHeartbeatAt) return false;
  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  return ageMs < freshnessHours * 3600 * 1000;
}

describe("Power Mode badge freshness", () => {
  it("returns true for a heartbeat 1 hour ago", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isPowerModeActive(oneHourAgo)).toBe(true);
  });

  it("returns true for a heartbeat at the freshness boundary", () => {
    const justUnder = new Date(Date.now() - (2 * 3600 * 1000 - 1000)).toISOString();
    expect(isPowerModeActive(justUnder)).toBe(true);
  });

  it("returns false for a heartbeat 3 hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(isPowerModeActive(threeHoursAgo)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPowerModeActive(null)).toBe(false);
  });

  it("respects a custom freshness window", () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    expect(isPowerModeActive(twelveHoursAgo, 24)).toBe(true);
    expect(isPowerModeActive(twelveHoursAgo, 6)).toBe(false);
  });
});
