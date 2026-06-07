// Overall profile score algorithm
// Mirrors the candidate_profiles.overall_skill_proof_score logic in
// supabase/migrations/011_functions.sql (recalculate_candidate_profile).
//
//   overall = round(
//     avg(top 3 skill_proof_score) * 0.7
//     + (count >= 5 skills ? 10 : 0)        // breadth bonus
//     + (max >= 85 ? 5 : 0)                  // specialization bonus
//   )
//
// Plus derived metrics useful in the UI: placement-readiness flag,
// specialization label, coverage ratio.

export interface ProfileScoreInput {
  skillScores: number[]; // skill_proof_score per skill the user has touched
  totalHoursLogged?: number;
  totalSessions?: number;
}

export interface ProfileScoreResult {
  overall: number;
  topThreeAverage: number;
  breadthBonus: number;
  specializationBonus: number;
  skillCount: number;
  specialization: string | null; // caller resolves name from skill index
  placementReady: boolean;
}

const PLACEMENT_HOURS_THRESHOLD = 200;
const PLACEMENT_OVERALL_THRESHOLD = 80;

export function computeProfileScore(input: ProfileScoreInput): ProfileScoreResult {
  const sorted = [...input.skillScores].sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3);
  const top3Avg = top3.length
    ? top3.reduce((sum, s) => sum + s, 0) / top3.length
    : 0;

  const breadth = sorted.length >= 5 ? 10 : 0;
  const topScore = sorted[0] ?? 0;
  const specialization = sorted.length > 0 && topScore >= 85 ? 5 : 0;

  const overall = Math.max(0, Math.min(100, Math.round(top3Avg * 0.7 + breadth + specialization)));

  return {
    overall,
    topThreeAverage: Math.round(top3Avg),
    breadthBonus: breadth,
    specializationBonus: specialization,
    skillCount: sorted.length,
    specialization: sorted.length > 0 ? `top-${top3.length}-weighted` : null,
    placementReady:
      overall >= PLACEMENT_OVERALL_THRESHOLD &&
      (input.totalHoursLogged ?? 0) >= PLACEMENT_HOURS_THRESHOLD,
  };
}

export function profileTier(overall: number): "explorer" | "builder" | "proven" | "elite" {
  if (overall >= 85) return "elite";
  if (overall >= 70) return "proven";
  if (overall >= 45) return "builder";
  return "explorer";
}
