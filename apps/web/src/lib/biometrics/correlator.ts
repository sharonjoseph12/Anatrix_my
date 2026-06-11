// apps/web/src/lib/biometrics/correlator.ts
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-005, FR-CAP-002/003
//   data-model.md lines 240-263
// Pure: merge biometrics + IDE + 002 detector into a peak_window_inferences row.
//   source_mix: { biometric, ide, "002_detector" } per the spec weight table.
//   detector_inputs_hash is REQUIRED (never null).
//   confidence = weighted average of per-source confidences, clamped to [0, 0.95].

import { hashStructured } from "@antarix/utils/hash";
import type { BiometricAggregate } from "@antarix/types/biometrics";
import type { IDEAggregate } from "@antarix/types/ide-telemetry";

export interface DetectorOutput {
  window_start: string;
  window_end: string;
  confidence: number;
}

export interface CorrelatorInput {
  studentId: string;
  biometrics: BiometricAggregate[];
  ideAggregate: IDEAggregate | null;
  detectorOutput: DetectorOutput | null;
}

export type SourceMix = {
  biometric: number;
  ide: number;
  "002_detector": number;
};

export interface PeakWindowInferenceRow {
  student_id: string;
  window_start: string;
  window_end: string;
  confidence: number;
  biometric_inputs_hash: string | null;
  ide_inputs_hash: string | null;
  detector_inputs_hash: string;
  source_mix: SourceMix;
}

const CONFIDENCE_MAX = 0.95;
const CONFIDENCE_MIN = 0;
const IDE_SCORE_CAP = 3;

export function computeWeights(
  hasBiometric: boolean,
  hasIDE: boolean,
  hasDetector: boolean,
): SourceMix {
  if (hasBiometric && hasIDE && hasDetector) {
    return { biometric: 0.25, ide: 0.30, "002_detector": 0.45 };
  }
  if (hasBiometric && hasDetector) {
    return { biometric: 0.40, ide: 0, "002_detector": 0.60 };
  }
  if (hasIDE && hasDetector) {
    return { biometric: 0, ide: 0.35, "002_detector": 0.65 };
  }
  if (hasBiometric) {
    return { biometric: 1.0, ide: 0, "002_detector": 0 };
  }
  if (hasIDE) {
    return { biometric: 0, ide: 1.0, "002_detector": 0 };
  }
  return { biometric: 0, ide: 0, "002_detector": 1.0 };
}

export function correlate(input: CorrelatorInput): PeakWindowInferenceRow {
  const hasBiometric = input.biometrics.length > 0;
  const hasIDE = input.ideAggregate !== null;
  const hasDetector = input.detectorOutput !== null;
  const weights = computeWeights(hasBiometric, hasIDE, hasDetector);

  const window = determineWindow(
    input.detectorOutput,
    input.biometrics,
    input.ideAggregate,
  );

  const biometric_conf = biometricConfidence(input.biometrics);
  const ide_conf = ideConfidence(input.ideAggregate);
  const detector_conf = hasDetector ? clamp01(input.detectorOutput!.confidence) : 0;

  const rawConfidence =
    weights.biometric * biometric_conf +
    weights.ide * ide_conf +
    weights["002_detector"] * detector_conf;
  const confidence = clamp(rawConfidence, CONFIDENCE_MIN, CONFIDENCE_MAX);

  const biometric_inputs_hash = hasBiometric
    ? hashStructured(
      input.biometrics.map((b) => ({
        period_start: b.period_start,
        sleep: b.sleep_duration_minutes ?? null,
        hrv: b.hrv_ms ?? null,
        rhr: b.resting_hr_bpm ?? null,
      })),
    )
    : null;
  const ide_inputs_hash = hasIDE
    ? hashStructured(input.ideAggregate)
    : null;
  const detector_inputs_hash = hashStructured(
    input.detectorOutput ?? {},
  );

  return {
    student_id: input.studentId,
    window_start: window.window_start,
    window_end: window.window_end,
    confidence,
    biometric_inputs_hash,
    ide_inputs_hash,
    detector_inputs_hash,
    source_mix: weights,
  };
}

function determineWindow(
  detector: DetectorOutput | null,
  biometrics: BiometricAggregate[],
  ide: IDEAggregate | null,
): { window_start: string; window_end: string } {
  if (detector) {
    return { window_start: detector.window_start, window_end: detector.window_end };
  }
  if (biometrics.length > 0) {
    const sorted = [...biometrics].sort((a, b) => a.period_start.localeCompare(b.period_start));
    const earliest = sorted[0]!.period_start;
    return dayWindow(earliest);
  }
  if (ide) {
    return dayWindow(ide.period_start);
  }
  const now = new Date();
  return {
    window_start: now.toISOString(),
    window_end: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function dayWindow(periodStart: string): { window_start: string; window_end: string } {
  const start = new Date(`${periodStart.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime())) {
    const now = new Date();
    return {
      window_start: now.toISOString(),
      window_end: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { window_start: start.toISOString(), window_end: end.toISOString() };
}

function biometricConfidence(biometrics: BiometricAggregate[]): number {
  if (biometrics.length === 0) return 0;
  const scores: number[] = [];
  for (const b of biometrics) {
    if (typeof b.sleep_quality_score === "number") {
      scores.push(clamp01(b.sleep_quality_score / 100));
    }
    if (typeof b.daily_readiness_score === "number") {
      scores.push(clamp01(b.daily_readiness_score / 100));
    }
  }
  if (scores.length === 0) return 0.5;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function ideConfidence(ide: IDEAggregate | null): number {
  if (!ide) return 0;
  return clamp01(ide.score_contribution / IDE_SCORE_CAP);
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
