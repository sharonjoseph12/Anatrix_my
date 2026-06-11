// tests/integration/biometric-correlator.test.ts — 11/10 — Correlator pure-function tests
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-005, FR-CAP-002/003
// Coverage: computeWeights, correlate with various input combinations, hash determinism

import { describe, it, expect } from "vitest";
import { correlate, computeWeights } from "@/lib/biometrics/correlator";
import type { CorrelatorInput, PeakWindowInferenceRow } from "@/lib/biometrics/correlator";
import type { BiometricAggregate } from "@antarix/types/biometrics";
import type { IDEAggregate } from "@antarix/types/ide-telemetry";

function makeBio(overrides: Partial<BiometricAggregate> = {}): BiometricAggregate {
  return {
    id: "bio-1",
    connection_id: "conn-1",
    student_id: "stu-1",
    provider: "oura",
    period_type: "daily",
    period_start: "2026-06-01",
    sleep_duration_minutes: 420,
    sleep_quality_score: 85,
    hrv_ms: 60,
    resting_hr_bpm: 55,
    daily_readiness_score: null,
    source_hash: "abc",
    ...overrides,
  };
}

function makeIDE(overrides: Partial<IDEAggregate> = {}): IDEAggregate {
  return {
    id: "ide-1",
    device_id: "dev-1",
    student_id: "stu-1",
    day: "2026-06-01",
    session_count: 5,
    total_active_seconds: 7200,
    language_breakdown_json: { python: 1.0 },
    productivity_score_raw: 70,
    score_contribution: 2,
    period_type: "daily",
    period_start: "2026-06-01",
    ...overrides,
  };
}

function makeDetector(overrides: Partial<{ window_start: string; window_end: string; confidence: number }> = {}) {
  return {
    window_start: "2026-06-01T10:00:00.000Z",
    window_end: "2026-06-01T12:00:00.000Z",
    confidence: 0.8,
    ...overrides,
  };
}

describe("computeWeights", () => {
  it("computeWeights(false, false, true) → { '002_detector': 1.0, biometric: 0, ide: 0 }", () => {
    const w = computeWeights(false, false, true);
    expect(w).toEqual({ biometric: 0, ide: 0, "002_detector": 1.0 });
  });

  it("computeWeights(true, true, true) → { '002_detector': 0.45, biometric: 0.25, ide: 0.3 }", () => {
    const w = computeWeights(true, true, true);
    expect(w["002_detector"]).toBe(0.45);
    expect(w.biometric).toBe(0.25);
    expect(w.ide).toBe(0.3);
  });

  it("computeWeights(true, false, false) → { '002_detector': 0, biometric: 1.0, ide: 0 }", () => {
    const w = computeWeights(true, false, false);
    expect(w).toEqual({ biometric: 1.0, ide: 0, "002_detector": 0 });
  });
});

describe("correlate", () => {
  it("with only biometric input uses biometric period_start for window, confidence = mean of scores/100", () => {
    const input: CorrelatorInput = {
      studentId: "stu-1",
      biometrics: [
        makeBio({ sleep_quality_score: 80, daily_readiness_score: 70 }),
      ],
      ideAggregate: null,
      detectorOutput: null,
    };
    const result = correlate(input);
    expect(result.student_id).toBe("stu-1");
    expect(result.window_start).toContain("2026-06-01");
    expect(result.source_mix.biometric).toBe(1.0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.biometric_inputs_hash).toBeTruthy();
    expect(result.detector_inputs_hash).toBeTruthy();
  });

  it("with all 3 inputs → weighted merge, detector window used, confidence clamped to 0.95", () => {
    const input: CorrelatorInput = {
      studentId: "stu-1",
      biometrics: [makeBio({ sleep_quality_score: 100, daily_readiness_score: 100 })],
      ideAggregate: makeIDE({ score_contribution: 3 }),
      detectorOutput: makeDetector({ confidence: 1.0 }),
    };
    const result = correlate(input);
    expect(result.window_start).toBe("2026-06-01T10:00:00.000Z");
    expect(result.window_end).toBe("2026-06-01T12:00:00.000Z");
    expect(result.confidence).toBeLessThanOrEqual(0.95);
    expect(result.source_mix.biometric).toBe(0.25);
    expect(result.source_mix.ide).toBe(0.30);
    expect(result.source_mix["002_detector"]).toBe(0.45);
  });

  it("with empty biometrics array + no detector should still produce a valid row with detector_inputs_hash set", () => {
    const input: CorrelatorInput = {
      studentId: "stu-1",
      biometrics: [],
      ideAggregate: null,
      detectorOutput: null,
    };
    const result = correlate(input);
    expect(result.student_id).toBe("stu-1");
    expect(result.detector_inputs_hash).toBeTruthy();
    expect(result.biometric_inputs_hash).toBeNull();
    expect(result.ide_inputs_hash).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("produces hashes that are deterministic (same input = same hash)", () => {
    const input: CorrelatorInput = {
      studentId: "stu-det",
      biometrics: [makeBio({ period_start: "2026-06-05", sleep_quality_score: 75 })],
      ideAggregate: makeIDE({ day: "2026-06-05", period_start: "2026-06-05" }),
      detectorOutput: makeDetector({ window_start: "2026-06-05T09:00:00Z", window_end: "2026-06-05T11:00:00Z", confidence: 0.7 }),
    };
    const r1 = correlate(input);
    const r2 = correlate(input);
    expect(r1.biometric_inputs_hash).toBe(r2.biometric_inputs_hash);
    expect(r1.ide_inputs_hash).toBe(r2.ide_inputs_hash);
    expect(r1.detector_inputs_hash).toBe(r2.detector_inputs_hash);
    expect(r1.confidence).toBe(r2.confidence);
  });
});
