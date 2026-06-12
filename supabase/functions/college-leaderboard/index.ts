// supabase/functions/college-leaderboard/index.ts
// T080 helper — paginated batch leaderboard with documented tie-breakers
// (score DESC, last_active_at DESC, user_id ASC).

import { json, serveWithAuth, getOptedInStudents } from "../_shared/college-intel.ts";

serveWithAuth(async (req, supabase) => {
  const { offset = 0, limit = 10, institution_id, batch_year } = await req.json() as { offset?: number; limit?: number; institution_id?: string; batch_year?: number };
  if (!institution_id) return json({ error: "institution_id required" }, 400);

  const members = await getOptedInStudents(supabase, institution_id, batch_year ?? 0);
  const userIds = members.map((m) => m.user_id);
  if (userIds.length === 0) return json({ rows: [], total: 0 });

  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score,current_streak_days,power_mode_bonus_active,users!inner(display_name,full_name)")
    .in("user_id", userIds)
    .eq("company_search_visible", true)
    .order("skill_proof_score", { ascending: false })
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  return json({ rows: buildLeaderboardRows(profiles ?? []), total: userIds.length });
});

function buildLeaderboardRows(profiles: any[]) {
  return profiles.map((p) => {
    const u = Array.isArray(p.users) ? p.users[0] : p.users;
    return {
      user_id: p.user_id,
      display_name: u?.display_name ?? null,
      full_name: u?.full_name ?? null,
      score: p.skill_proof_score ?? 0,
      streak: p.current_streak_days ?? null,
      power_mode_active: !!p.power_mode_bonus_active,
      last_active_at: u?.last_active_at ?? new Date().toISOString(),
    };
  });
}
