// supabase/functions/college-company-matches/index.ts
// T081 helper — Returns the list of companies whose `required_skills` overlap
// with opted-in cohort students' `per_skill_scores`, with per-company match
// lists. Used by `apps/web/(college)/companies/page.tsx`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Missing Authorization" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: ue } = await supabase.auth.getUser();
  if (ue || !user) return json({ error: "Not authenticated" }, 401);

  const { institution_id, batch_year } = await req.json() as { institution_id?: string; batch_year?: number };
  if (!institution_id) return json({ error: "institution_id required" }, 400);

  // Opted-in members only
  const { data: members } = await supabase.from("institution_members")
    .select("user_id").eq("institution_id", institution_id)
    .eq("role", "student")
    .eq("batch_year", batch_year ?? 0)
    .eq("opted_in", true);
  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return json([]);

  // Student skill profiles
  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score,per_skill_scores,power_mode_bonus_active,users(display_name,full_name)")
    .in("user_id", memberIds).eq("company_search_visible", true);
  const students = (profiles ?? []).map((p) => {
    const u = Array.isArray(p.users) ? p.users[0] : p.users as { display_name: string | null; full_name: string | null };
    return {
      user_id: p.user_id,
      name: u?.display_name ?? u?.full_name ?? "Anonymous",
      score: p.skill_proof_score ?? 0,
      power_mode: !!p.power_mode_bonus_active,
      per_skill: (p.per_skill_scores as Record<string, number> | null) ?? {},
    };
  });

  // Companies with open positions
  const { data: companies } = await supabase.from("companies").select("id,name,open_positions");
  const matches = (companies ?? []).map((c) => {
    const positions = ((c as { open_positions?: Array<{ required_skills?: Array<{ skill_slug: string; min_score: number }> }> }).open_positions) ?? [];
    const requiredSkills = positions.flatMap((p) => (p.required_skills ?? []).map((s) => s.skill_slug));
    const matchingStudents = students.filter((s) =>
      requiredSkills.some((skill) => (s.per_skill[skill] ?? 0) >= 60),
    );
    return {
      company_id: c.id,
      company_name: c.name,
      matching_students: matchingStudents.map((s) => ({ user_id: s.user_id, name: s.name, score: s.score, power_mode: s.power_mode })),
    };
  }).filter((m) => m.matching_students.length > 0);

  return json(matches);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cor(), "Content-Type": "application/json" } });
}
function cor() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
