// supabase/functions/placement-predict/index.ts
// T063 — Weekly pg_cron: for each qualifying user, compute (probability, tier,
// time_to_ready, top_gaps) and persist to placement_predictions with the full
// feature snapshot. Picked up by the dashboard PlacementPredictionCard.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { json, handleOptions } from "../_shared/college-intel.ts";
import { scorePlacement } from "../_shared/placement-scorer.ts";

serve(async (req: Request) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const minDays = Number(Deno.env.get("PLACEMENT_PREDICTION_MIN_DAYS") ?? 30);
  const modelVersion = Deno.env.get("PLACEMENT_PREDICTION_MODEL_VERSION") ?? "v1.0.0";
  const since = new Date(Date.now() - minDays * 24 * 3600 * 1000).toISOString();
  const runWeek = isoDate(new Date());

  // Walk users with at least one session in the minDays window
  const { data: candidates } = await supabase.from("sessions")
    .select("user_id").gte("started_at", since);
  if (!candidates?.length) return json({ run_week: runWeek, predictions: 0 });

  const userIds = Array.from(new Set(candidates.map((c) => c.user_id)));
  let predictions = 0;

  for (const userId of userIds) {
    const features = await gatherFeatures(supabase, userId);
    const result = scorePlacement(features);

    const { error: upErr } = await supabase.from("placement_predictions").upsert({
      user_id: userId,
      run_week: runWeek,
      model_version: modelVersion,
      probability_0_100: result.probability_0_100,
      company_tier: result.company_tier,
      time_to_ready_months: result.time_to_ready_months,
      top_gaps: result.top_gaps,
      input_features: features,
    }, { onConflict: "user_id,run_week" });
    if (!upErr) predictions++;
  }

  return json({ run_week: runWeek, candidates: userIds.length, predictions });
});

async function gatherFeatures(supabase: ReturnType<typeof createClient>, userId: string) {
  const [cp, sessions, gh, claims] = await Promise.all([
    supabase.from("candidate_profiles").select("skill_proof_score,current_streak_days,peak_window_start_local_hour,peak_window_end_local_hour,power_mode_bonus_active").eq("user_id", userId).maybeSingle(),
    supabase.from("sessions").select("id,category,started_at,duration_minutes,focus_quality_score").eq("user_id", userId).order("started_at", { ascending: false }).limit(120),
    supabase.from("github_activity").select("commit_count_30d,pr_count_30d,distinct_repos_30d,top_languages").eq("user_id", userId).maybeSingle(),
    supabase.from("verifiable_credentials").select("revocation_status,snapshot_overall_score,verification_count").eq("user_id", userId).eq("revocation_status", "active").maybeSingle(),
  ]);
  const sessionList = (sessions.data ?? []) as Array<{ duration_minutes: number | null; focus_quality_score: number | null }>;
  return {
    score: cp.data?.skill_proof_score ?? 0,
    streak: cp.data?.current_streak_days ?? 0,
    power_mode_active: !!cp.data?.power_mode_bonus_active,
    session_count: sessionList.length,
    avg_focus_quality: sessionList.reduce((a, s) => a + (s.focus_quality_score ?? 0), 0) / Math.max(1, sessionList.length),
    total_focus_minutes: sessionList.reduce((a, s) => a + (s.duration_minutes ?? 0), 0),
    commit_count_30d: gh.data?.commit_count_30d ?? 0,
    pr_count_30d: gh.data?.pr_count_30d ?? 0,
    distinct_repos_30d: gh.data?.distinct_repos_30d ?? 0,
    top_languages: (gh.data?.top_languages as string[]) ?? [],
    has_active_credential: !!claims.data,
    credential_verification_count: claims.data?.verification_count ?? 0,
  };
}

function isoDate(d: Date): string {
  // Returns YYYY-MM-DD (used as a date in placement_predictions.run_week)
  return d.toISOString().slice(0, 10);
}
