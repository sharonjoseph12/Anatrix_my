// apps/web/src/lib/algorithms/skill-proof-score.ts
// T053 + T056 + T071 — Skill Proof Score components + Power Mode weighting.
//
// Weights (from supabase/functions/_shared/score-weights.ts):
//   passive:     github 0.50, sessions 0.0,  consistency 0.20, peer 0.20, calendar 0.10
//   power_mode:  github 0.35, sessions 0.25, consistency 0.20, peer 0.20
//
// Mirrors 011_functions.sql/recalculate_user_skill_score.

export type Proficiency = "novice" | "developing" | "proficient" | "advanced" | "expert";

export type ScoreComponents = {
  hours: number;
  projects: number;
  quality: number;
  consistency: number;
};

export type SkillProofResult = {
  score: number;
  proficiency: Proficiency;
  components: ScoreComponents;
  profile: "passive" | "power_mode";
};

export type ComputeInput = {
  hours_logged: number;
  projects_completed: number;
  avg_completion_rate: number; // 0..1
  avg_focus_quality: number; // 0..1
  avg_hours_to_proficiency: number | null;
  powerModeHeartbeatAt?: string | null;
  freshnessHours?: number;
};

const PROFICIENCY_THRESHOLDS: Array<[Proficiency, number]> = [
  ["expert", 90],
  ["advanced", 75],
  ["proficient", 55],
  ["developing", 30],
  ["novice", 0],
];

function proficiencyFromScore(score: number): Proficiency {
  for (const [level, threshold] of PROFICIENCY_THRESHOLDS) {
    if (score >= threshold) return level;
  }
  return "novice";
}

function getProfile(opts: { powerModeHeartbeatAt: string | null; freshnessHours: number }): "passive" | "power_mode" {
  if (!opts.powerModeHeartbeatAt) return "passive";
  const age = Date.now() - new Date(opts.powerModeHeartbeatAt).getTime();
  return age <= opts.freshnessHours * 3_600_000 ? "power_mode" : "passive";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function computeSkillProofScore(input: ComputeInput): SkillProofResult {
  const profile = getProfile({
    powerModeHeartbeatAt: input.powerModeHeartbeatAt ?? null,
    freshnessHours: input.freshnessHours ?? 2,
  });

  // Component scores in 0..100
  const hoursTarget = input.avg_hours_to_proficiency ?? 50;
  const hoursComponent = Math.min(100, (input.hours_logged / Math.max(1, hoursTarget)) * 100);
  const projectsComponent = Math.min(100, input.projects_completed * 25);
  const quality = (clamp01(input.avg_completion_rate) * 0.6 + clamp01(input.avg_focus_quality) * 0.4) * 100;
  const consistencyComponent = Math.min(100, input.projects_completed * 10 + Math.min(50, input.hours_logged / 4));

  const components: ScoreComponents = {
    hours: hoursComponent,
    projects: projectsComponent,
    quality,
    consistency: consistencyComponent,
  };

  // Passive: hours + projects + quality + consistency weighted 25/35/25/15
  const passiveScore =
    hoursComponent * 0.25 +
    projectsComponent * 0.35 +
    quality * 0.25 +
    consistencyComponent * 0.15;

  // Power mode: heavier on hours, quality; reduces weight of consistency
  const powerScore =
    hoursComponent * 0.30 +
    projectsComponent * 0.30 +
    quality * 0.30 +
    consistencyComponent * 0.10;

  const raw = profile === "power_mode" ? powerScore : passiveScore;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    proficiency: proficiencyFromScore(score),
    components,
    profile,
  };
}

export function proficiencyToNextThreshold(proficiency: Proficiency): {
  next: Proficiency | null;
  threshold: number;
} {
  const idx = PROFICIENCY_THRESHOLDS.findIndex(([lvl]) => lvl === proficiency);
  if (idx <= 0) return { next: null, threshold: 0 };
  const nextEntry = PROFICIENCY_THRESHOLDS[idx - 1];
  if (!nextEntry) return { next: null, threshold: 0 };
  const [nextLevel, threshold] = nextEntry;
  return { next: nextLevel as Proficiency, threshold };
}

// Backwards-compatible: persist to candidate_profiles when called from the
// update-profiles edge function (Deno). Web callers should use
// computeSkillProofScore directly.
export async function computeAndPersistScore(
  admin: { from: (t: string) => { update: (v: unknown) => { eq: (col: string, val: unknown) => Promise<unknown> } } },
  input: ComputeInput & { userId: string },
): Promise<{ overall: number; profile: "passive" | "power_mode" }> {
  const result = computeSkillProofScore(input);
  await admin
    .from("candidate_profiles")
    .update({ overall_skill_proof_score: result.score, last_score_change_at: new Date().toISOString() })
    .eq("user_id", input.userId);
  return { overall: result.score, profile: result.profile };
}
