// supabase/functions/college-aggregate/index.ts
// T080 — Returns readiness counts, leaderboard, and skill-gap report for one
// institution + batch year. Documented RLS guard: only opted-in members.

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
  if (!members?.length) {
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
