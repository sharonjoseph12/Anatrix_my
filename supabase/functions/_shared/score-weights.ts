// supabase/functions/_shared/score-weights.ts
// T024 — passive-only vs Power-Mode weighting per ANTARIX_11_10_DEFINITIVE.md §8

export type WeightingProfile = "passive" | "power_mode";

export type ScoreWeights = {
  github_activity: number;
  session_quality: number;
  consistency: number;
  peer_context: number;
  calendar_context?: number;
};

const PASSIVE: ScoreWeights = {
  github_activity: 0.50,
  session_quality: 0.0,
  consistency: 0.20,
  peer_context: 0.20,
  calendar_context: 0.10,
};

const POWER_MODE: ScoreWeights = {
  github_activity: 0.35,
  session_quality: 0.25,
  consistency: 0.20,
  peer_context: 0.20,
};

export function getWeightingProfile(opts: { powerModeHeartbeatAt: string | null; freshnessHours: number }): WeightingProfile {
  if (!opts.powerModeHeartbeatAt) return "passive";
  const ageMs = Date.now() - new Date(opts.powerModeHeartbeatAt).getTime();
  return ageMs <= opts.freshnessHours * 3600_000 ? "power_mode" : "passive";
}

export function getWeights(profile: WeightingProfile): ScoreWeights {
  return profile === "power_mode" ? POWER_MODE : PASSIVE;
}

export function computeOverallScore(profile: WeightingProfile, components: {
  github_activity: number;
  session_quality: number;
  consistency: number;
  peer_context: number;
  calendar_context?: number;
}): number {
  const w = getWeights(profile);
  const raw =
    components.github_activity * w.github_activity +
    components.session_quality * (w.session_quality ?? 0) +
    components.consistency * w.consistency +
    components.peer_context * w.peer_context +
    (components.calendar_context ?? 0) * (w.calendar_context ?? 0);
  return Math.max(0, Math.min(100, Math.round(raw)));
}
