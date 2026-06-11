// supabase/functions/college-alumni/index.ts
// T083 helper — Returns alumni (graduates) with placement outcomes, tier, and
// (optional) salary band if they have shared it.

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

  const { institution_id, current_year } = await req.json() as { institution_id?: string; current_year?: number };
  if (!institution_id) return json({ error: "institution_id required" }, 400);
  const year = current_year ?? new Date().getFullYear();

  // Alumni = batch_year < year
  const { data: alumni } = await supabase.from("institution_members")
    .select("user_id,batch_year,users!inner(display_name,full_name,placement_outcome,placement_tier,salary_band_shared,salary_band)")
    .eq("institution_id", institution_id)
    .eq("role", "student")
    .lt("batch_year", year)
    .not("users.placement_outcome", "is", null);
  const rows = (alumni ?? []).map((a) => {
    const u = Array.isArray(a.users) ? a.users[0] : a.users as {
      display_name: string | null; full_name: string | null;
      placement_outcome: string | null; placement_tier: string | null;
      salary_band_shared: boolean; salary_band: string | null;
    };
    return {
      name: u?.display_name ?? u?.full_name ?? "Anonymous",
      outcome: u?.placement_outcome ?? "—",
      tier: u?.placement_tier ?? "—",
      band: u?.salary_band_shared ? u?.salary_band ?? null : null,
    };
  });
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
