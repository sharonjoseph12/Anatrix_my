// tests/integration/score-cap.test.ts — 11/10 — Score cap enforcement tests
// Spec: specs/006-deep-signal-capture/spec.md FR-CAP-001, FR-CAP-002, FR-CAP-003
// Coverage: clampIDEScore, clampBiometricScore, clampCombinedScore

import { describe, it, expect } from "vitest";
import {
  clampIDEScore,
  clampBiometricScore,
  clampCombinedScore,
  IDE_SCORE_CAP,
  BIOMETRIC_SCORE_CAP,
  COMBINED_SCORE_CAP,
} from "@antarix/utils/score-cap";

describe("clampIDEScore", () => {
  it("clampIDEScore(1.5) → 1.5 (within cap)", () => {
    expect(clampIDEScore(1.5)).toBe(1.5);
  });

  it("clampIDEScore(7) → 3 (capped)", () => {
    expect(clampIDEScore(7)).toBe(IDE_SCORE_CAP);
  });

  it("clampIDEScore(-1) → 0 (negative clamped)", () => {
    expect(clampIDEScore(-1)).toBe(0);
  });

  it("clampIDEScore(NaN) → 0 (NaN guard)", () => {
    expect(clampIDEScore(NaN)).toBe(0);
  });
});

describe("clampBiometricScore", () => {
  it("clampBiometricScore(0.5) → 0.5", () => {
    expect(clampBiometricScore(0.5)).toBe(0.5);
  });

  it("clampBiometricScore(5) → 2 (capped)", () => {
    expect(clampBiometricScore(5)).toBe(BIOMETRIC_SCORE_CAP);
  });
});

describe("clampCombinedScore", () => {
  it("clampCombinedScore(3, 2) → { ide: 3, biometric: 2, total: 5 } (exactly at combined cap)", () => {
    const result = clampCombinedScore(3, 2);
    expect(result.ide).toBe(3);
    expect(result.biometric).toBe(2);
    expect(result.total).toBe(5);
  });

  it("clampCombinedScore(5, 3) → { ide: 3.13, biometric: 1.88, total: 5 } (proportional scaling)", () => {
    const result = clampCombinedScore(5, 3);
    expect(result.ide).toBeCloseTo(3.13, 2);
    expect(result.biometric).toBeCloseTo(1.88, 2);
    expect(result.total).toBe(5);
  });
});
