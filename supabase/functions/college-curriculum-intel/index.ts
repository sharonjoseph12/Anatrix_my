// supabase/functions/college-curriculum-intel/index.ts
// T079 helper — returns per-skill supply (opted-in cohort members) vs. demand
// (recruiter search appearances in the last 90d).

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

  // Supply: count of opted-in members per top skill
  const { data: members } = await supabase.from("institution_members")
    .select("user_id").eq("institution_id", institution_id).eq("role", "student")
    .eq("batch_year", batch_year ?? 0).eq("opted_in", true);
  const memberIds = (members ?? []).map((m) => m.user_id);

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
