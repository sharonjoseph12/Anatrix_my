// supabase/functions/recruiter-search/index.ts
// T087 — Server-side recruiter search. Filters candidate_profiles joined to
// users.company_search_visible = true, decrements monthly_search_credit_balance,
// persists the search, returns the result set with a per-row match_score.

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

  const { skills = [], min_score = 0, batch_years = [], location = "", power_mode_only = false } = await req.json() as {
    skills?: string[]; min_score?: number; batch_years?: number[]; location?: string; power_mode_only?: boolean;
  };

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Credit guard
  const { data: company } = await admin.from("companies").select("id,monthly_search_credit_balance,monthly_search_credit_reset_at,plan")
    .eq("owner_user_id", user.id).maybeSingle();
  if (!company) return json({ error: "no_company_profile" }, 403);
  if ((company.monthly_search_credit_balance ?? 0) <= 0) {
    return json({ error: "monthly_credit_exhausted" }, 402);
  }
  // Decrement
  await admin.from("companies").update({ monthly_search_credit_balance: (company.monthly_search_credit_balance ?? 0) - 1 })
    .eq("owner_user_id", user.id);

  // Run the search
  let q = supabase.from("candidate_profiles")
    .select("user_id,skill_proof_score,per_skill_scores,verified_activity,power_mode_bonus_active,users!inner(id,display_name,full_name,location,institution_members(batch_year),company_search_visible)")
    .eq("company_search_visible", true)
    .gte("skill_proof_score", min_score);

  if (power_mode_only) q = q.eq("power_mode_bonus_active", true);
  if (location) q = q.ilike("users.location", `%${location}%`);

  const { data, error } = await q.limit(50);
  if (error) return json({ error: error.message }, 500);

  // Filter / score client-side for skills and batch years
  const results = (data ?? []).map((row) => {
    const u = Array.isArray(row.users) ? row.users[0] : row.users as {
      id: string; display_name: string | null; full_name: string | null; location: string | null;
      institution_members: Array<{ batch_year: number }> | { batch_year: number } | null;
    };
    const perSkill = (row.per_skill_scores as Record<string, number> | null) ?? {};
    const skillOverlap = skills.filter((s) => (perSkill[s] ?? 0) > 0).length;
    const skillCoverage = skills.length === 0 ? 1 : skillOverlap / skills.length;
    const match_score = Math.round(skillCoverage * 100);

    let batches: number[] = [];
    if (Array.isArray(u?.institution_members)) batches = u.institution_members.map((m) => m.batch_year);
    else if (u?.institution_members) batches = [u.institution_members.batch_year];

    return {
      user_id: row.user_id,
      name: u?.display_name ?? u?.full_name ?? "Anonymous",
      score: row.skill_proof_score ?? 0,
      match_score,
      top_skills: Object.entries(perSkill).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s),
      verified_activity_summary: summarizeActivity(row.verified_activity),
      power_mode_active: !!row.power_mode_bonus_active,
      batches,
    };
  })
  .filter((r) => batch_years.length === 0 || r.batches.some((b) => batch_years.includes(b)))
  .sort((a, b) => b.match_score - a.match_score || b.score - a.score);

  // Persist the search
  await admin.from("recruiter_searches").insert({
    recruiter_user_id: user.id,
    company_id: company.id,
    search_name: `${skills.join(",") || "all"} @ ${new Date().toISOString().slice(0, 10)}`,
    filters: { skills, min_score, batch_years, location, power_mode_only },
    last_run_at: new Date().toISOString(),
    last_results_count: results.length,
  });

  return json({ results });
});

function summarizeActivity(v: unknown): string {
  const a = v as Record<string, unknown> | null;
  if (!a) return "No verified activity yet";
  const commits = (a.commits_30d as number | undefined) ?? 0;
  const streak = (a.streak_days as number | undefined) ?? 0;
  return `${commits} commits · ${streak}-day streak`;
}

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
