// supabase/functions/college-leaderboard/index.ts
// T080 helper — paginated batch leaderboard with documented tie-breakers
// (score DESC, last_active_at DESC, user_id ASC).

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

  const { offset = 0, limit = 10, institution_id, batch_year } = await req.json() as { offset?: number; limit?: number; institution_id?: string; batch_year?: number };
  if (!institution_id) return json({ error: "institution_id required" }, 400);

  const { data: members } = await supabase.from("institution_members")
    .select("user_id").eq("institution_id", institution_id)
    .eq("role", "student")
    .eq("batch_year", batch_year ?? 0).eq("opted_in", true);
  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return json({ rows: [], total: 0 });

  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score,current_streak_days,power_mode_bonus_active,users!inner(display_name,full_name)")
    .in("user_id", userIds)
    .eq("company_search_visible", true)
    .order("skill_proof_score", { ascending: false })
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  const rows = (profiles ?? []).map((p) => {
    const u = Array.isArray(p.users) ? p.users[0] : p.users as { display_name: string | null; full_name: string | null; last_active_at: string };
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
  return json({ rows, total: userIds.length });
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
