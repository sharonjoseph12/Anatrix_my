// supabase/functions/college-students/index.ts
// T085 helper — Roster of opted-in students in the recruiter's institution.

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

  const { data: inst } = await supabase.from("institution_members")
    .select("institution_id").eq("user_id", user.id).maybeSingle();
  if (!inst) return json({ error: "no_institution" }, 403);
  const institutionId = inst.institution_id;

  const { data: members } = await supabase.from("institution_members")
    .select("user_id,batch_year,specialization,users!inner(display_name,full_name)")
    .eq("institution_id", institutionId)
    .eq("role", "student");
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score").in("user_id", userIds);
  const scoreByUser = new Map<string, number>();
  for (const p of profiles ?? []) scoreByUser.set(p.user_id, p.skill_proof_score ?? 0);

  const rows = (members ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users as { display_name: string | null; full_name: string | null };
    return {
      user_id: m.user_id,
      display_name: u?.display_name ?? null,
      full_name: u?.full_name ?? null,
      score: scoreByUser.get(m.user_id) ?? 0,
      batch_year: m.batch_year,
      specialization: (m as { specialization?: string | null }).specialization ?? null,
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
