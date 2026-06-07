// supabase/functions/_shared/placement-scorer.ts
// T064 — rule-augmented scorer (v1). Pure function; deep-learning layered later
// See spec/002 research.md Decision D

export type PlacementFeatures = {
  current_skill_proof_score: number;
  score_trajectory_90d: number;       // signed delta
  specialization_market_alignment: number; // 0..1
  cohort_percentile: number;          // 0..100
  project_completion_rate: number;    // 0..1
  consistency_score: number;          // 0..100
  power_mode_bonus: number;           // 0..1 (from focus quality etc.)
  historical_cohort_placement_rate: number; // 0..1
};

export type PlacementResult = {
  probability_0_100: number;
  company_tier: "tier_1" | "tier_2" | "tier_3";
  time_to_ready_months: number;
  top_gaps: Array<{ skill: string; gap_score: number; recommended_action: string }>;
};

export function scorePlacement(f: PlacementFeatures): PlacementResult {
  // Weighted composite (documented in research.md Decision D)
  const composite =
    0.30 * f.current_skill_proof_score +
    0.10 * (50 + f.score_trajectory_90d / 2) +
    0.15 * f.specialization_market_alignment * 100 +
    0.10 * f.cohort_percentile +
    0.10 * f.project_completion_rate * 100 +
    0.10 * f.consistency_score +
    0.10 * f.power_mode_bonus * 100 +
    0.05 * f.historical_cohort_placement_rate * 100;
  const probability = Math.max(0, Math.min(100, Math.round(composite)));
  const company_tier: PlacementResult["company_tier"] =
    probability >= 75 ? "tier_1" : probability >= 50 ? "tier_2" : "tier_3";
  const gapTo80 = Math.max(0, 80 - f.current_skill_proof_score);
  const time_to_ready_months = +(gapTo80 / 6).toFixed(1);
  return {
    probability_0_100: probability,
    company_tier,
    time_to_ready_months,
    top_gaps: deriveTopGaps(f),
  };
}

function deriveTopGaps(f: PlacementFeatures): PlacementResult["top_gaps"] {
  const out: PlacementResult["top_gaps"] = [];
  if (f.current_skill_proof_score < 80) {
    out.push({
      skill: "Overall Skill Proof",
      gap_score: +(1 - f.current_skill_proof_score / 80).toFixed(2),
      recommended_action: "Complete 2 more projects in your top specialization",
    });
  }
  if (f.consistency_score < 70) {
    out.push({
      skill: "Consistency",
      gap_score: +(1 - f.consistency_score / 70).toFixed(2),
      recommended_action: "Maintain a 5-day/week coding streak for the next 4 weeks",
    });
  }
  if (f.specialization_market_alignment < 0.6) {
    out.push({
      skill: "Market alignment",
      gap_score: +(1 - f.specialization_market_alignment).toFixed(2),
      recommended_action: "Add at least 1 project in a high-demand specialization",
    });
  }
  return out.slice(0, 3);
}
