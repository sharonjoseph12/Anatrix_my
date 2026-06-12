// supabase/functions/college-company-matches/index.ts
// T081 helper — Returns the list of companies whose `required_skills` overlap
// with opted-in cohort students' `per_skill_scores`, with per-company match
// lists. Used by `apps/web/(college)/companies/page.tsx`.

import { json, serveWithAuth, getOptedInStudents } from "../_shared/college-intel.ts";

serveWithAuth(async (req, supabase) => {

  const { institution_id, batch_year } = await req.json() as { institution_id?: string; batch_year?: number };
  if (!institution_id) return json({ error: "institution_id required" }, 400);

  const members = await getOptedInStudents(supabase, institution_id, batch_year ?? 0);
  const memberIds = members.map((m) => m.user_id);
  if (memberIds.length === 0) return json([]);

  // Student skill profiles
  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score,per_skill_scores,power_mode_bonus_active,users(display_name,full_name)")
    .in("user_id", memberIds).eq("company_search_visible", true);
  const students = buildStudentProfiles(profiles ?? []);

  // Companies with open positions
  const { data: companies } = await supabase.from("companies").select("id,name,open_positions");
  return json(buildCompanyMatches(companies ?? [], students));
});

function buildStudentProfiles(profiles: any[]) {
  return profiles.map((p) => {
    const u = Array.isArray(p.users) ? p.users[0] : p.users;
    return {
      user_id: p.user_id,
      name: u?.display_name ?? u?.full_name ?? "Anonymous",
      score: p.skill_proof_score ?? 0,
      power_mode: !!p.power_mode_bonus_active,
      per_skill: (p.per_skill_scores as Record<string, number> | null) ?? {},
    };
  });
}

function buildCompanyMatches(companies: any[], students: any[]) {
  return companies.map((c) => {
    const positions = c.open_positions ?? [];
    const requiredSkills = positions.flatMap((p: any) => (p.required_skills ?? []).map((s: any) => s.skill_slug));
    const matchingStudents = students.filter((s) =>
      requiredSkills.some((skill: any) => (s.per_skill[skill] ?? 0) >= 60),
    );
    return {
      company_id: c.id,
      company_name: c.name,
      matching_students: matchingStudents.map((s) => ({ user_id: s.user_id, name: s.name, score: s.score, power_mode: s.power_mode })),
    };
  }).filter((m) => m.matching_students.length > 0);
}
