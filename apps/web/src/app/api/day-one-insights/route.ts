// apps/web/src/app/api/day-one-insights/route.ts
// Backing endpoint for the DayOneInsights client component.
// Reads candidate_profiles + github_activity for the current user and returns
// the documented Day-1 fields.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ready: false }, { status: 401 });

  const { data: cp } = await supabase
    .from("candidate_profiles")
    .select("overall_skill_proof_score,specialization_scores,total_commits,peak_window_start_local_hour,peak_window_end_local_hour")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cp || (cp.total_commits ?? 0) === 0) {
    return NextResponse.json({ ready: false });
  }

  // Streak from github_activity in last 90 days
  const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: commits } = await supabase
    .from("github_activity")
    .select("committed_at")
    .eq("user_id", user.id)
    .gte("committed_at", ninetyAgo);

  const dayKeys = new Set((commits ?? []).map((c) => c.committed_at.slice(0, 10)));
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (dayKeys.has(d)) streak++;
    else break;
  }

  const specScores = (cp.specialization_scores ?? {}) as Record<string, number>;
  const topLanguages = Object.entries(specScores)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([name, pct]) => ({ name, pct: Math.round(pct) }));

  return NextResponse.json({
    ready: true,
    commits: cp.total_commits ?? 0,
    topLanguages,
    peakHours: peakWindowToArray(cp.peak_window_start_local_hour, cp.peak_window_end_local_hour),
    streakDays: streak,
    firstPassScore: cp.overall_skill_proof_score ?? 0,
    activeRepos: new Set((commits ?? []).map((c) => c.committed_at.slice(0, 10))).size, // rough proxy
  });
}

function peakWindowToArray(start: number | null, end: number | null): number[] {
  if (start == null || end == null) return [];
  if (start < end) return Array.from({ length: end - start }, (_, i) => start + i);
  // wrap-around
  return [
    ...Array.from({ length: 24 - start }, (_, i) => start + i),
    ...Array.from({ length: end }, (_, i) => i),
  ];
}
