// apps/web/src/lib/anticheat/score-aggregator.ts
// Feature 004 — Per-entity anti-cheat score aggregator.
//
// Per research D1 the per-entity anti-cheat score is `max(signal.confidence)`
// across the detectors that fired for the entity. Using max (rather than
// sum or average) avoids penalising a student who has multiple LOW-
// confidence signals as much as one HIGH-confidence one. Quarantine is
// decided by a single threshold (default 0.6) applied to that max.

import type { SignalDetectionResult } from "@antarix/types";

export interface AggregateResult {
  /** 0..1; max of signal confidences. 0 when no signals fired. */
  score: number;
  /** The signal with the highest confidence, or null. */
  primary_signal: SignalDetectionResult | null;
  /** All non-null signals that contributed to the score. */
  all_signals: SignalDetectionResult[];
  /** True iff score >= threshold (default 0.6). */
  is_quarantined: boolean;
}

export interface AggregateOptions {
  /** Confidence threshold above which the entity is quarantined. Default 0.6. */
  threshold?: number;
}

const DEFAULT_QUARANTINE_THRESHOLD = 0.6;

/**
 * aggregateSignals — fold the raw signal-detection results for a single
 * entity (a repo or a DSA record) into one AggregateResult.
 *
 * Behaviour:
 *   - Null signals are filtered out (they did not fire).
 *   - `score = max(signal.confidence)` across remaining signals.
 *   - `primary_signal` is the signal whose confidence equals the score
 *     (ties broken by first occurrence; deterministic).
 *   - `is_quarantined = score >= threshold` (default 0.6).
 *   - With no signals, score=0, primary_signal=null, not quarantined.
 *
 * This uses `max` (not `sum` or `mean`) by design: a student with three
 * low-confidence signals (0.3, 0.3, 0.3) is treated as 0.3-confident,
 * not 0.9-confident. This matches the rule-based design in D1 and keeps
 * the system explainable during student appeals.
 */
export function aggregateSignals(
  signals: ReadonlyArray<SignalDetectionResult | null>,
  options?: AggregateOptions,
): AggregateResult {
  const allSignals: SignalDetectionResult[] = [];
  for (const s of signals) {
    if (s !== null) allSignals.push(s);
  }

  if (allSignals.length === 0) {
    return {
      score: 0,
      primary_signal: null,
      all_signals: [],
      is_quarantined: false,
    };
  }

  let primary: SignalDetectionResult = allSignals[0]!;
  let maxConfidence = primary.confidence;
  for (let i = 1; i < allSignals.length; i++) {
    const s = allSignals[i]!;
    if (s.confidence > maxConfidence) {
      maxConfidence = s.confidence;
      primary = s;
    }
  }

  const threshold = options?.threshold ?? DEFAULT_QUARANTINE_THRESHOLD;
  const score = clamp01(maxConfidence);
  return {
    score,
    primary_signal: primary,
    all_signals: allSignals,
    is_quarantined: score >= threshold,
  };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
