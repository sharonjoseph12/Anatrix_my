// supabase/functions/college-aggregate/index.ts
// T080 — Returns readiness counts, leaderboard, and skill-gap report for one
// institution + batch year. Documented RLS guard: only opted-in members.

import { json, serveWithAuth, getOptedInStudents } from "../_shared/college-intel.ts";

serveWithAuth(async (req, supabase) => {
  const { institution_id, batch_year } = await req.json() as { institution_id?: string; batch_year?: number };
  if (!institution_id) return json({ error: "institution_id required" }, 400);

  const members = await getOptedInStudents(supabase, institution_id, batch_year ?? 0);
  if (!members.length) {
    return json({ ready_now: 0, development_path: 0, early_stage: 0, total_opted_in: 0 });
  }
  const userIds = members.map((m) => m.user_id);

  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score,company_search_visible")
    .in("user_id", userIds);
  const optedInSearch = (profiles ?? []).filter((p) => p.company_search_visible);
  const counts = { ready_now: 0, development_path: 0, early_stage: 0 };
  for (const p of optedInSearch) {
    const s = p.skill_proof_score ?? 0;
    if (s >= 75) counts.ready_now++;
    else if (s >= 55) counts.development_path++;
    else counts.early_stage++;
  }
  return json({ ...counts, total_opted_in: optedInSearch.length });
});
