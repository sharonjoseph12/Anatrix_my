// apps/web/src/lib/algorithms/dsa-score.ts
// T010 — DSA score algorithm (research D8).
//
// Combines LeetCode + HackerRank data into a 0-100 score.
//   - problem component: weighted by difficulty (easy=1, medium=3, hard=8),
//     capped at 50 weighted solves = full.
//   - contest component: highest contest rating / 30 (3000 rating = full).
//   - streak component: max streak days / 7, capped at 10 points.

export type DsaProfileInput = {
  platform: "leetcode" | "hackerrank";
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating: number | null;
  streak_days: number;
  total_solved: number;
};

export type DsaScoreResult = {
  score: number;
  components: { problem: number; contest: number; streak: number };
};

export function computeDsaScore(profiles: DsaProfileInput[]): DsaScoreResult {
  if (profiles.length === 0) {
    return { score: 0, components: { problem: 0, contest: 0, streak: 0 } };
  }

  const problemWeighted = profiles.reduce(
    (s, p) => s + p.easy_solved * 1 + p.medium_solved * 3 + p.hard_solved * 8,
    0,
  );
  const problemComponent = Math.min(100, (problemWeighted / 50) * 100);

  const contestComponent = (Math.max(
    ...profiles.map((p) => p.contest_rating ?? 0),
    0,
  ) /
    30) *
    100;

  const streakComponent = Math.min(
    10,
    Math.max(...profiles.map((p) => p.streak_days ?? 0), 0) / 7,
  ) * 10;

  const score = Math.round(
    Math.min(100, problemComponent * 0.6 + contestComponent * 0.3 + streakComponent * 0.1),
  );

  return {
    score,
    components: {
      problem: Math.round(problemComponent),
      contest: Math.round(contestComponent),
      streak: Math.round(streakComponent),
    },
  };
}

/**
 * Blend the DSA score into an existing Skill Proof Score with a 15% weight.
 * The base score is clamped 0..100; the blend keeps the original ceiling.
 */
export function blendDsaIntoSkillProof(baseScore: number, dsaScore: number): number {
  const base = Math.max(0, Math.min(100, baseScore));
  const dsa = Math.max(0, Math.min(100, dsaScore));
  return Math.round(base * 0.85 + dsa * 0.15);
}
