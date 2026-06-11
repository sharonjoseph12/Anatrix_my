// apps/web/src/lib/anticheat/dsa-signals.ts
// Feature 004 — Anti-cheat signal detectors for DSA profile snapshots.
//
// Pure, deterministic detectors over a history of platform snapshots
// (LeetCode / HackerRank). Each function compares consecutive snapshots
// to detect velocity or rating deltas that no human can achieve
// legitimately.

import type { SignalDetectionResult } from "@antarix/types";

export interface DsaProfileSnapshot {
  platform: "leetcode" | "hackerrank";
  recorded_at: string; // ISO
  total_solved: number;
  contest_rating: number | null;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Allow ≤ 30 problems/day as legitimate grinding.
const VELOCITY_NORMAL_MAX = 30;
// 30-50 problems/day is suspicious; > 50 is humanly impossible.
const VELOCITY_HIGH_CONFIDENCE = 50;

/**
 * detectImpossibleVelocity — flags a student whose `total_solved` count
 * grew by more than 50 problems in a single 24-hour window between two
 * snapshots. No human can meaningfully solve > 50 unique DSA problems in
 * a day; this pattern is a strong indicator of automated solving or
 * credential stuffing.
 *
 * Confidence tiers:
 *   rate ≤ 30/day        → no signal (legitimate grinding)
 *   30 < rate ≤ 50/day   → 0.45 (suspicious)
 *   rate > 50/day        → 0.9  (impossible)
 */
export function detectImpossibleVelocity(
  history: DsaProfileSnapshot[],
): SignalDetectionResult | null {
  if (history.length < 2) return null;

  const sorted = [...history]
    .filter((s) => Number.isFinite(new Date(s.recorded_at).getTime()))
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
  if (sorted.length < 2) return null;

  let best: {
    from: DsaProfileSnapshot;
    to: DsaProfileSnapshot;
    ratePerDay: number;
    delta: number;
    days: number;
    confidence: number;
  } | null = null;

  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]!;
    const to = sorted[i]!;
    const fromTs = new Date(from.recorded_at).getTime();
    const toTs = new Date(to.recorded_at).getTime();
    const days = (toTs - fromTs) / MS_PER_DAY;
    if (days <= 0) continue;

    const delta = to.total_solved - from.total_solved;
    if (delta <= 0) continue;

    const ratePerDay = delta / days;
    if (ratePerDay <= VELOCITY_NORMAL_MAX) continue;

    const confidence =
      ratePerDay > VELOCITY_HIGH_CONFIDENCE ? 0.9 : 0.45;

    if (!best || ratePerDay > best.ratePerDay) {
      best = { from, to, ratePerDay, delta, days, confidence };
    }
  }

  if (!best) return null;

  return {
    signal: "impossible_velocity",
    confidence: best.confidence,
    evidence: {
      from_solved: best.from.total_solved,
      to_solved: best.to.total_solved,
      delta: best.delta,
      days_elapsed: roundTo(best.days, 3),
      rate_per_day: roundTo(best.ratePerDay, 3),
      from_recorded_at: best.from.recorded_at,
      to_recorded_at: best.to.recorded_at,
      platform: best.to.platform,
    },
  };
}

// Codeforces / LeetCode contest rating changes are bounded at ≈ 200
// points per contest; a > 600 jump is statistically impossible.
const RATING_DELTA_HIGH = 600;
const RATING_DELTA_SUSPECT = 400;

/**
 * detectRatingDeltaAnomaly — flags a student whose contest rating
 * jumped by more than 600 points in a single observation cycle. Major
 * competitive programming platforms (Codeforces, LeetCode) cap rating
 * deltas at roughly ±200 per contest; a > 600 jump is unattainable
 * without rating-system manipulation or seed data tampering.
 *
 * Confidence tiers:
 *   delta ≤ 400         → no signal
 *   400 < delta ≤ 600   → 0.4 (suspicious)
 *   delta > 600         → 0.95 (impossible)
 */
export function detectRatingDeltaAnomaly(
  history: DsaProfileSnapshot[],
): SignalDetectionResult | null {
  if (history.length < 2) return null;

  const sorted = [...history]
    .filter(
      (s) =>
        s.contest_rating !== null &&
        Number.isFinite(new Date(s.recorded_at).getTime()),
    )
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
  if (sorted.length < 2) return null;

  let best: {
    from: DsaProfileSnapshot;
    to: DsaProfileSnapshot;
    delta: number;
    confidence: number;
  } | null = null;

  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]!;
    const to = sorted[i]!;
    // Both have non-null rating here (filtered above).
    const fromRating = from.contest_rating as number;
    const toRating = to.contest_rating as number;
    const delta = toRating - fromRating;
    if (delta <= RATING_DELTA_SUSPECT) continue;

    const confidence =
      delta > RATING_DELTA_HIGH ? 0.95 : 0.4;

    if (!best || delta > best.delta) {
      best = { from, to, delta, confidence };
    }
  }

  if (!best) return null;

  return {
    signal: "rating_delta_anomaly",
    confidence: best.confidence,
    evidence: {
      from_rating: best.from.contest_rating,
      to_rating: best.to.contest_rating,
      delta: best.delta,
      from_recorded_at: best.from.recorded_at,
      to_recorded_at: best.to.recorded_at,
      platform: best.to.platform,
    },
  };
}

function roundTo(n: number, decimals: number): number {
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}
