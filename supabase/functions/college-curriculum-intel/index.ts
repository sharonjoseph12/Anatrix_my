// supabase/functions/college-curriculum-intel/index.ts
// T079 helper — returns per-skill supply (opted-in cohort members) vs. demand
// (recruiter search appearances in the last 90d).

import { json, serveWithAuth, getOptedInStudents } from "../_shared/college-intel.ts";

serveWithAuth(async (req, supabase) => {
  const { institution_id, batch_year } = await req.json() as { institution_id?: string; batch_year?: number };
  if (!institution_id) return json({ error: "institution_id required" }, 400);

  // Supply: count of opted-in members per top skill
  const members = await getOptedInStudents(supabase, institution_id, batch_year ?? 0);
  const memberIds = members.map((m) => m.user_id);

  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("per_skill_scores").in("user_id", memberIds).eq("company_search_visible", true);
  const supply = new Map<string, number>();
  for (const p of profiles ?? []) {
    const skills = (p.per_skill_scores as Record<string, number> | null) ?? {};
    for (const [s, v] of Object.entries(skills)) if ((v ?? 0) >= 60) supply.set(s, (supply.get(s) ?? 0) + 1);
  }

  // Demand: how many times each skill appeared in recruiter_searches
  const { data: searches } = await supabase.from("recruiter_searches")
    .select("filters").gte("last_run_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
  const demand = new Map<string, number>();
  for (const s of searches ?? []) {
    const filters = (s.filters as { skills?: string[] } | null) ?? {};
    for (const skill of filters.skills ?? []) demand.set(skill, (demand.get(skill) ?? 0) + 1);
  }

  const allSkills = new Set<string>([...supply.keys(), ...demand.keys()]);
  const rows = [...allSkills].map((skill) => ({
    skill,
    supply: supply.get(skill) ?? 0,
    demand: demand.get(skill) ?? 0,
  }));
  return json(rows);
});
