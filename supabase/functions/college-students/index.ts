// supabase/functions/college-students/index.ts
// T085 helper — Roster of opted-in students in the recruiter's institution.

import { json, serveWithAuth } from "../_shared/college-intel.ts";

serveWithAuth(async (req, supabase, user) => {
  const { data: inst } = await supabase.from("institution_members")
    .select("institution_id").eq("user_id", user.id).maybeSingle();
  if (!inst) return json({ error: "no_institution" }, 403);
  const institutionId = inst.institution_id;

  const { data: members } = await supabase.from("institution_members")
    .select("user_id,batch_year,specialization,users!inner(display_name,full_name)")
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .eq("opted_in", true);
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score").in("user_id", userIds);
  const scoreByUser = new Map<string, number>();
  for (const p of profiles ?? []) scoreByUser.set(p.user_id, p.skill_proof_score ?? 0);

  return json(buildStudentRows(members ?? [], scoreByUser));
});

function buildStudentRows(members: any[], scoreByUser: Map<string, number>) {
  return members.map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      user_id: m.user_id,
      display_name: u?.display_name ?? null,
      full_name: u?.full_name ?? null,
      score: scoreByUser.get(m.user_id) ?? 0,
      batch_year: m.batch_year,
      specialization: m.specialization ?? null,
    };
  });
}
